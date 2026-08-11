import os
import time
import re
import io
import logging
import psycopg2
from psycopg2.extras import execute_values
from playwright.sync_api import sync_playwright
from google import genai
from PIL import Image

# --- Configuration & Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Assemble Database URL from environment variables
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    DB_URL = f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST', 'postgres')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'truck_gate_db')}"

OPMS_USERNAME = os.getenv("OPMS_USERNAME")
OPMS_PASSWORD = os.getenv("OPMS_PASSWORD")
LOGIN_URL = os.getenv("PORTAL_URL", "https://ppscmr.telangana.gov.in/")
GATE_ENTRY_URL = "https://ppscmr.telangana.gov.in/Dumping/GateEntry"
SCRAPE_INTERVAL = int(os.getenv("SCRAPE_INTERVAL_MINUTES", "15")) * 60

# Initialize the new Google GenAI Client
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    gemini_client = genai.Client(api_key=gemini_api_key)
else:
    logger.error("GEMINI_API_KEY environment variable is not set!")
    gemini_client = None

# --- Helper Functions ---
def parse_waybill(waybill_raw):
    """Parses format like '(AP12V7631 : 122511178095 : 07-08-2026)'"""
    if not waybill_raw:
        return None, None, None
    match = re.search(r'\((.*?)\s*:\s*(.*?)\s*:\s*(.*?)\)', waybill_raw)
    if match:
        return match.group(1).strip(), match.group(2).strip(), match.group(3).strip()
    return None, None, None

def get_captcha_bytes(page):
    """Waits for the CAPTCHA element and captures valid image bytes."""
    selectors = [
        "img[src*='Captcha' i]", 
        "img[src*='captcha' i]", 
        "#captchaImage", 
        "#captcha_img",
        "#imgCaptcha",
        ".captcha-image"
    ]
    
    for selector in selectors:
        try:
            element = page.wait_for_selector(selector, state="visible", timeout=3000)
            if element:
                logger.info(f"CAPTCHA image found using selector: {selector}")
                image_bytes = element.screenshot()
                
                if image_bytes and len(image_bytes) > 0:
                    return image_bytes
        except Exception:
            continue
            
    logger.error("Could not find or capture a valid CAPTCHA image element on the page.")
    return None

def solve_captcha_with_gemini(captcha_bytes):
    """Solves the captured image using Google Gemini (New SDK)."""
    if not captcha_bytes or not gemini_client:
        return None
        
    try:
        image = Image.open(io.BytesIO(captcha_bytes))
        prompt = "Return ONLY the exact characters or numbers shown in this CAPTCHA image. Do not include spaces, quotes, punctuation, or extra text."
        
        response = gemini_client.models.generate_content(
            model='gemini-1.5-flash',
            contents=[prompt, image]
        )
        captcha_text = response.text.strip().replace(" ", "")
        logger.info(f"Gemini solved CAPTCHA: {captcha_text}")
        return captcha_text
    except Exception as e:
        logger.error(f"Gemini CAPTCHA solve error: {e}")
        return None

def save_to_database(records):
    """Saves records to PostgreSQL using Upsert."""
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

        values = [[
            r['consignment_number'], r['ack_number'], r['season'], r['mill_name'], r['miller_dispatch_date'],
            r['class_type'], r['total_bags'], r['total_quantity'], r['vehicle_number'], r['waybill_number'], 
            r['waybill_date'], r['gate_status']
        ] for r in records]

        execute_values(cursor, insert_query, values)
        conn.commit()
        logger.info(f"Saved {len(records)} entries to PostgreSQL.")
        
    except Exception as e:
        logger.error(f"Database error: {e}")
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

# --- Main Scraper Logic ---
def run_scrape_cycle():
    logger.info(f"Starting portal scrape cycle for {LOGIN_URL}...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
        context = browser.new_context()
        page = context.new_page()

        try:
            # 1. Handle Login with Retry Loop
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
                    logger.warning("Could not resolve CAPTCHA. Retrying...")
                    time.sleep(2)
                    continue

                page.fill("input[type='text'], #Username, #txtUserName", OPMS_USERNAME) 
                page.fill("input[type='password'], #Password, #txtPassword", OPMS_PASSWORD)
                
                captcha_input = page.query_selector("input[id*='captcha' i], input[id*='Captcha' i], #txtCaptcha")
                if captcha_input:
                    captcha_input.fill(captcha_text)
                
                submit_btn = page.query_selector("input[type='submit'], button[type='submit'], #btnLogin")
                if submit_btn:
                    submit_btn.click()
                
                # Wait up to 60 seconds for login processing
                page.wait_for_load_state('networkidle', timeout=60000)
                
                if "Login" not in page.title() or page.url != LOGIN_URL:
                    logger.info("Login successful!")
                    login_success = True
                    break
                else:
                    logger.warning("Login failed (Invalid CAPTCHA or credentials).")
                    time.sleep(2)

            if not login_success:
                logger.error("Failed to login after 3 attempts.")
                browser.close()
                return

            # 2. Navigate to Gate Entry
            logger.info("Navigating to Gate Entry page...")
            page.goto(GATE_ENTRY_URL, timeout=60000)
            
            # Increased timeout to 60 seconds to allow DataTables to initialize
            try:
                page.wait_for_selector("table tbody tr", timeout=60000)
            except Exception as e:
                logger.error("Timeout: The portal took too long to load the gate entry table.")
                browser.close()
                return

            all_records = []
            
            # 3. Extract Data & Handle Pagination
            while True:
                rows = page.query_selector_all("table tbody tr")
                for row in rows:
                    cols = [c.inner_text().strip() for c in row.query_selector_all("td")]
                    
                    if len(cols) >= 11:
                        veh_no, waybill_no, waybill_date = parse_waybill(cols[9])
                        
                        record = {
                            "season": cols[1],
                            "mill_name": cols[2],
                            "miller_dispatch_date": cols[3],
                            "consignment_number": cols[4],
                            "ack_number": cols[5],
                            "class_type": cols[6],
                            "total_bags": float(cols[7]) if cols[7].replace('.','',1).isdigit() else 0.0,
                            "total_quantity": float(cols[8]) if cols[8].replace('.','',1).isdigit() else 0.0,
                            "vehicle_number": veh_no,
                            "waybill_number": waybill_no,
                            "waybill_date": waybill_date,
                            "gate_status": cols[10].replace("\n", "").strip() 
                        }
                        all_records.append(record)

                next_btn = page.query_selector("li.paginate_button.next:not(.disabled) a")
                if next_btn:
                    next_btn.click()
                    page.wait_for_timeout(2000) # Increased slight pause for slow AJAX loads
                else:
                    break

            # 4. Save to Database
            if all_records:
                save_to_database(all_records)
                logger.info(f"Scrape cycle finished successfully. Processed {len(all_records)} records.")
            else:
                logger.warning("No records found in table.")

        except Exception as e:
            logger.error(f"Error during scrape cycle: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    logger.info("Starting OPMS Scraper Service...")
    while True:
        run_scrape_cycle()
        logger.info(f"Sleeping for {SCRAPE_INTERVAL // 60} minutes until next scheduled run...")
        time.sleep(SCRAPE_INTERVAL)