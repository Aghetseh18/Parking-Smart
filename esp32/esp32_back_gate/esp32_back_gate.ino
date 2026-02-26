/*
 * ============================================================
 *  ESP32 BACK (EXIT GATE) -- Parking Smart System
 * ============================================================
 *  ROLE:
 *   • Monitors HC-SR04 ultrasonic sensor for departing cars.
 *   • Triggers ESP32-CAM via UART; waits for server OCR result.
 *   • Controls servo gate + RGB LED + buzzer on result.
 *   • Uses LoRa (SX1276/SX1278) to communicate with the ENTRY
 *     GATE ESP32 for real-time parking spot count sync.
 *   • Connects to WiFi + MQTT broker (broker.emqx.io).
 *     Subscribes to server gate commands; publishes status events.
 *
 *  MQTT TOPICS (must match server .env):
 *   SUB  parking/gate/command  ← server sends {action:"OPEN"|"DENY"}
 *   PUB  parking/gate/status   → ESP32 sends gate event + spot count
 *
 *  LoRa PROTOCOL (JSON packets, 433 MHz — same as entry gate):
 *   BACK  → ENTRY: { "cmd":"EXIT_OPEN",  "spots":<n> }
 *                  Car exited → entry gate increments spots.
 *   ENTRY → BACK:  { "cmd":"ENTRY_OPEN", "spots":<n> }
 *                  Entry gate reports car entered → decrement spots.
 *   ENTRY → BACK:  { "cmd":"SYNC_COUNT", "spots":<n> }
 *                  Periodic heartbeat / manual sync from entry gate.
 *
 *  PIN DEFINITIONS (DO NOT CHANGE unless re-wired):
 * ┌──────────────────┬──────────────────────────────────────────┐
 * │ #define          │ GPIO │ Component                         │
 * ├──────────────────┼──────┼───────────────────────────────────┤
 * │ TRIG_PIN         │  32  │ HC-SR04 Trigger                   │
 * │ ECHO_PIN         │  34  │ HC-SR04 Echo   (input-only pin)   │
 * │ LORA_SCK         │  18  │ LoRa SPI Clock                    │
 * │ LORA_MISO        │  19  │ LoRa SPI MISO                     │
 * │ LORA_MOSI        │  22  │ LoRa SPI MOSI                     │
 * │ LORA_CS          │  23  │ LoRa Chip Select                  │
 * │ LORA_RST         │   5  │ LoRa Reset                        │
 * │ LORA_DIO0        │  21  │ LoRa IRQ / DIO0                   │
 * │ RED_PIN          │  12  │ RGB LED – Red channel             │
 * │ GREEN_PIN        │  14  │ RGB LED – Green channel           │
 * │ BLUE_PIN         │  27  │ RGB LED – Blue channel            │
 * │ SERVO_PIN        │  26  │ Servo signal                      │
 * │ BUZZER_PIN       │  13  │ Buzzer                            │
 * │ I2C_SDA          │  33  │ LCD SDA                           │
 * │ I2C_SCL          │  25  │ LCD SCL                           │
 * │ CAM_RX           │  16  │ UART2 RX ← ESP32-CAM GPIO13 (TX) │
 * │ CAM_TX           │  17  │ UART2 TX → ESP32-CAM GPIO4  (RX) │
 * └──────────────────┴──────┴───────────────────────────────────┘
 *
 *  ⚠️  GPIO34 is INPUT-ONLY on ESP32 — perfect for echo, no pull.
 *  ⚠️  Common GND between BOTH ESP32 boards (UART) and LoRa module.
 *
 *  LIBRARIES (install via Arduino Library Manager):
 *   • ESP32Servo        — servo control
 *   • LoRa              — by Sandeep Mistry  (search "LoRa")
 *   • ArduinoJson       — JSON encode/decode (search "ArduinoJson")
 *   • LiquidCrystal_I2C — by Frank de Brabander (search "LiquidCrystal I2C")
 *   • PubSubClient      — by Nick O'Leary      (search "PubSubClient")
 * ============================================================
 */

