/**
 * Arduino Serial Bridge for Smart Cement Estimator IoT Dashboard
 * 
 * Usage:
 *   node scripts/arduino-serial-bridge.js [COM_PORT] [BAUD_RATE]
 *   Example: node scripts/arduino-serial-bridge.js COM3 115200
 * 
 * This script connects to physical Arduino/ESP32 via Serial Port (COM3, COM4, /dev/ttyUSB0, etc.)
 * and posts the real-time sensor packets directly into the web dashboard endpoint & local WebSocket server.
 */

const http = require("http");
const WebSocket = require("ws");

// Config
const COM_PORT = process.argv[2] || "COM3";
const BAUD_RATE = parseInt(process.argv[3] || "115200", 10);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://kungtmuunrixhzgpukpw.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bmd0bXV1bnJpeGh6Z3B1a3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4OTc4MDIsImV4cCI6MjEwMzQ3MzgwMn0.6o3Eny2BPf-r2lh8ra9yPBs1vKU6D9fX0w_5cbMKjEo";
const WS_PORT = 8081;

console.log("==================================================");
console.log("  Arduino Serial Bridge Server");
console.log("==================================================");
console.log(`Target Serial Port: ${COM_PORT}`);
console.log(`Baud Rate:         ${BAUD_RATE}`);
console.log(`WebSocket Server:  ws://localhost:${WS_PORT}`);
console.log(`Supabase Endpoint: ${SUPABASE_URL}/rest/v1/sensor_readings`);
console.log("--------------------------------------------------");

// Try loading serialport
let SerialPort;
try {
  SerialPort = require("serialport").SerialPort;
  const { ReadlineParser } = require("@serialport/parser-readline");

  const port = new SerialPort({ path: COM_PORT, baudRate: BAUD_RATE });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  port.on("open", () => {
    console.log(`[SERIAL] Connected to ${COM_PORT} at ${BAUD_RATE} baud.`);
  });

  port.on("error", (err) => {
    console.error(`[SERIAL ERROR] ${err.message}`);
    console.log("[SERIAL] Tip: Ensure serial monitor is closed in Arduino IDE so this bridge can access the port.");
  });

  parser.on("data", (line) => {
    console.log(`[ARDUINO SERIAL] ${line}`);
    processLine(line);
  });
} catch (e) {
  console.log("[INFO] Optional 'serialport' package not found locally. Running HTTP/WebSocket Bridge Mode.");
  console.log("[INFO] You can install serialport via: npm install serialport");
}

// Setup WebSocket Server for browser dashboard
const wss = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log(`[WS] Real-time WebSocket server active on ws://localhost:${WS_PORT}`);
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      return {
        temperature: Number(obj.temperature ?? obj.temp ?? 0),
        humidity: Number(obj.humidity ?? obj.hum ?? 0),
        moisture: Number(obj.moisture ?? obj.moist ?? 0),
        status: obj.status || (Number(obj.moisture) < 22 ? "WARNING" : "NORMAL"),
        created_at: new Date().toISOString()
      };
    } catch (e) {}
  }

  const tempMatch = trimmed.match(/(?:temp(?:erature)?|t)\s*[:=]\s*([\d.]+)/i);
  const humMatch = trimmed.match(/(?:hum(?:idity)?|h)\s*[:=]\s*([\d.]+)/i);
  const moistMatch = trimmed.match(/(?:moist(?:ure)?|m)\s*[:=]\s*([\d.]+)/i);

  if (tempMatch || humMatch || moistMatch) {
    const temp = tempMatch ? parseFloat(tempMatch[1]) : 0;
    const hum = humMatch ? parseFloat(humMatch[1]) : 0;
    const moist = moistMatch ? parseFloat(moistMatch[1]) : 0;

    return {
      temperature: temp,
      humidity: hum,
      moisture: moist,
      status: moist < 22 ? "WARNING" : "NORMAL",
      created_at: new Date().toISOString()
    };
  }

  return null;
}

async function processLine(line) {
  const parsed = parseLine(line);
  if (!parsed) return;

  console.log(`[PARSED ARDUINO TELEMETRY] Temp: ${parsed.temperature}°C | Humidity: ${parsed.humidity}% | Moisture: ${parsed.moisture}%`);

  // 1. Broadcast to WebSockets immediately
  broadcast(parsed);

  // 2. Post to Supabase REST API
  try {
    const body = JSON.stringify({
      project_id: "6d8142f1-d20f-457d-8670-b9f005f1b13a",
      temperature: parsed.temperature,
      humidity: parsed.humidity,
      moisture: parsed.moisture,
      status: parsed.status
    });

    fetch(`${SUPABASE_URL}/rest/v1/sensor_readings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body
    }).catch(() => {});
  } catch (e) {}
}
