import os
import time
import io
import json
import logging
import psycopg2
from psycopg2.extras import execute_values
from playwright.sync_api import sync_playwright
from google import genai
from PIL import Image

# --- Configuration & Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    DB_URL = f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST', 'postgres')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'truck_gate_db')}"

OPMS_USERNAME = os.getenv("OPMS_USERNAME")
OPMS_PASSWORD = os.getenv("OPMS_PASSWORD")
LOGIN_URL = os.getenv("PORTAL_URL", "https://ppscmr.telangana.gov.in/")
GATE_ENTRY_URL = "https://ppscmr.telangana.gov.in/Dumping/GateEntry"
SCRAPE_INTERVAL = int(os.getenv("SCRAPE_INTERVAL_MINUTES", "15")) * 60

gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    gemini_client = genai.Client(api_key=gemini_api_key)
else:
    logger.error("GEMINI_API_KEY environment variable is not set!")
    gemini_client = None

# --- Helper Functions ---
def get_captcha_bytes(page):
    selectors = ["img[src*='Captcha' i]", "img[src*='captcha' i]", "#captchaImage", "#captcha_img", ".captcha-image"]
    for selector in selectors:
        try:
            element = page.wait_for_selector(selector, state="visible", timeout=3000)
            if element:
                image_bytes = element.screenshot()
                if image_bytes and len(image_bytes) > 0:
                    return image_bytes
        except Exception:
            continue
    return None

def solve_captcha_with_gemini(captcha_bytes):
    if not captcha_bytes or not gemini_client:
        return None
    try:
        image = Image.open(io.BytesIO(captcha_bytes))
        prompt = "Return ONLY the exact characters or numbers shown in this CAPTCHA image. Do not include spaces or extra text."
        response = gemini_client.models.generate_content(model='gemini-1.5-flash', contents=[prompt, image])
        return response.text.strip().replace(" ", "")
    except Exception as e:
        logger.error(f"Gemini CAPTCHA solve error: {e}")
        return None

def extract_table_data_via_gemini(screenshot_bytes):
    """Uses Gemini Vision to parse the table screenshot directly into JSON."""
    if not screenshot_bytes or not gemini_client:
        return []
    
    try:
        logger.info("Sending table screenshot to Gemini for OCR extraction...")
        image = Image.open(io.BytesIO(screenshot_bytes))
        
        prompt = """
        Analyze this screenshot of a data table. Extract all the rows into a valid JSON array of objects. 
        For the 'Way Bill Details' column, split the data into three separate keys: vehicle_number, waybill_number, and waybill_date.
        For the 'Action' column, use the key 'gate_status' (it will be 'Gate In' or 'Gate Out').
        Ensure the JSON strictly uses these keys: 
        ["season", "mill_name", "miller_dispatch_date", "consignment_number", "ack_number", "class_type", "total_bags", "total_quantity", "vehicle_number", "waybill_number", "waybill_date", "gate_status"].
        Return ONLY valid JSON. No markdown formatting, no backticks, no explanations.
        """
        
        response = gemini_client.models.generate_content(model='gemini-1.5-pro', contents=[prompt, image])
        
        # Clean the response to parse the JSON
        json_string = response.text.strip()
        if json_string.startswith('```json'):
            json_string = json_string[7:-3]
            
        records = json.loads(json_string)
        return records
    except Exception as e:
        logger.error(f"Gemini Table Extraction error: {e}")
        return []