#include <SPI.h>
#include <LoRa.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ─────────────────────────────────────────────
//  PIN MAP
// ─────────────────────────────────────────────
#define TRIG_PIN    32
#define ECHO_PIN    34   // input-only GPIO — no OUTPUT
#define LORA_SCK    18
#define LORA_MISO   19
#define LORA_MOSI   22
#define LORA_CS     23
#define LORA_RST     5
#define LORA_DIO0   21
#define RED_PIN     12
#define GREEN_PIN   14
#define BLUE_PIN    27
#define SERVO_PIN   26
#define BUZZER_PIN  13
#define I2C_SDA     33
#define I2C_SCL     25
#define CAM_RX      16   // ← ESP32-CAM GPIO13 (TX)
#define CAM_TX      17   // → ESP32-CAM GPIO4  (RX)

// ─────────────────────────────────────────────
//  WiFi + MQTT CONFIGURATION  ← edit these
// ─────────────────────────────────────────────
const char* WIFI_SSID       = "Blacktachi";
const char* WIFI_PASSWORD   = "111111111";

const char* MQTT_BROKER     = "broker.emqx.io";
const int   MQTT_PORT       = 1883;
const char* MQTT_CLIENT_ID  = "parking_exit_gate";   // ← different from entry gate!

const char* MQTT_SUB_TOPIC  = "parking/gate/command";
const char* MQTT_PUB_TOPIC  = "parking/gate/status";

const unsigned long MQTT_RECONNECT_MS = 5000;

// ─────────────────────────────────────────────
//  LoRa CONFIGURATION
// ─────────────────────────────────────────────
#define LORA_FREQUENCY  433E6   // must match entry gate
#define LORA_SYNC_WORD  0xAB   // must match entry gate

// ─────────────────────────────────────────────
//  TUNABLE PARAMETERS
// ─────────────────────────────────────────────
const float         DETECT_DISTANCE_CM      = 5.0;
const int           SERVO_CLOSED_ANGLE      = 0;    // gate closed  — 0°
const int           SERVO_OPEN_ANGLE        = 90;   // gate fully open — 90°
const unsigned long GATE_OPEN_DURATION_MS   = 5000;
const unsigned long DENY_FEEDBACK_MS        = 3000;
const unsigned long COOLDOWN_MS             = 4000;
const unsigned long CAM_RESPONSE_TIMEOUT_MS = 20000;
const int           MAX_SPOTS               = 7;

// ─────────────────────────────────────────────
//  LCD CONFIG
// ─────────────────────────────────────────────
#define LCD_ADDR  0x27
#define LCD_COLS  16
#define LCD_ROWS   2

// ─────────────────────────────────────────────
//  GLOBALS
// ─────────────────────────────────────────────
Servo               gateServo;
HardwareSerial      SerialCAM(2);   // UART2 ↔ ESP32-CAM
LiquidCrystal_I2C   lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
WiFiClient          wifiClient;
PubSubClient        mqttClient(wifiClient);

int           availableSpots    = MAX_SPOTS;
unsigned long lastMqttRetry     = 0;
bool          mqttSyncPending   = false;   // set when server sends SYNC_SPOTS
int           pendingSyncSpots  = -1;      // authoritative spot count from server
bool          noPlateHint       = false;   // set by MQTT NO_PLATE — LCD display only

// ── MQTT gate control flags (set in callback, consumed in TRIGGERED) ──
bool          mqttGateOpen       = false;      // server says: OPEN_EXIT
bool          mqttGateDeny       = false;      // server says: DENY_EXIT

// ── Non-blocking sensor state machine ────────────────────────
enum GateState { IDLE, TRIGGERED, COOLDOWN };
GateState     gateState        = IDLE;
unsigned long cooldownStartMs  = 0;
unsigned long lastLcdUpdateMs  = 0;
unsigned long triggeredStartMs = 0;

