# Automated OPMS Truck Gate Entry Scraper & Dashboard Microservice

Complete production-ready microservice architecture for scraping truck gate entry records from the government portal (OPMS), storing them in PostgreSQL 15, and serving a real-time analytics dashboard.

## 🏗️ Architecture Overview

```
                          ┌───────────────────────────┐
                          │  OPMS Government Portal  │
                          └─────────────┬─────────────┘
                                        │
                                        │ Playwright Headless Chromium
                                        │ 2Captcha API Solving
                                        ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│   PostgreSQL 15  │◄──────────┤  Python Scraper  │           │   Node.js API &  │
│     Database     │           │   (Playwright)   │           │   HTML Dashboard │
│   Port: 5432     ├───────────┴──────────────────┴──────────►│   Port: 3000     │
└──────────────────┘                                          └──────────────────┘
```

1. **PostgreSQL 15 Container**: Database engine storing gate transactions (`truck_entries`) and scraper run history (`scraper_logs`).
2. **Python/Playwright Scraper Container**: Autonomous Python script executing every 15 minutes. Connects to `OPMS_URL`, extracts base64 CAPTCHA, posts to 2Captcha API, solves login challenge, scrapes gate entry table, and upserts data into PostgreSQL.
3. **Node.js Express API Container**: Exposes REST endpoints (`GET /api/trucks`, `GET /api/trucks/stats`, `POST /api/scraper/trigger`) and serves the responsive Tailwind CSS dashboard.

---

## 🚀 Quick Start (Docker Compose)

### 1. Clone & Configure Environment Variables
Create a `.env` file at the root:

```env
# Database Credentials
DB_NAME=truck_gate_db
DB_USER=postgres
DB_PASSWORD=postgres_password_123

# OPMS Portal Credentials
OPMS_USERNAME=admin_gate
OPMS_PASSWORD=SecretPass123!
PORTAL_URL=https://opms.gov.example/login

# 2Captcha Service Key
CAPTCHA_KEY=your_2captcha_api_key_here

# Scraper Interval
SCRAPE_INTERVAL_MINUTES=15
```

### 2. Launch the Microservices Stack
```bash
docker-compose up --build -d
```

### 3. Access Dashboard & API
- **Web Dashboard**: `http://localhost:3000`
- **Truck Gate Entries API**: `http://localhost:3000/api/trucks`
- **KPI Statistics API**: `http://localhost:3000/api/trucks/stats`
- **Health Check**: `http://localhost:3000/health`

---

## 📂 Project Structure

- `docker-compose.yml` - Root orchestration file for Postgres, Scraper, and API services.
- `scraper/`
  - `Dockerfile` - Python 3.11 container with Playwright & Chromium dependencies.
  - `requirements.txt` - Python libraries (`playwright`, `requests`, `psycopg2-binary`).
  - `main.py` - Core scraping script with 2Captcha API integration & Postgres upsert.
- `api/`
  - `Dockerfile` - Node.js 18 container.
  - `package.json` - Node dependencies (`express`, `pg`, `cors`).
  - `server.js` - Express API server with PostgreSQL connection pool.
  - `public/index.html` - Professional Tailwind CSS dashboard UI.
