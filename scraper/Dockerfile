# Use a Debian-based slim image (Crucial for Playwright dependencies)
FROM python:3.11-slim-bookworm

# Set the working directory
WORKDIR /app

# Update package lists so Playwright can find the dependencies it needs
RUN apt-get update && apt-get install -y wget gnupg

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and its specific system dependencies for Chromium
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy the rest of your scraper code
COPY . .

# Run the Python script
CMD ["python", "main.py"]