// ──────────────────────────────────────────────────────────────
//  LCD HELPER
// ──────────────────────────────────────────────────────────────
void lcdPrint(const char* row0, const char* row1 = "") {
    lcd.setCursor(0, 0);
    char buf[LCD_COLS + 1];
    snprintf(buf, sizeof(buf), "%-16s", row0);
    lcd.print(buf);
    lcd.setCursor(0, 1);
    snprintf(buf, sizeof(buf), "%-16s", row1);
    lcd.print(buf);
}

// ──────────────────────────────────────────────────────────────
//  Forward declarations
// ──────────────────────────────────────────────────────────────
void handleOpenGate();
void handleDeny(bool lotFull);

// ──────────────────────────────────────────────────────────────
//  MQTT CALLBACK
// ──────────────────────────────────────────────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String raw;
    for (unsigned int i = 0; i < length; i++) raw += (char)payload[i];

    Serial.println("\n┌─── MQTT RECEIVED ─────────────────────────");
    Serial.printf( "│ Topic  : %s\n", topic);
    Serial.printf( "│ Payload: %s\n", raw.c_str());

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, raw);
    if (err) {
        Serial.printf("│ ERROR  : JSON parse failed — %s\n", err.c_str());
        Serial.println("└───────────────────────────────────────────");
        return;
    }

    const char* action = doc["action"]      | "(none)";
    const char* type   = doc["type"]        | "";
    const char* plate  = doc["plateNumber"] | "";
    const char* msg    = doc["message"]     | "";

    Serial.printf("│ action : %s\n", action);
    if (strlen(type)  > 0) Serial.printf("│ type   : %s\n", type);
    if (strlen(plate) > 0) Serial.printf("│ plate  : %s\n", plate);
    if (strlen(msg)   > 0) Serial.printf("│ message: %s\n", msg);

    // ── OPEN_EXIT — server approved entry, turn servo ───────────────────────
    if (strcmp(action, "OPEN_EXIT") == 0) {
        if (gateState == TRIGGERED) {
            mqttGateOpen = true;
            Serial.println("│ → OPEN_EXIT: Servo WILL turn next loop iteration");
        } else {
            Serial.printf("│ → OPEN_EXIT received but NOT in TRIGGERED state (state=%d) — discarded\n", (int)gateState);
        }

    // ── DENY_EXIT — server rejected entry, gate stays closed ───────────────
    } else if (strcmp(action, "DENY_EXIT") == 0) {
        if (gateState == TRIGGERED) {
            mqttGateDeny = true;
            Serial.println("│ → DENY_EXIT: Gate will stay closed next loop iteration");
        } else {
            Serial.printf("│ → DENY_EXIT received but NOT in TRIGGERED state (state=%d) — discarded\n", (int)gateState);
        }

    // ── Gate is UART-only: only act on SYNC_SPOTS or NO_PLATE display hint ─
    } else if (strcmp(action, "SYNC_SPOTS") == 0) {
        int spots = doc["spots"] | -1;
        if (spots >= 0) {
            pendingSyncSpots = spots;
            mqttSyncPending  = true;
            Serial.printf("│ → SYNC_SPOTS: will apply %d spots next loop\n", spots);
        }
    } else if (strcmp(action, "NO_PLATE") == 0) {
        noPlateHint = true;
        Serial.println("│ → NO_PLATE hint set (LCD will show 'No Plate Number' on next WAIT)");
    } else {
        Serial.printf("│ → INFO / Unhandled Action: %s\n", action);
    }
    Serial.println("└───────────────────────────────────────────");
}

