/*
 * ============================================================
 *  ESP32 MAIN  —  UART + CAMERA TEST
 * ============================================================
 *  Purpose : Test UART communication with the ESP32-CAM.
 *            Sends "TAKE_PHOTO" every 5 seconds and prints
 *            whatever the CAM replies ("SUCCESS" or "FAIL").
 *
 *  No LoRa, no MQTT, no servo, no ultrasonic — just UART.
 *
 *  WIRING:
 *    ESP32 GPIO16 (RX2)  ←  ESP32-CAM GPIO13 (TX)
 *    ESP32 GPIO17 (TX2)  →  ESP32-CAM GPIO4  (RX)
 *    ESP32 GND           ↔  ESP32-CAM GND   (shared!)
 *
 *  CAM sketch must be running with:
 *    CommSerial.begin(115200, SERIAL_8N1, 4, 13)
 *    Listening for "TAKE_PHOTO\n"
 *    Replying    "SUCCESS\n" or "FAIL\n"
 *
 *  Open Serial Monitor @ 115200 baud.
 * ============================================================
 */

#include <HardwareSerial.h>

// ── UART2 pins (match your wiring) ───────────────────────────
#define CAM_RX  16   // ESP32 RX2 ← ESP32-CAM GPIO13 (TX)
#define CAM_TX  17   // ESP32 TX2 → ESP32-CAM GPIO4  (RX)

HardwareSerial SerialCAM(2);   // UART2

// ── How often to fire a test shot ────────────────────────────
#define SEND_INTERVAL_MS  5000

// ─────────────────────────────────────────────────────────────
unsigned long lastSendMs = 0;
int           testCount  = 0;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n================================");
    Serial.println("  ESP32 MAIN  —  UART/CAM TEST");
    Serial.println("================================");
    Serial.println("Wiring check:");
    Serial.printf("  GPIO%d (RX2) ← ESP32-CAM GPIO13 (TX)\n", CAM_RX);
    Serial.printf("  GPIO%d (TX2) → ESP32-CAM GPIO4  (RX)\n", CAM_TX);
    Serial.println("  GND         ↔ ESP32-CAM GND\n");

    // UART2 @ 115200 — must match CommSerial.begin() in CAM sketch
    SerialCAM.begin(115200, SERIAL_8N1, CAM_RX, CAM_TX);

    Serial.printf("UART2 ready @ 115200 baud.\n");
    Serial.printf("Sending TAKE_PHOTO every %d s...\n\n", SEND_INTERVAL_MS / 1000);
}

void loop() {
    // ── Send TAKE_PHOTO on interval ───────────────────────────
    if (millis() - lastSendMs >= SEND_INTERVAL_MS) {
        lastSendMs = millis();
        testCount++;

        Serial.printf("─── Test #%d ─────────────────────────\n", testCount);
        Serial.println("TX → \"TAKE_PHOTO\"");
        SerialCAM.println("TAKE_PHOTO");
    }

    // ── Read any response from CAM (non-blocking) ─────────────
    while (SerialCAM.available()) {
        String resp = SerialCAM.readStringUntil('\n');
        resp.trim();

        if (resp.length() == 0) continue;

        Serial.printf("RX ← \"%s\"\n", resp.c_str());

        if (resp == "SUCCESS") {
            Serial.println("✓  CAM uploaded to server — gate would OPEN");
        } else if (resp == "FAIL") {
            Serial.println("✗  CAM upload failed or server rejected");
        } else {
            Serial.printf("?  Unknown response: '%s'\n", resp.c_str());
        }
        Serial.println();
    }
}
