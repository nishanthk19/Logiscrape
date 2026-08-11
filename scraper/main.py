import os
import time
import io
import json
import logging
import random
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
SCRAPEDO_TOKEN = os.getenv("SCRAPEDO_TOKEN")

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
        captcha_text = response.text.strip().replace(" ", "")
        logger.info(f"Gemini solved CAPTCHA: {captcha_text}")
        return captcha_text
    except Exception as e:
        logger.error(f"Gemini CAPTCHA solve error: {e}")
        return None

def extract_table_data_via_gemini(screenshot_bytes):
    if not screenshot_bytes or not gemini_client:
        return []
    
    try:
        logger.info("Sending table screenshot to Gemini Vision for extraction...")
        image = Image.open(io.BytesIO(screenshot_bytes))
        
        prompt = """
        Analyze this screenshot of a data table. Extract all rows into a JSON array of objects.
        
        For each row, populate these exact keys:
        - "season": text (e.g. "Rabi 25-26" or "Kharif 25-26")
        - "mill_name": text (e.g. "18625-KAMADHENU FOOD PROCESSING...")
        - "miller_dispatch_date": text (e.g. "07-08-2026")
        - "consignment_number": text (e.g. "18625_R-22_FCI_1085302")
        - "ack_number": text (e.g. "R 25 - 26/1085185")
        - "class_type": text (e.g. "PB Grade A - Non FRK")
        - "total_bags": number (e.g. 580.00)
        - "total_quantity": number (e.g. 290.00)
        - "vehicle_number": extract from 'Way Bill Details' (e.g. "AP12V7631")
        - "waybill_number": extract from 'Way Bill Details' (e.g. "122511178095")
        - "waybill_date": extract from 'Way Bill Details' (e.g. "07-08-2026")
        - "gate_status": text from 'Action' button ("Gate In" or "Gate Out")

        Return ONLY a valid raw JSON array. Do not include markdown code block syntax (no ```json), explanations, or quotes around the array.
        """
        
        response = gemini_client.models.generate_content(
            model='gemini-1.5-flash',
            contents=[prompt, image]
        )
        
        json_string = response.text.strip()
        if json_string.startswith("```json"):
            json_string = json_string[7:]
        if json_string.startswith("```"):
            json_string = json_string[3:]
        if json_string.endswith("```"):
            json_string = json_string[:-3]
            
        json_string = json_string.strip()
        records = json.loads(json_string)
        
        logger.info(f"Gemini successfully extracted {len(records)} records from screenshot.")
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
                consignment_number, ack_number, season, mill_name, miller_dispatch_date, class_type, 
                total_bags, total_quantity, vehicle_number, waybill_number, waybill_date, gate_status
            ) VALUES %s
            ON CONFLICT (consignment_number) DO UPDATE SET 
                gate_status = EXCLUDED.gate_status, last_updated_at = CURRENT_TIMESTAMP;
        """
        
        values = []
        for r in records:
            consignment = r.get('consignment_number')
            if consignment:
                values.append([
                    consignment,
                    r.get('ack_number', ''),
                    r.get('season', ''),
                    r.get('mill_name', ''),
                    r.get('miller_dispatch_date', ''),
                    r.get('class_type', ''),
                    float(r.get('total_bags', 0)),
                    float(r.get('total_quantity', 0)),
                    r.get('vehicle_number', ''),
                    r.get('waybill_number', ''),
                    r.get('waybill_date', ''),
                    r.get('gate_status', '')
                ])

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
    
    if not SCRAPEDO_TOKEN:
        logger.error("Missing SCRAPEDO_TOKEN. Proxy authentication will fail.")
        return

    with sync_playwright() as p:
        # Generate a random integer ID (0 to 1,000,000) to lock the residential IP address 
        session_id = random.randint(1, 999999)
        
        scrape_do_proxy = {
            "server": "http://proxy.scrape.do:8080",
            "username": SCRAPEDO_TOKEN,
            # We enforce geoCode=in (India), super=true (Residential IP), render=false (Since Playwright handles JS), and lock the sessionId
            "password": f"geoCode=in&super=true&render=false&sessionId={session_id}"
        }

        browser = p.chromium.launch(
            headless=True, 
            proxy=scrape_do_proxy,
            args=[
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-blink-features=AutomationControlled',
                '--ignore-certificate-errors'
            ]
        )
        
        context = browser.new_context(
            ignore_https_errors=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Upgrade-Insecure-Requests": "1"
            }
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
                if captcha_input: 
                    captcha_input.fill(captcha_text)
                
                submit_btn = page.query_selector("button[type='submit'], #btnLogin")
                if submit_btn: 
                    submit_btn.click()
                
                page.wait_for_load_state('networkidle', timeout=60000)
                
                if "Login" not in page.title() or page.url != LOGIN_URL:
                    logger.info("Login successful!")
                    login_success = True
                    break

            if not login_success:
                logger.error("Failed to login after 3 attempts.")
                browser.close()
                return

            # 2. Navigate to Gate Entry
            logger.info("Navigating to Gate Entry page...")
            page.goto(GATE_ENTRY_URL, timeout=90000)
            
            table_selector = "table"
            row_selector = "table tbody tr"
            
            try:
                page.wait_for_load_state('networkidle', timeout=30000)
                page.wait_for_selector(row_selector, state="attached", timeout=45000)
                page.wait_for_timeout(2000) 
            except Exception as e:
                logger.error("Timeout: Could not find table rows.")
                logger.error(f"DEBUG URL: {page.url}")
                logger.error(f"DEBUG TITLE: {page.title()}")
                try:
                    visible_text = page.locator("body").inner_text()
                    logger.error(f"DEBUG SCREEN TEXT:\n{visible_text[:800]}")
                except:
                    pass
                browser.close()
                return

            all_records = []

            # 3. Handle Table Screenshots & Pagination
            while True:
                table_element = page.locator(table_selector).first
                screenshot_bytes = table_element.screenshot()

                records = extract_table_data_via_gemini(screenshot_bytes)
                if records:
                    all_records.extend(records)

                next_btn = page.query_selector("li.paginate_button.next:not(.disabled) a")
                if next_btn:
                    logger.info("Clicking Next page...")
                    next_btn.click()
                    page.wait_for_timeout(3000)
                else:
                    break

            # 4. Save Extracted Data to PostgreSQL
            if all_records:
                save_to_database(all_records)
                logger.info(f"Scrape cycle finished. Processed {len(all_records)} total records from screenshots.")
            else:
                logger.warning("No records extracted from screenshots.")

        except Exception as e:
            logger.error(f"Error during scrape cycle: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    logger.info("Starting OPMS Scraper Service (Screenshot + Gemini Vision Mode)...")
    while True:
        run_scrape_cycle()
        logger.info(f"Sleeping for {SCRAPE_INTERVAL // 60} minutes until next scheduled run...")
        time.sleep(SCRAPE_INTERVAL)