// ──────────────────────────────────────────────────────────────
//  Publish status to MQTT
// ──────────────────────────────────────────────────────────────
void publishMQTTStatus(const char* event, int spots) {
    if (!mqttClient.connected()) {
        Serial.printf("[MQTT] TX skipped — not connected (event: %s)\n", event);
        return;
    }
    

    StaticJsonDocument<128> doc;
    doc["event"] = event;
    doc["spots"] = spots;
    doc["gate"]  = "exit";   // ← EXIT gate identifier

    char buf[128];
    serializeJson(doc, buf);
    mqttClient.publish(MQTT_PUB_TOPIC, buf);

    Serial.println("\n┌─── MQTT SENT ─────────────────────────────");
    Serial.printf( "│ Topic  : %s\n", MQTT_PUB_TOPIC);
    Serial.printf( "│ event  : %s\n", event);
    Serial.printf( "│ spots  : %d/%d\n", spots, MAX_SPOTS);
    Serial.printf( "│ gate   : exit\n");
    Serial.printf( "│ JSON   : %s\n", buf);
    Serial.println("└───────────────────────────────────────────");
}

// ──────────────────────────────────────────────────────────────
//  WiFi connection
// ──────────────────────────────────────────────────────────────
void connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;
    Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
    lcdPrint("Connecting WiFi", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) {
        delay(400);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected — IP: %s\n",
                      WiFi.localIP().toString().c_str());
        lcdPrint("WiFi Connected!", WiFi.localIP().toString().c_str());
        delay(800);
    } else {
        Serial.println("\n[WiFi] FAILED — no WiFi. MQTT disabled.");
        lcdPrint("WiFi FAILED!", "MQTT disabled");
        delay(1000);
    }
}

// ──────────────────────────────────────────────────────────────
//  MQTT connect / reconnect
// ──────────────────────────────────────────────────────────────
void connectMQTT() {
    if (WiFi.status() != WL_CONNECTED) return;
    if (mqttClient.connected()) return;
    if (millis() - lastMqttRetry < MQTT_RECONNECT_MS) return;
    lastMqttRetry = millis();

    Serial.printf("[MQTT] Connecting to %s:%d… ", MQTT_BROKER, MQTT_PORT);
    lcdPrint("MQTT connecting", MQTT_BROKER);

    if (mqttClient.connect(MQTT_CLIENT_ID)) {
        Serial.println("OK");
        lcdPrint("MQTT Connected!", "");
        delay(600);
        mqttClient.subscribe(MQTT_SUB_TOPIC);
        Serial.printf("[MQTT] Subscribed to %s\n", MQTT_SUB_TOPIC);
        publishMQTTStatus("GATE_ONLINE", availableSpots);
        char spotLine[17];
        snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
        lcdPrint("   EXIT  GATE  ", spotLine);
    } else {
        Serial.printf("FAILED (rc=%d) — retry in %lu s\n",
                      mqttClient.state(), MQTT_RECONNECT_MS / 1000);
        lcdPrint("MQTT FAILED!", "Retrying soon..");
    }
}

