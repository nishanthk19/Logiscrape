FROM python:3.11-slim

# Install system packages required by Playwright headless browser
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    curl \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirement specifications and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser binaries (Chromium)
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy Python scraper script
COPY main.py .

CMD ["python", "-u", "main.py"]
