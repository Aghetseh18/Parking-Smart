/*
 * ============================================================
 *  ESP32-CAM  —  BACK (EXIT) GATE  —  Parking Smart System
 * ============================================================
 *  ROLE: Triggered by the Back-Gate ESP32 via UART2.
 *        Captures a photo and POSTs it to the Node.js server.
 *        Reads the JSON response and replies SUCCESS / FAIL.
 *
 *  WIRING (ESP32-CAM side):
 *    GPIO4  (RX2) ← Back-Gate ESP32 GPIO17 (TX2 / CAM_TX)
 *    GPIO13 (TX2) → Back-Gate ESP32 GPIO16 (RX2 / CAM_RX)
 *    GND          ↔ Back-Gate ESP32 GND   (common ground!)
 *
 *  TRIGGER PROTOCOL (UART2, 115200 baud):
 *    BackGate → CAM : "TAKE_PHOTO\n"
 *    CAM  → BackGate: "SUCCESS\n"  — server approved exit (OPEN_GATE)
 *                     "FAIL\n"     — server denied  (DO_NOTHING / error)
 *
 *  SERVER ENDPOINT:
 *    POST http://<SERVER_IP>:3000/api/gate/exit/capture
 *    Body: multipart/form-data  field name = "image"
 *    Response JSON must contain "OPEN_GATE" to open the gate.
 * ============================================================
 *  Board: AI-Thinker ESP32-CAM
 * ============================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>

// ── UART2 ↔ Back-Gate ESP32 ────────────────────────────────────
// RX=GPIO4, TX=GPIO13  — must match back-gate wiring (CAM_RX=16, CAM_TX=17)
HardwareSerial CommSerial(2);

// ── Camera model ───────────────────────────────────────────────
#define CAMERA_MODEL_AI_THINKER
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ── User configuration ← edit these ──────────────────────────
const char* ssid      = "Blacktachi";
const char* password  = "111111111";
const char* serverUrl = "http://192.168.43.78:3000/api/gate/exit/capture";
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    // UART2: RX=GPIO4, TX=GPIO13 — matches back-gate wiring
    CommSerial.begin(115200, SERIAL_8N1, 4, 13);

    // ── WiFi ─────────────────────────────────────────────────
    WiFi.begin(ssid, password);
    Serial.print("[CAM-EXIT] Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\n[CAM-EXIT] WiFi connected. IP: " + WiFi.localIP().toString());

    // ── Camera init ──────────────────────────────────────────
    camera_config_t config;
    config.ledc_channel  = LEDC_CHANNEL_0;
    config.ledc_timer    = LEDC_TIMER_0;
    config.pin_d0        = Y2_GPIO_NUM;
    config.pin_d1        = Y3_GPIO_NUM;
    config.pin_d2        = Y4_GPIO_NUM;
    config.pin_d3        = Y5_GPIO_NUM;
    config.pin_d4        = Y6_GPIO_NUM;
    config.pin_d5        = Y7_GPIO_NUM;
    config.pin_d6        = Y8_GPIO_NUM;
    config.pin_d7        = Y9_GPIO_NUM;
    config.pin_xclk      = XCLK_GPIO_NUM;
    config.pin_pclk      = PCLK_GPIO_NUM;
    config.pin_vsync     = VSYNC_GPIO_NUM;
    config.pin_href      = HREF_GPIO_NUM;
    config.pin_sscb_sda  = SIOD_GPIO_NUM;
    config.pin_sscb_scl  = SIOC_GPIO_NUM;
    config.pin_pwdn      = PWDN_GPIO_NUM;
    config.pin_reset      = RESET_GPIO_NUM;
    config.xclk_freq_hz  = 20000000;
    config.pixel_format  = PIXFORMAT_JPEG;
    config.frame_size    = FRAMESIZE_SVGA;
    config.jpeg_quality  = 12;
    config.fb_count      = 1;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM-EXIT] Camera init FAILED: 0x%x\n", err);
        while (true) delay(1000);   // halt — check wiring / power
    }
    Serial.println("[CAM-EXIT] Camera ready. Waiting for TAKE_PHOTO on UART2…");
}

// ─────────────────────────────────────────────────────────────
void loop() {
    if (!CommSerial.available()) return;

    String command = CommSerial.readStringUntil('\n');
    command.trim();

    if (command != "TAKE_PHOTO") {
        Serial.printf("[CAM-EXIT] Ignored unknown command: '%s'\n", command.c_str());
        return;
    }

    Serial.println("[CAM-EXIT] TAKE_PHOTO — capturing…");

    // ── 1. Flush stale frame from hardware buffer (Fixes the "1 car lag")
    camera_fb_t* dummy_fb = esp_camera_fb_get();
    if (dummy_fb) {
        esp_camera_fb_return(dummy_fb); // Throw away the old picture
        delay(50); // Give sensor a tiny moment to grab a new live frame
    }

    // ── 2. Capture the actual real-time frame ────────────────
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[CAM-EXIT] Capture FAILED");
        CommSerial.println("FAIL");
        return;
    }
    Serial.printf("[CAM-EXIT] Photo: %u bytes — uploading…\n", fb->len);

    // ── 2. Reconnect WiFi if needed ──────────────────────────
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[CAM-EXIT] WiFi lost — reconnecting…");
        WiFi.reconnect();
        unsigned long t = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t < 8000) delay(300);
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[CAM-EXIT] Reconnect failed → FAIL");
            CommSerial.println("FAIL");
            esp_camera_fb_return(fb);
            return;
        }
        Serial.println("[CAM-EXIT] WiFi reconnected.");
    }

    // ── 3. POST image to server ──────────────────────────────
    HTTPClient http;
    http.begin(serverUrl);
    http.setTimeout(30000);   // 30 s — EasyOCR can be slow on first run

    const String boundary = "NextPostBoundary";
    http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

    String head =
        "--" + boundary + "\r\n"
        "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n"
        "Content-Type: image/jpeg\r\n\r\n";
    String tail = "\r\n--" + boundary + "--\r\n";

    size_t totalLen = head.length() + fb->len + tail.length();
    uint8_t* buf = (uint8_t*)malloc(totalLen);

    if (!buf) {
        Serial.println("[CAM-EXIT] malloc FAILED — heap too small");
        CommSerial.println("FAIL");
        esp_camera_fb_return(fb);
        http.end();
        return;
    }

    memcpy(buf,                             head.c_str(), head.length());
    memcpy(buf + head.length(),             fb->buf,      fb->len);
    memcpy(buf + head.length() + fb->len,   tail.c_str(), tail.length());

    int httpCode = http.POST(buf, totalLen);
    free(buf);
    esp_camera_fb_return(fb);

    // ── 4. Interpret response → reply to back-gate ESP32 ────
    if (httpCode == 200) {
        String payload = http.getString();
        Serial.printf("[CAM-EXIT] Server → %s\n", payload.c_str());

        // Server JSON must contain "OPEN_GATE" to allow exit
        if (payload.indexOf("OPEN_GATE") >= 0) {
            Serial.println("[CAM-EXIT] → SUCCESS (OPEN_GATE)");
            CommSerial.println("SUCCESS");
        } else {
            Serial.println("[CAM-EXIT] → FAIL (no OPEN_GATE — DO_NOTHING or denied)");
            CommSerial.println("FAIL");
        }
    } else {
        Serial.printf("[CAM-EXIT] HTTP error: %d  %s\n",
                      httpCode, http.errorToString(httpCode).c_str());
        CommSerial.println("FAIL");
    }

    http.end();
}