// ──────────────────────────────────────────────────────────────
//  SETUP
// ──────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    // UART2 → ESP32-CAM
    SerialCAM.begin(115200, SERIAL_8N1, CAM_RX, CAM_TX);

    // GPIO
    pinMode(TRIG_PIN,   OUTPUT);
    pinMode(ECHO_PIN,   INPUT);
    pinMode(RED_PIN,    OUTPUT);
    pinMode(GREEN_PIN,  OUTPUT);
    pinMode(BLUE_PIN,   OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);

    allLedsOff();
    digitalWrite(BUZZER_PIN, LOW);

    // ── Servo (attach BEFORE ledcAttach to claim its PWM channel first) ──
    gateServo.attach(SERVO_PIN);
    gateServo.write(SERVO_CLOSED_ANGLE);
    delay(500);

    Serial.println("[SERVO] Startup test: 0 → 90 → 0°");
    gateServo.write(90);
    delay(600);
    gateServo.write(SERVO_CLOSED_ANGLE);
    delay(500);
    Serial.println("[SERVO] Startup test done.");

    // ── RGB LED — pin-based LEDC (ESP32 core v3.x API) ──────────
    ledcAttach(RED_PIN,   5000, 8);
    ledcAttach(GREEN_PIN, 5000, 8);
    ledcAttach(BLUE_PIN,  5000, 8);
    ledcWrite(RED_PIN, 0); ledcWrite(GREEN_PIN, 0); ledcWrite(BLUE_PIN, 0);

    // ── MQTT ─────────────────────────────────────────────────────
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setKeepAlive(30);
    mqttClient.setSocketTimeout(10);

    // ── I2C + LCD ─────────────────────────────────────────────
    Wire.begin(I2C_SDA, I2C_SCL);
    lcd.init();
    lcd.backlight();
    lcdPrint(" Parking  Smart", "  Initialising..");
    delay(1200);

    // ── WiFi + MQTT ───────────────────────────────────────────
    connectWiFi();
    connectMQTT();

    // ── LoRa ─────────────────────────────────────────────────
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
    LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

    setRGB(0, 0, 255);
    delay(300);
    Serial.println("\n=== LoRa EXIT GATE 433 MHz ===\n");
    lcdPrint("LoRa starting...", "433 MHz");
    Serial.print("Starting LoRa @ 433 MHz ... ");

    if (!LoRa.begin(LORA_FREQUENCY)) {
        Serial.println("FAILED!");
        Serial.println("Checklist:");
        Serial.println("  • Antenna connected?");
        Serial.println("  • 3.3V stable (add 100-470 uF cap near VCC-GND)?");
        Serial.println("  • All 6 SPI wires correct?");
        lcdPrint("LoRa FAILED!", "Check wiring!");
        setRGB(255, 0, 0);
        while (true);
    }

    LoRa.setSyncWord(LORA_SYNC_WORD);
    LoRa.setSpreadingFactor(7);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setTxPower(17);

    Serial.println("OK!");
    Serial.printf("  Freq      : %.0f MHz\n",  LORA_FREQUENCY / 1E6);
    Serial.printf("  SyncWord  : 0x%02X\n",    LORA_SYNC_WORD);
    Serial.println("  SF        : 7");
    Serial.println("  BW        : 125 kHz");
    Serial.println("  TxPower   : 17 dBm");
    Serial.println("Listening for packets...\n");
    lcdPrint("LoRa  OK!", "Exit Gate Ready");
    delay(800);

    allLedsOff();

    char spotLine[17];
    snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
    lcdPrint("   EXIT  GATE  ", spotLine);

    Serial.printf("[BACK] Ready. Capacity: %d/%d spots.\n", availableSpots, MAX_SPOTS);
    Serial.printf("[BACK] Monitoring for objects < %.0f cm…\n", DETECT_DISTANCE_CM);
}

