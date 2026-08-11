import os
import io
import google.generativeai as genai
from PIL import Image

# Configure Gemini with your free key
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def solve_captcha_with_gemini(captcha_bytes):
    """Solves an image CAPTCHA for free using Gemini Vision."""
    try:
        # Load captcha image from bytes
        image = Image.open(io.BytesIO(captcha_bytes))
        
        # Use Gemini 1.5 Flash (Free Tier)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = "Return ONLY the exact characters or numbers shown in this CAPTCHA image. Do not include spaces, quotes, punctuation, or explanations."
        
        response = model.generate_content([prompt, image])
        captcha_text = response.text.strip()
        print(f"[+] Gemini solved CAPTCHA: {captcha_text}")
        return captcha_text
    except Exception as e:
        print(f"[-] Gemini CAPTCHA solve error: {e}")
        return None

# --- Inside your Playwright login loop ---
# 1. Take a screenshot of the CAPTCHA element
captcha_element = page.locator("#captcha_img_id") # Adjust selector to match site
captcha_bytes = captcha_element.screenshot()

# 2. Get solved text from Gemini
captcha_code = solve_captcha_with_gemini(captcha_bytes)

# 3. Fill and submit
page.fill("#CaptchaInput", captcha_code) # Adjust selector
page.click("#LoginButton")