# ESP32 CO2 Monitor Setup Guide

This folder contains the `.ino` sketch needed to flash your ESP32 so that it communicates with your `app.py` Flask backend.

## 1. Hardware Wiring

Ensure your breadboard setup follows the below pinout, which takes advantage of your MB102 Breadboard Power Supply Unit (PSU).

### Power Distribution (MB102 Breadboard PSU)
*   **Left Rail Jumper:** Set to **5V**.
*   **Right Rail Jumper:** Set to **3.3V**.
*   **Common Ground:** Run a jumper wire from the left ground rail (blue line) to the right ground rail (blue line). 
*   **ESP32 Power:** Connect the ESP32 to your laptop via Micro-USB. Connect one of the ESP32's **GND** pins to the shared ground rail on the breadboard.

### Sensor and Screen Wiring

| Sensor | Power (VCC/VIN) | Ground | Data Pins | Details |
|--------|-----------------|--------|-----------|---------|
| **SGP30**  | 3.3V Rail | Common Ground | `SDA` → D21<br>`SCL` → D22 | TVOC / CO2 gas sensor. |
| **DHT22**  | 3.3V Rail | Common Ground | `DATA` → D4 | Temperature and Humidity sensor. Leave Pin 3 (NC) empty. |
| **I2C LCD**| 5V Rail | Common Ground | `SDA` → D21<br>`SCL` → D22 | LCD display for showing the assigned IP Address. Required 5V for backlight and logic. |

> **Note on the DHT22**: Both the SGP30 and the LCD share the **same I2C pins** (D21, D22). If you have the bare 4-pin DHT22 sensor (just the white plastic grid, no mini circuit board underneath), you must place a 10kΩ resistor bridging **Pin 1 (VCC)** and **Pin 2 (DATA)** on your breadboard. If your sensor is a 3-pin module mounted on a small PCB, that pull-up resistor is already built-in.

## 2. Software Prerequisites

Before flashing the code, ensure you have the Arduino IDE and ESP32 board support installed.

1. Download and install [Arduino IDE](https://www.arduino.cc/en/software) if you haven't already.
2. Go to `File` > `Preferences` in Arduino IDE.
3. In the **Additional Boards Manager URLs** field, paste:
   `https://dl.espressif.com/dl/package_esp32_index.json`
4. Go to `Tools` > `Board` > `Boards Manager...`
5. Search for `esp32` and install the package by Espressif Systems.
6. Select your ESP32 Board from `Tools` > `Board` > `ESP32 Arduino` (usually **DOIT ESP32 DEVKIT V1** or **ESP32 Dev Module**).

## 3. Install Required Libraries

In the Arduino IDE, go to `Sketch` > `Include Library` > `Manage Libraries...`
Search for and install the following:

- **LiquidCrystal I2C** (by Frank de Brabander or Marco Schwartz)
- **DHT sensor library** (by Adafruit)
  - Also install the dependency: **Adafruit Unified Sensor**
- **Adafruit SGP30 Sensor** (by Adafruit)
- **ArduinoJson** (by Benoit Blanchon)

## 4. Flash the Firmware

1. Open `esp32_co2_monitor/esp32_co2_monitor.ino` in the Arduino IDE.
2. Edit the configuration section at the top of the file to include your **Home WiFi Credentials**:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Connect your ESP32 via USB and select the correct `COM` Port under `Tools` > `Port`.
4. Hit the **Upload** button (the right arrow ->).
5. Once uploading finishes, open the **Serial Monitor** (magnifying glass, top right) and set the baud rate to `115200`.
6. Watch the ESP32 connect to your network. 

## 5. View your application

As soon as the WiFi connects, the ESP32 will display its **IP Address** on the LCD screen, and on the Serial Monitor (e.g., `192.168.1.55`).

Once you see the IP on the screen, your ESP32 is acting as a web server, streaming SGP30 and DHT22 data as JSON!

In your browser, visit the frontend webpage, or connect to your local Flask backend referencing the ESP32 IP, for example:
```
http://localhost:5000/api/data?ip=192.168.1.55
```