// ──────────────────────────────────────────────────────────────
//  MAIN LOOP — fully non-blocking
// ──────────────────────────────────────────────────────────────
void loop() {
    // ── A. Keep WiFi + MQTT alive ─────────────────────────────
    if (WiFi.status() != WL_CONNECTED) connectWiFi();
    connectMQTT();
    mqttClient.loop();

    // ── B. Apply SYNC_SPOTS if pending ──────────────────────────────────
    if (mqttSyncPending) {
        mqttSyncPending = false;
        int oldSpots = availableSpots;
        availableSpots = pendingSyncSpots;
        pendingSyncSpots = -1;
        Serial.printf("[BACK] SYNC_SPOTS: %d → %d (server update)\n", oldSpots, availableSpots);
        char row1[17];
        snprintf(row1, sizeof(row1), "Spots: %2d/%2d   ", availableSpots, MAX_SPOTS);
        lcdPrint("Spot count sync", row1);
        delay(1500);
    }

    // ── C. Check LoRa inbox from Entry Gate ──────────────────
    checkLoRaInbox();

    // ── D. Measure distance only when IDLE ───────────────────
    // This physically stops the HC-SR04 from pinging while waiting for the server
    float dist = -1.0;
    if (gateState == IDLE) {
        dist = measureDistanceCM();
    }

    Serial.printf("[SONAR] Dist: %5.1f cm  Spots: %d/%d  State: %s%s\n",
                  dist, availableSpots, MAX_SPOTS,
                  gateState==IDLE?"IDLE":gateState==TRIGGERED?"TRIGGERED":"COOLDOWN",
                  (dist < DETECT_DISTANCE_CM && gateState == IDLE) ? "  <<< TRIGGER" : "");

    // ── E. Update LCD row 1 every 150 ms ─────────────────────
    if (millis() - lastLcdUpdateMs >= 150 && gateState == IDLE) {
        lastLcdUpdateMs = millis();
        char lcdRow1[17];
        if (dist >= 0) {
            snprintf(lcdRow1, sizeof(lcdRow1), "D:%5.1fcm S:%2d  ", dist, availableSpots);
        } else {
            snprintf(lcdRow1, sizeof(lcdRow1), "D:---cm  S:%2d  ", availableSpots);
        }
        lcd.setCursor(0, 1);
        lcd.print(lcdRow1);
    }

    // ── F. State machine ─────────────────────────────────────
    switch (gateState) {

        // ───────────────────────────────────────
        case IDLE:
            if (dist > 0 && dist < DETECT_DISTANCE_CM) {
                // Car detected — flush noise + send TAKE_PHOTO (non-blocking)
                Serial.printf("[BACK] Car at %.1f cm — TX \"TAKE_PHOTO\"\n", dist);
                while (SerialCAM.available()) SerialCAM.read();  // flush boot noise
                mqttGateOpen = false;   // clear stale flags
                mqttGateDeny = false;
                noPlateHint  = false;
                SerialCAM.println("TAKE_PHOTO");
                lcdPrint("Car detected!", "Scanning plate..");
                setRGB(0, 0, 255);   // blue = waiting for CAM
                gateState = TRIGGERED;
                triggeredStartMs = millis();
            }
            break;

        // ───────────────────────────────────────
        case TRIGGERED: {
            // ── 1. MQTT OPEN_EXIT — server approved ─────────
            if (mqttGateOpen) {
                mqttGateOpen = false;
                Serial.println("[BACK] ✅ MQTT OPEN_EXIT from server — servo turning");
                handleOpenGate();
                gateState = COOLDOWN;
                cooldownStartMs = millis();
                lcdPrint("Please wait...", "Cooldown active");
                break;
            }

            // ── 2. MQTT DENY_EXIT — server rejected ─────────
            if (mqttGateDeny) {
                mqttGateDeny = false;
                Serial.println("[BACK] 🔒 MQTT DENY_EXIT from server — gate stays closed");
                if (noPlateHint) {
                    lcdPrint("No Plate Number", "Aim cam at plate");
                    noPlateHint = false;
                } else {
                    lcdPrint("ACCESS DENIED", "Session not found");
                }
                handleDeny(/*lotFull=*/false);
                gateState = COOLDOWN;
                cooldownStartMs = millis();
                lcdPrint("Please wait...", "Cooldown active");
                break;
            }

            // ── 3. UART from ESP32-CAM (logging only) ───────
            // We no longer act on SUCCESS/FAIL to open the gate.
            // These just confirm that the ESP32-CAM ran successfully or failed.
            while (SerialCAM.available()) {
                String resp = SerialCAM.readStringUntil('\n');
                resp.trim();

                if (resp.length() == 0) continue;

                Serial.printf("[CAM-RAW UART] '%s'\n", resp.c_str());

                if (resp.endsWith("SUCCESS")) {
                    Serial.println("[BACK] ✓ UART SUCCESS — image POSTed successfully");
                } else if (resp.endsWith("FAIL")) {
                    Serial.println("[BACK] ✗ UART FAIL — UART network fail or CAM error! (waiting for MQTT DENY)");
                } else {
                    Serial.printf("[CAM] Noise ignored: '%s'\n", resp.c_str());
                }
            }

            // Timeout guard
            if (gateState == TRIGGERED &&
                millis() - triggeredStartMs >= CAM_RESPONSE_TIMEOUT_MS) {
                Serial.println("[BACK] CAM timeout — denying exit");
                lcdPrint("Server timeout!", "Access denied");
                handleDeny(/*lotFull=*/false);
                gateState = COOLDOWN;
                cooldownStartMs = millis();
                lcdPrint("Please wait...", "Cooldown active");
            }
            break;
        }

        // ───────────────────────────────────────
        case COOLDOWN:
            if (millis() - cooldownStartMs >= COOLDOWN_MS) {
                gateState = IDLE;
                lastLcdUpdateMs = 0;
                lcd.setCursor(0, 0);
                lcd.print("   EXIT  GATE  ");
                Serial.println("[BACK] Cooldown done — ready for next vehicle.");
            }
            break;
    }

    delay(30);
}

