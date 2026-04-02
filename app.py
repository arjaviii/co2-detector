from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import logging

app = Flask(__name__)
# Enable Cross-Origin Resource Sharing so the frontend can fetch from this API
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)

@app.route('/api/data', methods=['GET'])
def get_sensor_data():
    """
    This endpoint is called by the frontend (HTML/JS).
    It fetches the actual sensor data from the ESP32 and returns it.
    """
    # We accept the ESP32 IP from the frontend query parameters.
    # e.g., http://localhost:5000/api/data?ip=192.168.1.100
    esp32_ip = request.args.get('ip', '10.51.67.63')
    esp_url = f"http://{esp32_ip}/data"

    try:
        # Request data from ESP32 firmware
        # Expected ESP32 JSON: {"temperature": 24.5, "humidity": 45.2, "eco2": 450, "tvoc": 120}
        app.logger.info(f"Fetching data from ESP32 at {esp_url}...")
        response = requests.get(esp_url, timeout=3)
        response.raise_for_status() # Raise exception for bad HTTP status codes
        
        # Parse JSON from ESP32 and send it to the frontend
        data = response.json()
        return jsonify(data), 200

    except requests.exceptions.Timeout:
        app.logger.error("Connection to ESP32 timed out.")
        return jsonify({"error": "Timeout", "message": "Could not reach ESP32"}), 504
        
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error connecting to ESP32: {e}")
        return jsonify({"error": "Connection Error", "message": str(e)}), 502

if __name__ == '__main__':
    # Run the Flask API on port 5000
    print(" Starting Flask API Backend for CO2 Monitor...")
    app.run(host='0.0.0.0', port=5000, debug=True)