def save_to_database(records):
    if not records:
        return
    try:
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS truck_entries (
                consignment_number VARCHAR(100) PRIMARY KEY,
                ack_number VARCHAR(100),
                season VARCHAR(50),
                mill_name TEXT,
                miller_dispatch_date VARCHAR(20),
                class_type VARCHAR(100),
                total_bags NUMERIC(10, 2),
                total_quantity NUMERIC(10, 2),
                vehicle_number VARCHAR(50),
                waybill_number VARCHAR(100),
                waybill_date VARCHAR(20),
                gate_status VARCHAR(20),
                first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        insert_query = """
            INSERT INTO truck_entries (
                consignment_number, ack_number, season, mill_name, miller_dispatch_date,
                class_type, total_bags, total_quantity, vehicle_number, waybill_number, waybill_date, gate_status
            ) VALUES %s
            ON CONFLICT (consignment_number) DO UPDATE SET 
                gate_status = EXCLUDED.gate_status,
                last_updated_at = CURRENT_TIMESTAMP;
        """
        
        # Format values for DB insertion, ensuring safe fallbacks if Gemini missed a key
        values = [[
            r.get('consignment_number', ''), r.get('ack_number', ''), r.get('season', ''), 
            r.get('mill_name', ''), r.get('miller_dispatch_date', ''), r.get('class_type', ''), 
            float(r.get('total_bags', 0)), float(r.get('total_quantity', 0)), 
            r.get('vehicle_number', ''), r.get('waybill_number', ''), r.get('waybill_date', ''), r.get('gate_status', '')
        ] for r in records if r.get('consignment_number')]

        if values:
            execute_values(cursor, insert_query, values)
            conn.commit()
            logger.info(f"Saved {len(values)} entries to PostgreSQL.")
            
    except Exception as e:
        logger.error(f"Database error: {e}")
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

# --- Main Scraper Logic ---
def run_scrape_cycle():
    logger.info(f"Starting portal scrape cycle for {LOGIN_URL}...")
    
    with sync_playwright() as p:
        # Standard residential fingerprinting
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        try:
            # 1. Login
            login_success = False
            for attempt in range(3):
                logger.info(f"Login attempt {attempt + 1}/3")
                page.goto(LOGIN_URL, timeout=60000)
                page.wait_for_load_state('networkidle', timeout=60000)
                
                if "Login" not in page.title():
                    login_success = True
                    break

                captcha_bytes = get_captcha_bytes(page)
                captcha_text = solve_captcha_with_gemini(captcha_bytes)
                
                if not captcha_text:
                    time.sleep(2)
                    continue

                page.fill("input[type='text'], #Username", OPMS_USERNAME) 
                page.fill("input[type='password'], #Password", OPMS_PASSWORD)
                
                captcha_input = page.query_selector("input[id*='captcha' i]")
                if captcha_input: captcha_input.fill(captcha_text)
                
                submit_btn = page.query_selector("button[type='submit'], #btnLogin")
                if submit_btn: submit_btn.click()
                
                page.wait_for_load_state('networkidle', timeout=60000)
                
                if "Login" not in page.title() or page.url != LOGIN_URL:
                    logger.info("Login successful!")
                    login_success = True
                    break

            if not login_success:
                logger.error("Failed to login.")
                browser.close()
                return

            # 2. Navigate and Screenshot
            logger.info("Navigating to Gate Entry page...")
            response = page.goto(GATE_ENTRY_URL, timeout=60000)
            
            if response and response.status == 403:
                logger.error("FATAL: 403 Forbidden. The server is blocking the IP address.")
                browser.close()
                return
                
            page.wait_for_load_state('networkidle', timeout=30000)
            
            # Locate the table and take a picture of it
            table_selector = "table.opms_table"
            page.wait_for_selector(table_selector, state="visible", timeout=30000)
            
            table_element = page.locator(table_selector)
            table_screenshot_bytes = table_element.screenshot()
            
            # 3. Extract via Gemini Vision
            all_records = extract_table_data_via_gemini(table_screenshot_bytes)

            # 4. Save to Database
            if all_records:
                save_to_database(all_records)
                logger.info(f"Scrape cycle finished. Processed {len(all_records)} records from screenshot.")
            else:
                logger.warning("No records extracted from screenshot.")

        except Exception as e:
            logger.error(f"Error during scrape cycle: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    logger.info("Starting OPMS Scraper Service...")
    while True:
        run_scrape_cycle()
        time.sleep(SCRAPE_INTERVAL)