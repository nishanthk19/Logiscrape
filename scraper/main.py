import os
import time
import io
import json
import logging
import urllib.parse
import re
import requests
import psycopg2
from psycopg2.extras import execute_values
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
LOGIN_URL = "https://ppscmr.telangana.gov.in/"
GATE_ENTRY_URL = "https://ppscmr.telangana.gov.in/Dumping/GateEntry"
SCRAPE_INTERVAL = int(os.getenv("SCRAPE_INTERVAL_MINUTES", "15")) * 60
SCRAPEDO_TOKEN = os.getenv("SCRAPEDO_TOKEN")

gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    gemini_client = genai.Client(api_key=gemini_api_key)
else:
    logger.error("GEMINI_API_KEY environment variable is not set!")
    gemini_client = None

def call_scrape_do(target_url, render=False, timeout=60000):
    """Sends a request through Scrape.do's Managed Scraping API with explicit exception handling."""
    encoded_url = urllib.parse.quote(target_url)
    api_url = f"https://api.scrape.do/?token={SCRAPEDO_TOKEN}&url={encoded_url}&geoCode=in&super=true&render={str(render).lower()}&timeout={timeout}"
    
    try:
        # Set requests timeout slightly higher than Scrape.do's internal timeout (converted to seconds)
        req_timeout = (timeout / 1000) + 15
        response = requests.get(api_url, timeout=req_timeout)
        return response
    except requests.exceptions.Timeout:
        logger.error(f"Scrape.do API request timed out for {target_url}")
        return None
    except Exception as e:
        logger.error(f"Scrape.do API request failed for {target_url}: {e}")
        return None

def solve_captcha_with_gemini(image_bytes):
    if not image_bytes or not gemini_client:
        return None
    try:
        image = Image.open(io.BytesIO(image_bytes))
        prompt = "Return ONLY the exact characters or numbers shown in this CAPTCHA image. Do not include spaces or extra text."
        response = gemini_client.models.generate_content(model='gemini-1.5-flash', contents=[prompt, image])
        return response.text.strip().replace(" ", "")
    except Exception as e:
        logger.error(f"Gemini CAPTCHA solve error: {e}")
        return None

def save_to_database(records):
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
        values = [[
            r['consignment_number'], r['ack_number'], r['season'], r['mill_name'], r['miller_dispatch_date'],
            r['class_type'], r['total_bags'], r['total_quantity'], r['vehicle_number'], r['waybill_number'], 
            r['waybill_date'], r['gate_status']
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

def run_scrape_cycle():
    logger.info("Starting portal scrape cycle via Scrape.do API Mode...")
    
    if not SCRAPEDO_TOKEN:
        logger.error("Missing SCRAPEDO_TOKEN environment variable.")
        return

    session = requests.Session()

    # 1. Fetch Login Page (render=false makes this instant and avoids timeouts)
    res = call_scrape_do(LOGIN_URL, render=False, timeout=30000)
    if not res or res.status_code != 200:
        logger.error(f"Failed to fetch login page. Status: {res.status_code if res else 'None'}")
        return

    # Extract CAPTCHA image source using regex
    match_img = re.search(r'src=["\']([^"\']*?[Cc]aptcha[^"\']*?)["\']', res.text)
    if not match_img:
        logger.error("Could not find CAPTCHA image source in HTML.")
        return

    captcha_src = match_img.group(1)
    captcha_url = f"https://ppscmr.telangana.gov.in{captcha_src}" if captcha_src.startswith('/') else captcha_src

    # Download CAPTCHA image
    cap_res = call_scrape_do(captcha_url, render=False, timeout=20000)
    if not cap_res or cap_res.status_code != 200:
        logger.error("Failed to download CAPTCHA image.")
        return

    captcha_text = solve_captcha_with_gemini(cap_res.content)
    if not captcha_text:
        logger.error("Failed to solve CAPTCHA.")
        return

    logger.info(f"Solved CAPTCHA: {captcha_text}")

    # 2. Extract ASP.NET ViewState parameters
    vs_match = re.search(r'id="__VIEWSTATE"[^>]*value="([^"]*)"', res.text)
    ev_match = re.search(r'id="__EVENTVALIDATION"[^>]*value="([^"]*)"', res.text)
    
    payload = {
        "Username": OPMS_USERNAME,
        "Password": OPMS_PASSWORD,
        "CaptchaInput": captcha_text
    }
    if vs_match: payload["__VIEWSTATE"] = vs_match.group(1)
    if ev_match: payload["__EVENTVALIDATION"] = ev_match.group(1)

    # 3. Submit Login Form
    encoded_login_url = urllib.parse.quote(LOGIN_URL)
    post_api_url = f"https://api.scrape.do/?token={SCRAPEDO_TOKEN}&url={encoded_login_url}&geoCode=in&super=true"
    
    try:
        session.post(post_api_url, data=payload, timeout=60)
        logger.info("Login request submitted.")
    except Exception as e:
        logger.error(f"Login post error: {e}")
        return

    # 4. Fetch the Gate Entry Table with an extended 120-second timeout window and render=true
    logger.info("Fetching Gate Entry page with extended 120s browser render timeout...")
    gate_res = call_scrape_do(GATE_ENTRY_URL, render=True, timeout=120000)
    
    if not gate_res or gate_res.status_code != 200:
        logger.error(f"Failed to load Gate Entry page. Status: {gate_res.status_code if gate_res else 'None'}")
        return

    # Extract table rows using regex parsing
    row_matches = re.findall(r'<tr[^>]*>(.*?)</tr>', gate_res.text, re.DOTALL)
    all_records = []
    
    for row_html in row_matches:
        cols = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
        cols = [re.sub(r'<[^>]+>', '', c).strip() for c in cols]
        
        if len(cols) >= 11:
            wb_match = re.search(r'\((.*?)\s*:\s*(.*?)\s*:\s*(.*?)\)', cols[9])
            veh_no, waybill_no, waybill_date = (wb_match.group(1).strip(), wb_match.group(2).strip(), wb_match.group(3).strip()) if wb_match else (None, None, None)

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

    if all_records:
        save_to_database(all_records)
        logger.info(f"Successfully processed {len(all_records)} records via Scrape.do API.")
    else:
        logger.warning("No records parsed from the table HTML.")

if __name__ == "__main__":
    logger.info("Starting OPMS Scraper Service (Scrape.do API Mode)...")
    while True:
        run_scrape_cycle()
        logger.info(f"Sleeping for {SCRAPE_INTERVAL // 60} minutes...")
        time.sleep(SCRAPE_INTERVAL)