// ──────────────────────────────────────────────────────────────
//  Open exit gate → servo + green LED + LoRa notify entry gate
//  NOTE: Car LEAVING → availableSpots++ (frees a space)
// ──────────────────────────────────────────────────────────────
void handleOpenGate() {
    Serial.println("[BACK] ACTION: OPEN EXIT GATE");

    allLedsOff();
    setRGB(0, 255, 0);   // Green

    // Server dynamically calculates the spot count and will send SYNC_SPOTS immediately
    // after telling us to OPEN_EXIT. We no longer blindly increment here to avoid drift.
    Serial.printf("[BACK] Awaiting SYNC_SPOTS from Server. Current spots: %d/%d\n", availableSpots, MAX_SPOTS);

    char spotLine[17];
    snprintf(spotLine, sizeof(spotLine), "Spots left: %2d  ", availableSpots);
    lcdPrint("GOODBYE!  SAFE ", spotLine);

    // Re-attach servo before every move
    gateServo.detach();
    gateServo.attach(SERVO_PIN);
    delay(50);

    Serial.printf("[SERVO] Writing %d° (open)\n", SERVO_OPEN_ANGLE);
    gateServo.write(SERVO_OPEN_ANGLE);

    // Notify entry gate via LoRa — a spot has been freed
    sendLoRaPacket("EXIT_OPEN", availableSpots);

    // Publish to MQTT
    publishMQTTStatus("GATE_OPENED", availableSpots);

    Serial.printf("[BACK] Gate open for %lu ms…\n", GATE_OPEN_DURATION_MS);
    delay(GATE_OPEN_DURATION_MS);

    Serial.printf("[SERVO] Writing %d° (closed)\n", SERVO_CLOSED_ANGLE);
    gateServo.write(SERVO_CLOSED_ANGLE);
    delay(600);
    gateServo.detach();   // prevent jitter when idle

    Serial.println("[BACK] Gate closed.");
    lcdPrint("Gate closing...", "");
    delay(500);
    allLedsOff();
}

// ──────────────────────────────────────────────────────────────
//  Deny exit — gate stays closed + orange LED + buzzer
// ──────────────────────────────────────────────────────────────
void handleDeny(bool lotFull) {
    // lotFull not used at exit gate but kept for API consistency
    Serial.println("[BACK] ACTION: DENY — plate not recognised / OCR fail");
    lcdPrint("ACCESS DENIED", "Plate not found");

    allLedsOff();
    gateServo.write(SERVO_CLOSED_ANGLE);

    unsigned long start = millis();
    bool state = false;

    while (millis() - start < DENY_FEEDBACK_MS) {
        state = !state;
        if (state) {
            setRGB(255, 165, 0);
            digitalWrite(BUZZER_PIN, HIGH);
        } else {
            allLedsOff();
            digitalWrite(BUZZER_PIN, LOW);
        }
        delay(250);
    }

    allLedsOff();
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("[BACK] Deny feedback done.");

    publishMQTTStatus("GATE_DENIED", availableSpots);
}

