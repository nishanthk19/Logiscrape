import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Memory database for preview
  let truckEntries = [
    { id: 1, transaction_id: "G-29402", license_plate: "ABC-1234", driver_name: "Robert Miller", mill_destination: "Mill A - North Row", gate_status: "Approved", tonnage: 34.2, entry_timestamp: new Date(Date.now() - 2 * 60000).toISOString() },
    { id: 2, transaction_id: "G-29401", license_plate: "XYZ-8821", driver_name: "Samuel Owens", mill_destination: "Mill B - Silo 2", gate_status: "Processing", tonnage: 28.1, entry_timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
    { id: 3, transaction_id: "G-29400", license_plate: "TRK-0092", driver_name: "Daniel Chen", mill_destination: "Mill A - North Row", gate_status: "Approved", tonnage: 41.0, entry_timestamp: new Date(Date.now() - 12 * 60000).toISOString() },
    { id: 4, transaction_id: "G-29399", license_plate: "PLC-4450", driver_name: "Marcus Wright", mill_destination: "Mill C - Storage", gate_status: "Rejected", tonnage: 19.5, entry_timestamp: new Date(Date.now() - 18 * 60000).toISOString() },
    { id: 5, transaction_id: "G-29398", license_plate: "JKT-2211", driver_name: "Laura Smith", mill_destination: "Mill B - Silo 1", gate_status: "Approved", tonnage: 36.8, entry_timestamp: new Date(Date.now() - 25 * 60000).toISOString() },
    { id: 6, transaction_id: "G-29397", license_plate: "KMT-9012", driver_name: "Kevin Vance", mill_destination: "Mill A - Grain Elevator", gate_status: "Approved", tonnage: 31.4, entry_timestamp: new Date(Date.now() - 32 * 60000).toISOString() },
    { id: 7, transaction_id: "G-29396", license_plate: "WXX-3100", driver_name: "Elena Rostova", mill_destination: "Mill C - Storage", gate_status: "Pending", tonnage: 27.9, entry_timestamp: new Date(Date.now() - 40 * 60000).toISOString() },
    { id: 8, transaction_id: "G-29395", license_plate: "LMN-5544", driver_name: "Tariq Ahmad", mill_destination: "Mill B - Silo 2", gate_status: "Approved", tonnage: 38.0, entry_timestamp: new Date(Date.now() - 48 * 60000).toISOString() }
  ];

  let scraperLogs = [
    { id: 1, status: "SUCCESS", items_scraped: 8, message: "Scraped and updated 8 truck records from OPMS portal", timestamp: new Date().toISOString() }
  ];

  // API Endpoints

  // 1. Get Trucks
  app.get("/api/trucks", (req, res) => {
    const { search, mill, status } = req.query;
    let filtered = [...truckEntries];

    if (search && typeof search === "string" && search.trim() !== "") {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        item =>
          item.transaction_id.toLowerCase().includes(q) ||
          item.license_plate.toLowerCase().includes(q) ||
          item.driver_name.toLowerCase().includes(q)
      );
    }

    if (mill && typeof mill === "string" && mill !== "All") {
      filtered = filtered.filter(item => item.mill_destination.includes(mill));
    }

    if (status && typeof status === "string" && status !== "All") {
      filtered = filtered.filter(item => item.gate_status.toLowerCase() === status.toLowerCase());
    }

    res.json({
      success: true,
      data: filtered,
      total: filtered.length
    });
  });

  // 2. Get Statistics
  app.get("/api/trucks/stats", (req, res) => {
    const totalCount = 1480 + truckEntries.length;
    const activeCount = truckEntries.filter(i => ["Processing", "Pending"].includes(i.gate_status)).length + 38;

    res.json({
      success: true,
      totalTrucksToday: totalCount,
      activeEntries: activeCount,
      avgProcessingTimeMinutes: 4.2,
      millBreakdown: [
        { mill_destination: "Mill A - North Row", count: 888, percentage: 60 },
        { mill_destination: "Mill B - Silo 2", count: 370, percentage: 25 },
        { mill_destination: "Mill C - Storage", count: 222, percentage: 15 }
      ],
      statusBreakdown: [
        { gate_status: "Approved", count: 1240 },
        { gate_status: "Processing", count: 42 },
        { gate_status: "Pending", count: 12 },
        { gate_status: "Rejected", count: 8 }
      ]
    });
  });

  // 3. Log New Entry
  app.post("/api/trucks", (req, res) => {
    const { transaction_id, license_plate, driver_name, mill_destination, gate_status, tonnage } = req.body;
    const newEntry = {
      id: Date.now(),
      transaction_id: transaction_id || `G-${Math.floor(29400 + Math.random() * 900)}`,
      license_plate: license_plate || "NEW-1234",
      driver_name: driver_name || "Assigned Driver",
      mill_destination: mill_destination || "Mill A - North Row",
      gate_status: gate_status || "Approved",
      tonnage: parseFloat(tonnage) || 32.5,
      entry_timestamp: new Date().toISOString()
    };

    truckEntries.unshift(newEntry);
    res.json({ success: true, entry: newEntry });
  });

  // 4. Trigger Scraper Run
  app.post("/api/scraper/trigger", (req, res) => {
    const itemsScraped = Math.floor(Math.random() * 4) + 4;
    
    // Add realistic scraped entries
    const sampleDrivers = ["Alex Rivera", "Jason Brody", "Carlos Santana", "Hassan Ali", "David Miller", "Sophie Vance"];
    const sampleMills = ["Mill A - North Row", "Mill B - Silo 2", "Mill C - Storage"];
    const samplePlates = ["MKT-4410", "GAT-9081", "BKP-3320", "ZXR-1102", "LPT-5529"];

    for (let i = 0; i < 2; i++) {
      truckEntries.unshift({
        id: Date.now() + i,
        transaction_id: `G-${Math.floor(29410 + Math.random() * 500)}`,
        license_plate: samplePlates[Math.floor(Math.random() * samplePlates.length)],
        driver_name: sampleDrivers[Math.floor(Math.random() * sampleDrivers.length)],
        mill_destination: sampleMills[Math.floor(Math.random() * sampleMills.length)],
        gate_status: "Approved",
        tonnage: parseFloat((24 + Math.random() * 18).toFixed(1)),
        entry_timestamp: new Date().toISOString()
      });
    }

    const log = {
      id: Date.now(),
      status: "SUCCESS",
      items_scraped: itemsScraped,
      message: `Scraped OPMS government portal: Solved 2Captcha ('7X9KA'), logged in as OPMS_USERNAME, extracted ${itemsScraped} rows and synchronized with PostgreSQL.`,
      timestamp: new Date().toISOString()
    };

    scraperLogs.unshift(log);

    res.json({
      success: true,
      message: "Scraper execution complete.",
      log
    });
  });

  // 5. Get Scraper Logs
  app.get("/api/scraper/logs", (req, res) => {
    res.json({ success: true, logs: scraperLogs });
  });

  // 6. Get Codebase Files for Explorer
  app.get("/api/files", (req, res) => {
    const fileList = [
      { path: "docker-compose.yml", name: "docker-compose.yml", folder: "Root Architecture" },
      { path: "scraper/Dockerfile", name: "Dockerfile", folder: "scraper/" },
      { path: "scraper/requirements.txt", name: "requirements.txt", folder: "scraper/" },
      { path: "scraper/main.py", name: "main.py", folder: "scraper/" },
      { path: "api/Dockerfile", name: "Dockerfile", folder: "api/" },
      { path: "api/package.json", name: "package.json", folder: "api/" },
      { path: "api/server.js", name: "server.js", folder: "api/" },
      { path: "api/public/index.html", name: "index.html", folder: "api/public/" },
      { path: "README.md", name: "README.md", folder: "Documentation" }
    ];

    const result = fileList.map(f => {
      let content = "";
      try {
        content = fs.readFileSync(path.join(process.cwd(), f.path), "utf-8");
      } catch (err) {
        content = "// File content unavailable";
      }
      return { ...f, content };
    });

    res.json({ success: true, files: result });
  });

  // Vite Middleware integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Logistics Gate Portal] Running on http://localhost:${PORT}`);
  });
}

startServer();
