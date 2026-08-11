import os
import time
import re
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
SCRAPEDO_TOKEN = os.getenv("SCRAPEDO_TOKEN")

gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    gemini_client = genai.Client(api_key=gemini_api_key)
else:
    logger.error("GEMINI_API_KEY environment variable is not set!")
    gemini_client = None

# --- Helper Functions ---
def get_captcha_bytes(page):
    """Waits for the CAPTCHA element and captures valid image bytes."""
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
    """Solves the login CAPTCHA image using Gemini."""
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
    """Uses Gemini Vision API to convert a table screenshot directly into JSON records."""
    if not screenshot_bytes or not gemini_client:
        return []
    
    try:
        logger.info("Sending table screenshot to Gemini Vision for structured JSON extraction...")
        image = Image.open(io.BytesIO(screenshot_bytes))
        
        prompt = """
        Analyze this screenshot of the gate entry table. Extract all table rows into a valid JSON array of objects.
        
        For each row, extract the following fields strictly into these exact JSON keys:
        - "season": Season string (e.g., "Rabi 25-26", "Kharif 25-26")
        - "mill_name": Full Mill Name
        - "miller_dispatch_date": Date string (e.g., "07-08-2026")
        - "consignment_number": Consignment Number string
        - "ack_number": Ack. No string
        - "class_type": Class type string
        - "total_bags": Numeric total bags (e.g., 580)
        - "total_quantity": Numeric total quantity (e.g., 290)
        - "vehicle_number": Extract vehicle registration code from Way Bill Details (e.g., "AP12V7631")
        - "waybill_number": Extract waybill ID digits from Way Bill Details (e.g., "122511178095")
        - "waybill_date": Extract date from Way Bill Details (e.g., "07-08-2026")
        - "gate_status": Status button text ("Gate In" or "Gate Out")

        Return ONLY a raw JSON array. Do not include markdown code formatting, backticks, or explanatory text.
        """
        
        response = gemini_client.models.generate_content(
            model='gemini-1.5-flash',
            contents=[prompt, image]
        )
        
        raw_text = response.text.strip()
        # Strip markdown formatting block if present
        if raw_text.startswith("```"):
            lines = raw_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            raw_text = "\n".join(lines).strip()

        records = json.loads(raw_text)
        logger.info(f"Gemini Vision successfully extracted {len(records)} rows from screenshot.")
        return records
    except Exception as e:
        logger.error(f"Gemini Vision table extraction error: {e}")
        return []

def save_to_database(records):
    """Saves records to PostgreSQL using Upsert."""
    if not records:
        return
    try:
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS truck_entries (
                consignment_number VARCHAR(100) PRIMARY KEY, ack_number VARCHAR(100), season VARCHAR(50),
                mill_name TEXT, miller_dispatch_date VARCHAR(20), class_type VARCHAR(100), total_bags NUMERIC(10, 2),
                total_quantity NUMERIC(10, 2), vehicle_number VARCHAR(50), waybill_number VARCHAR(100),
                waybill_date VARCHAR(20), gate_status VARCHAR(20), first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
                    str(consignment),
                    str(r.get('ack_number', '')),
                    str(r.get('season', '')),
                    str(r.get('mill_name', '')),
                    str(r.get('miller_dispatch_date', '')),
                    str(r.get('class_type', '')),
                    float(r.get('total_bags', 0)) if str(r.get('total_bags', '')).replace('.', '', 1).isdigit() else 0.0,
                    float(r.get('total_quantity', 0)) if str(r.get('total_quantity', '')).replace('.', '', 1).isdigit() else 0.0,
                    str(r.get('vehicle_number', '')),
                    str(r.get('waybill_number', '')),
                    str(r.get('waybill_date', '')),
                    str(r.get('gate_status', ''))
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
        scrape_do_proxy = {
            "server": "[http://proxy.scrape.do:8080](http://proxy.scrape.do:8080)",
            "username": SCRAPEDO_TOKEN,
            "password": "geoCode=in