// ──────────────────────────────────────────────────────────────
//  LoRa — Send a JSON packet to the entry gate
// ──────────────────────────────────────────────────────────────
void sendLoRaPacket(const char* cmd, int spots) {
    StaticJsonDocument<128> doc;
    doc["cmd"]   = cmd;
    doc["spots"] = spots;

    char buf[128];
    serializeJson(doc, buf);

    LoRa.beginPacket();
    LoRa.print(buf);
    LoRa.endPacket();

    Serial.println("\n┌─── LoRa SENT ─────────────────────────────");
    Serial.printf( "│ cmd   : %s\n", cmd);
    Serial.printf( "│ spots : %d/%d\n", spots, MAX_SPOTS);
    Serial.printf( "│ JSON  : %s\n", buf);
    Serial.println("└───────────────────────────────────────────");
}

// ──────────────────────────────────────────────────────────────
//  LoRa — Non-blocking check for incoming packets from entry gate
// ──────────────────────────────────────────────────────────────
void checkLoRaInbox() {
    int packetSize = LoRa.parsePacket();
    if (packetSize == 0) return;

    String raw = "";
    while (LoRa.available()) raw += (char)LoRa.read();
    int   rssi = LoRa.packetRssi();
    float snr  = LoRa.packetSnr();

    Serial.println("\n┌─── LoRa RECEIVED ─────────────────────────");
    Serial.printf( "│ Raw    : %s\n", raw.c_str());
    Serial.printf( "│ RSSI   : %d dBm\n", rssi);
    Serial.printf( "│ SNR    : %.1f dB\n", snr);
    Serial.printf( "│ Size   : %d bytes\n", packetSize);

    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, raw);
    if (err) {
        Serial.printf("│ ERROR  : JSON parse failed — %s\n", err.c_str());
        Serial.println("└───────────────────────────────────────────");
        return;
    }

    const char* cmd   = doc["cmd"]   | "";
    int         spots = doc["spots"] | availableSpots;

    Serial.printf("│ cmd    : %s\n", cmd);
    Serial.printf("│ spots  : %d\n", spots);
    Serial.println("└───────────────────────────────────────────");

    char spotLine[17];

    if (strcmp(cmd, "ENTRY_OPEN") == 0) {
        // Entry gate reported a car entered → sync spot count (decrement already done by entry)
        availableSpots = spots;
        Serial.printf("[BACK] ENTRY confirmed by front gate. Spots: %d/%d\n",
                      availableSpots, MAX_SPOTS);
        snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
        lcdPrint("Car entered(frnt)", spotLine);
        setRGB(0, 80, 0); delay(600); allLedsOff();
        lcdPrint("   EXIT  GATE  ", spotLine);

    } else if (strcmp(cmd, "SYNC_COUNT") == 0) {
        availableSpots = spots;
        Serial.printf("[BACK] SYNC received. Spots: %d/%d\n", availableSpots, MAX_SPOTS);
        snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
        lcdPrint("   EXIT  GATE  ", spotLine);

    } else {
        Serial.printf("[LoRa] Unknown command: '%s'\n", cmd);
    }
}

// ──────────────────────────────────────────────────────────────
//  HC-SR04 distance measurement
// ──────────────────────────────────────────────────────────────
float measureDistanceCM() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH);
    return duration * 0.0343 / 2;
}

// ──────────────────────────────────────────────────────────────
//  RGB LED helpers — ESP32 core v3.x: ledcWrite(pin, duty)
// ──────────────────────────────────────────────────────────────
void setRGB(uint8_t r, uint8_t g, uint8_t b) {
    ledcWrite(RED_PIN,   r);
    ledcWrite(GREEN_PIN, g);
    ledcWrite(BLUE_PIN,  b);
}

void allLedsOff() {
    ledcWrite(RED_PIN,   0);
    ledcWrite(GREEN_PIN, 0);
    ledcWrite(BLUE_PIN,  0);
}
