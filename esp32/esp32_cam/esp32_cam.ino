/*
 * ============================================================
 *  ESP32-CAM  —  ENTRY (FRONT) GATE  —  Parking Smart System
 * ============================================================
 *  ROLE: Triggered by the Main Entry ESP32 via UART2.
 *        Captures a photo and POSTs it to the Node.js server.
 *        Reads the HTTP response and replies to the gate ESP32.
 *
 *  WIRING (ESP32-CAM side):
 *    GPIO4  (RX2) ← ESP32-MAIN GPIO17 (CAM_TX)
 *    GPIO13 (TX2) → ESP32-MAIN GPIO16 (CAM_RX)
 *    GND          ↔ ESP32-MAIN GND   (common ground!)
 *
 *  TRIGGER PROTOCOL (UART2, 115200 baud):
 *    Main → CAM : "TAKE_PHOTO\n"
 *    CAM  → Main: "SUCCESS\n"  — plate found + authorised → gate opens
 *                 "FAIL\n"     — no plate / not authorised → gate stays closed
 *
 *  SERVER ENDPOINT:
 *    POST http://<SERVER_IP>:3000/api/gate/entry/capture   ← ENTRY endpoint
 *    Body: multipart/form-data  field name = "image"
 *    Response JSON field "action":
 *      "OPEN_GATE"  → SUCCESS (plate recognised, gate opens)
 *      "DO_NOTHING" → FAIL   (no plate detected / already inside)
 * ============================================================
 *  Board: AI-Thinker ESP32-CAM
 * ============================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>

// ── UART2 for communication with Main/Back ESP32 ──────────────
// RX=4, TX=13  (matches Main's CAM_RX=16←CAM, CAM_TX=17→CAM)
HardwareSerial CommSerial(2);

// ── Camera model ──────────────────────────────────────────────
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
const char* ssid       = "Blacktachi";
const char* password   = "111111111";

// ⚠️  ENTRY gate endpoint — DO NOT change to /exit/capture
const char* serverUrl  = "http://192.168.43.78:3000/api/gate/entry/capture";
// ─────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    // UART2: RX=GPIO4, TX=GPIO13 — must match wiring
    CommSerial.begin(115200, SERIAL_8N1, 4, 13);

    // ── WiFi ──────────────────────────────────────────────────
    WiFi.begin(ssid, password);
    Serial.print("[CAM] Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\n[CAM] WiFi connected. IP: " + WiFi.localIP().toString());

    // ── Camera init ───────────────────────────────────────────
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
    config.pin_reset     = RESET_GPIO_NUM;
    config.xclk_freq_hz  = 20000000;
    config.pixel_format  = PIXFORMAT_JPEG;
    config.frame_size    = FRAMESIZE_SVGA;
    config.jpeg_quality  = 12;
    config.fb_count      = 1;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] Camera init FAILED: 0x%x\n", err);
        while (true) delay(1000);  // halt — check wiring / power
    }
    Serial.println("[CAM] Camera ready. Waiting for TAKE_PHOTO on UART2…");
}

// ──────────────────────────────────────────────────────────────
//  LOOP — ESP32-CAM's only job:
//    1. Wait for "TAKE_PHOTO" via UART from Main ESP32
//    2. Capture photo
//    3. POST photo to server
//    4. If server says "OPEN_GATE"  → reply "SUCCESS" to Main ESP32
//       Anything else / error       → reply "FAIL"   to Main ESP32
//  That's it. All decisions are made by the server.
// ──────────────────────────────────────────────────────────────
void loop() {
    if (!CommSerial.available()) return;

    String command = CommSerial.readStringUntil('\n');
    command.trim();

    // ── Log every command received from Main ESP32 ─────────────
    Serial.println("\n┌─── UART RECEIVED (Main ESP32 → CAM) ──────");
    Serial.printf( "│ Command : '%s'\n", command.c_str());
    Serial.println("└───────────────────────────────────────────");

    if (command != "TAKE_PHOTO") {
        Serial.printf("[CAM] Ignored unknown command: '%s'\n", command.c_str());
        return;
    }

    Serial.println("[CAM] Taking photo…");

    // ── 1. Flush stale frame from hardware buffer (Fixes the "1 car lag")
    camera_fb_t* dummy_fb = esp_camera_fb_get();
    if (dummy_fb) {
        esp_camera_fb_return(dummy_fb); // Throw away the old picture
        delay(50); // Give sensor a tiny moment to grab a new live frame
    }

    // ── 2. Capture the actual real-time frame ────────────────
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[CAM] ❌ Capture FAILED");
        Serial.println("\n┌─── UART SENT (CAM → Main ESP32) ──────────");
        Serial.println("│ FAIL  (camera capture failed)");
        Serial.println("└───────────────────────────────────────────");
        CommSerial.println("FAIL");
        return;
    }
    Serial.printf("[CAM] ✓ Photo: %u bytes\n", fb->len);

    // ── 2. Reconnect WiFi if needed ───────────────────────────
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[CAM] WiFi lost — reconnecting…");
        WiFi.reconnect();
        unsigned long t = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t < 8000) delay(200);
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[CAM] ❌ WiFi reconnect failed");
            Serial.println("\n┌─── UART SENT (CAM → Main ESP32) ──────────");
            Serial.println("│ FAIL  (WiFi lost)");
            Serial.println("└───────────────────────────────────────────");
            CommSerial.println("FAIL");
            esp_camera_fb_return(fb);
            return;
        }
        Serial.println("[CAM] ✓ WiFi reconnected");
    }

    // ── 3. POST image to server ───────────────────────────────
    Serial.println("\n┌─── HTTP REQUEST (CAM → Server) ───────────");
    Serial.printf( "│ POST   : %s\n", serverUrl);
    Serial.printf( "│ Size   : %u bytes\n", fb->len);
    Serial.println("└───────────────────────────────────────────");

    HTTPClient http;
    http.begin(serverUrl);
    http.setTimeout(30000);   // 30 s — OCR can be slow on first run

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
        Serial.println("[CAM] ❌ malloc failed — heap too small");
        Serial.println("\n┌─── UART SENT (CAM → Main ESP32) ──────────");
        Serial.println("│ FAIL  (out of memory)");
        Serial.println("└───────────────────────────────────────────");
        CommSerial.println("FAIL");
        esp_camera_fb_return(fb);
        http.end();
        return;
    }

    memcpy(buf,                            head.c_str(), head.length());
    memcpy(buf + head.length(),            fb->buf,      fb->len);
    memcpy(buf + head.length() + fb->len,  tail.c_str(), tail.length());

    int httpCode = http.POST(buf, totalLen);
    free(buf);
    esp_camera_fb_return(fb);

    // ── 4. Read server response → report to Main ESP32 ────────
    Serial.println("\n┌─── HTTP RESPONSE (Server → CAM) ──────────");
    Serial.printf( "│ Code   : %d\n", httpCode);

    if (httpCode == 200) {
        String body = http.getString();
        Serial.printf("│ Body   : %s\n", body.c_str());
        Serial.println("└───────────────────────────────────────────");

        // Server says OPEN_GATE → SUCCESS, everything else → FAIL
        if (body.indexOf("OPEN_GATE") >= 0) {
            Serial.println("\n┌─── UART SENT (CAM → Main ESP32) ──────────");
            Serial.println("│ SUCCESS  (server approved — OPEN_GATE)");
            Serial.println("└───────────────────────────────────────────");
            CommSerial.println("SUCCESS");
        } else {
            Serial.println("\n┌─── UART SENT (CAM → Main ESP32) ──────────");
            Serial.println("│ FAIL     (server did not send OPEN_GATE)");
            Serial.println("└───────────────────────────────────────────");
            CommSerial.println("FAIL");
        }

    } else {
        Serial.printf("│ Error  : %s\n", http.errorToString(httpCode).c_str());
        Serial.println("└───────────────────────────────────────────");
        Serial.println("\n┌─── UART SENT (CAM → Main ESP32) ──────────");
        Serial.println("│ FAIL     (HTTP error / server unreachable)");
        Serial.println("└───────────────────────────────────────────");
        CommSerial.println("FAIL");
    }

    http.end();
}

