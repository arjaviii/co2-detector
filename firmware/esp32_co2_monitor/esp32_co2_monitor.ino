#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_SGP30.h>
#include "DHT.h"
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ==========================================
// CONFIGURATION
// ==========================================
// Update with your home WiFi details:
const char* ssid = "Arjavi's A35";
const char* password = "Arjaviii";

// DHT22 Configuration
#define DHTPIN 4      // The GPIO pin you connected the DHT22 data line to
#define DHTTYPE DHT22 // Using DHT22
DHT dht(DHTPIN, DHTTYPE);

// SGP30 Configuration
Adafruit_SGP30 sgp;

// LCD Configuration (0x27 is common, or 0x3F)
// Parameters: address, columns, rows
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Web Server
WebServer server(80);

// Global Variables to hold sensor data
float currentTemp = 0.0;
float currentHumidity = 0.0;
uint16_t currentTVOC = 0;
uint16_t currentECO2 = 400; // Baseline 400ppm
bool sgpFound = false; // Tracks if SGP30 was detected on boot

// non-blocking timers
unsigned long lastSgpMeasurement = 0;
unsigned long lastDhtMeasurement = 0;
unsigned long lastLcdUpdate = 0;  // Added for LCD refresh

// ==========================================
// HTTP HANDLERS
// ==========================================
void handleData() {
  // Serial.println("Received /data request from backend!");
  
  // Create a JSON document
  StaticJsonDocument<200> jsonDoc;
  
  jsonDoc["temperature"] = currentTemp;
  jsonDoc["humidity"]    = currentHumidity;
  jsonDoc["eco2"]        = currentECO2;
  jsonDoc["tvoc"]        = currentTVOC;
  
  String jsonStr;
  serializeJson(jsonDoc, jsonStr);
  
  // Add CORS headers so frontend or backend can fetch easily
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", jsonStr);
}

void handleNotFound() {
  server.send(404, "text/plain", "Not found");
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // Explicitly set SDA to 21, SCL to 22

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Booting Monitor..");

  // Initialize DHT22
  dht.begin();
  
  // Initialize SGP30
  if (!sgp.begin(&Wire)){
    Serial.println("SGP30 sensor not found! Check SDA/SCL wiring.");
    lcd.setCursor(0, 1);
    lcd.print("SGP30 missing! ");
    sgpFound = false;
  } else {
    sgpFound = true;
    Serial.print("Found SGP30 serial #");
    Serial.print(sgp.serialnumber[0], HEX);
    Serial.print(sgp.serialnumber[1], HEX);
    Serial.println(sgp.serialnumber[2], HEX);

    // --- THE FIX: Hotplate Warmup Sequence ---
    Serial.println("SGP30 found! Warming up hotplate for 15 seconds...");
    lcd.setCursor(0, 1);
    lcd.print("Sensor Warmup...");
    
    for (int i = 0; i < 15; i++) {
        delay(1000);
        Serial.print(".");
        lcd.setCursor(14, 1);
        if (i % 2 == 0) lcd.print(".."); else lcd.print("  "); // Simple animation
    }
    Serial.println("\nWarmup complete. Starting measurements.");
    lcd.clear();
  }
  
  // Connect to Wi-Fi
  Serial.print("Connecting to ");
  Serial.println(ssid);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connecting");
  lcd.setCursor(0, 1);
  lcd.print(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int dots = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (dots > 15) {
      dots = 0;
      lcd.setCursor(0, 1);
      lcd.print("                ");
    }
    lcd.setCursor(dots, 1);
    lcd.print(".");
    dots++;
  }

  Serial.println("");
  Serial.println("WiFi connected.");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());

  // Show IP on LCD so user can type it into the Python backend / Frontend Config
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("IP Address:");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP().toString());

  // Setup Web Server Routes
  server.on("/data", HTTP_GET, handleData);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("HTTP server started");
}

// ==========================================
// LOOP
// ==========================================
void loop() {
  server.handleClient(); // Handle inbound HTTP requests

  // Update DHT every 2 seconds (DHT22 provides fresh data approximately every 2 seconds)
  if (millis() - lastDhtMeasurement >= 2000) {
    lastDhtMeasurement = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    
    // Check if valid read
    if (!isnan(t) && !isnan(h)) {
      currentTemp = t;
      currentHumidity = h;
    }
  }

  // Update SGP30 measurement once per second
  if (sgpFound && millis() - lastSgpMeasurement >= 1000) {
    lastSgpMeasurement = millis();
    
    // Perform measurement
    if (sgp.IAQmeasure()) {
      currentTVOC = sgp.TVOC;
      currentECO2 = sgp.eCO2;
    }
  }

  // Update LCD display every 2 seconds
  if (millis() - lastLcdUpdate >= 2000) {
    lastLcdUpdate = millis();
    
    // Row 1: Temp & Humidity
    lcd.setCursor(0, 0);
    lcd.print("T:"); lcd.print(currentTemp, 1); lcd.print("C "); 
    lcd.print("H:"); lcd.print(currentHumidity, 1); lcd.print("%   ");

    // Row 2: CO2 & TVOC
    lcd.setCursor(0, 1);
    if (sgpFound) {
      lcd.print("CO2:"); lcd.print(currentECO2); 
      lcd.print(" V:"); lcd.print(currentTVOC);
      lcd.print("     ");
    } else {
      lcd.print("SGP30 Error!    ");
    }
  }
}
