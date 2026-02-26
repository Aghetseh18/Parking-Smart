/*
 * ============================================================
 *  ESP32 MAIN (ENTRY GATE) -- Parking Smart System
 * ============================================================
 *  ROLE:
 *   • Monitors HC-SR04 ultrasonic sensor for arriving cars.
 *   • Triggers ESP32-CAM via UART; waits for server OCR result.
 *   • Controls servo gate + RGB LED + buzzer on result.
 *   • Uses LoRa (SX1276/SX1278) to communicate with the BACK
 *     GATE ESP32 for real-time parking spot count sync.
 *   • Connects to WiFi + MQTT broker (broker.emqx.io).
 *     Subscribes to server gate commands; publishes status events.
 *
 *  MQTT TOPICS (must match server .env):
 *   SUB  parking/gate/command  ← server sends {action:"OPEN"|"DENY"}
 *   PUB  parking/gate/status   → ESP32 sends gate event + spot count
 *
 *  LoRa PROTOCOL (JSON packets, 915 MHz / 433 MHz — see below):
 *   ENTRY → BACK:  { "cmd":"ENTRY_OPEN", "spots":<n> }
 *                  Tells back gate a car entered → decrement spots.
 *   BACK  → ENTRY: { "cmd":"EXIT_OPEN",  "spots":<n> }
 *                  Back gate reports a car exited → update spots.
 *   BACK  → ENTRY: { "cmd":"SYNC_COUNT", "spots":<n> }
 *                  Periodic heartbeat / manual sync.
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
 * │ I2C_SDA          │  33  │ (LCD / future I2C sensor)         │
 * │ I2C_SCL          │  25  │ (LCD / future I2C sensor)         │
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
// WiFi credentials
const char* WIFI_SSID       = "Blacktachi";
const char* WIFI_PASSWORD   = "111111111";

// MQTT broker — must match server .env MQTT_BROKER
// broker.emqx.io is a public broker, no credentials needed
const char* MQTT_BROKER     = "broker.emqx.io";
const int   MQTT_PORT       = 1883;
const char* MQTT_CLIENT_ID  = "parking_entry_gate";  // unique per device

// Topics — must match server .env MQTT_TOPIC_GATE
const char* MQTT_SUB_TOPIC  = "parking/gate/command"; // server → gate
const char* MQTT_PUB_TOPIC  = "parking/gate/status";  // gate → server

// Reconnect retry interval
const unsigned long MQTT_RECONNECT_MS = 5000;

// ─────────────────────────────────────────────
//  LoRa CONFIGURATION
// ─────────────────────────────────────────────
// Choose ONE frequency matching your module:
//   433E6  → 433 MHz (Asia/EU low-power)
//   868E6  → 868 MHz (Europe)
//   915E6  → 915 MHz (Americas — most common SX1276 modules)
#define LORA_FREQUENCY 433E6

// Both gates MUST use the same sync word (0x00–0xFF, avoid 0x34)
#define LORA_SYNC_WORD 0xAB

// ─────────────────────────────────────────────
//  TUNABLE PARAMETERS
// ─────────────────────────────────────────────
const float         DETECT_DISTANCE_CM      = 5.0; // car trigger range — min 20 cm for reliable HC-SR04
const int           SERVO_CLOSED_ANGLE      = 0;    // gate closed  — 0°
const int           SERVO_OPEN_ANGLE        = 90;  // gate fully open — 180°
const unsigned long GATE_OPEN_DURATION_MS   = 5000;  // gate stays open 5 s
const unsigned long DENY_FEEDBACK_MS        = 3000;  // buzzer+LED on deny
const unsigned long COOLDOWN_MS             = 4000;  // post-action cooldown
const unsigned long CAM_RESPONSE_TIMEOUT_MS = 20000; // max OCR wait (20 s)
const int           MAX_SPOTS               = 7;    // total capacity

// ─────────────────────────────────────────────
//  LCD CONFIG
//  Address 0x27 is standard for most PCF8574 backpacks.
//  If blank, try 0x3F. Use an I2C scanner sketch to confirm.
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

int           availableSpots     = MAX_SPOTS;  // live spot count
unsigned long lastMqttRetry      = 0;          // reconnect throttle
bool          mqttSyncPending    = false;      // set when server sends SYNC_SPOTS
int           pendingSyncSpots   = -1;         // authoritative spot count from server
bool          noPlateHint        = false;      // set by MQTT NO_PLATE — LCD display only

// ── MQTT gate control flags (set in callback, consumed in TRIGGERED) ──
// Server sends action:"OPEN" or action:"DENY" after OCR processing.
// These are the PRIMARY gate control signals.
bool          mqttGateOpen       = false;      // server says: open the gate
bool          mqttGateDeny       = false;      // server says: deny entry

// ── Non-blocking sensor state machine ────────────────────────
enum GateState { IDLE, TRIGGERED, COOLDOWN };
GateState     gateState          = IDLE;
unsigned long cooldownStartMs     = 0;
unsigned long lastLcdUpdateMs     = 0;
unsigned long triggeredStartMs    = 0;


// ──────────────────────────────────────────────────────────────
//  LCD HELPER — prints two rows, pads with spaces to clear old text
// ──────────────────────────────────────────────────────────────
void lcdPrint(const char* row0, const char* row1 = "") {
    lcd.setCursor(0, 0);
    char buf[LCD_COLS + 1];
    snprintf(buf, sizeof(buf), "%-16s", row0);  // left-justify, pad to 16
    lcd.print(buf);
    lcd.setCursor(0, 1);
    snprintf(buf, sizeof(buf), "%-16s", row1);
    lcd.print(buf);
}

// ──────────────────────────────────────────────────────────────
//  MQTT HELPERS — forward-declarations so callback can call them
// ──────────────────────────────────────────────────────────────
void handleOpenGate();               // defined later
void handleDeny(bool lotFull);       // defined later

// ──────────────────────────────────────────────────────────────
//  MQTT CALLBACK
//  Gate is SERVER-CONTROLLED via MQTT.
//  Server sends action:"OPEN" or action:"DENY" after OCR processing.
//  UART from CAM is used only as an error fallback (FAIL = camera/network error).
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

    const char* action = doc["action"] | "(none)";
    const char* type   = doc["type"]   | "";
    const char* plate  = doc["plateNumber"] | "";
    const char* msg    = doc["message"] | "";
    int         spots  = doc["spots"]  | -1;

    Serial.printf("│ action : %s\n", action);
    if (strlen(type)  > 0) Serial.printf("│ type   : %s\n", type);
    if (strlen(plate) > 0) Serial.printf("│ plate  : %s\n", plate);
    if (strlen(msg)   > 0) Serial.printf("│ message: %s\n", msg);
    if (spots >= 0)         Serial.printf("│ spots  : %d\n", spots);

    // ── OPEN — server approved entry, turn servo ───────────────────────
    if (strcmp(action, "OPEN") == 0) {
        if (gateState == TRIGGERED) {
            mqttGateOpen = true;
            Serial.println("│ → OPEN received in TRIGGERED state ✅");
            Serial.println("│   Servo WILL turn next loop iteration");
        } else {
            Serial.printf("│ → OPEN received but NOT in TRIGGERED state (state=%d) — discarded\n", (int)gateState);
        }

    // ── DENY — server rejected entry, gate stays closed ───────────────
    } else if (strcmp(action, "DENY") == 0) {
        if (gateState == TRIGGERED) {
            mqttGateDeny = true;
            Serial.println("│ → DENY received in TRIGGERED state 🔒");
            Serial.println("│   Gate will stay closed next loop iteration");
        } else {
            Serial.printf("│ → DENY received but NOT in TRIGGERED state (state=%d) — discarded\n", (int)gateState);
        }

    // ── NO_PLATE — LCD hint that no plate was found ────────────────────
    } else if (strcmp(action, "NO_PLATE") == 0) {
        noPlateHint = true;
        Serial.println("│ → NO_PLATE hint set — LCD will show 'No Plate Number'");

    // ── SYNC_SPOTS — server pushes authoritative spot count ───────────
    } else if (strcmp(action, "SYNC_SPOTS") == 0 && spots >= 0) {
        pendingSyncSpots = spots;
        mqttSyncPending  = true;
        Serial.printf("│ → SYNC_SPOTS: will apply %d spots next loop\n", spots);

    } else {
        Serial.printf("│ → Unknown / unhandled action: %s\n", action);
    }
    Serial.println("└───────────────────────────────────────────");
}

// ──────────────────────────────────────────────────────────────
//  Publish a status JSON to parking/gate/status
//  e.g. { "event":"GATE_OPENED", "spots":18, "gate":"entry" }
// ──────────────────────────────────────────────────────────────
void publishMQTTStatus(const char* event, int spots) {
    if (!mqttClient.connected()) {
        Serial.printf("[MQTT] TX skipped — not connected (event: %s)\n", event);
        return;
    }

    StaticJsonDocument<128> doc;
    doc["event"] = event;
    doc["spots"] = spots;
    doc["gate"]  = "entry";

    char buf[128];
    serializeJson(doc, buf);
    mqttClient.publish(MQTT_PUB_TOPIC, buf);

    Serial.println("\n┌─── MQTT SENT ─────────────────────────────");
    Serial.printf( "│ Topic  : %s\n", MQTT_PUB_TOPIC);
    Serial.printf( "│ event  : %s\n", event);
    Serial.printf( "│ spots  : %d/%d\n", spots, MAX_SPOTS);
    Serial.printf( "│ gate   : entry\n");
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
//  MQTT connect / reconnect (non-blocking with throttle)
// ──────────────────────────────────────────────────────────────
void connectMQTT() {
    if (WiFi.status() != WL_CONNECTED) return;   // no point trying
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
        // Announce presence
        publishMQTTStatus("GATE_ONLINE", availableSpots);
        // Restore idle screen
        char spotLine[17];
        snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
        lcdPrint("  ENTRY  GATE  ", spotLine);
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

    // UART2 → ESP32-CAM  (baud must match CAM sketch — 115200)
    SerialCAM.begin(115200, SERIAL_8N1, CAM_RX, CAM_TX);

    // GPIO setup
    pinMode(TRIG_PIN,   OUTPUT);
    pinMode(ECHO_PIN,   INPUT);    // explicit INPUT — matches working test sketch
    pinMode(RED_PIN,    OUTPUT);
    pinMode(GREEN_PIN,  OUTPUT);
    pinMode(BLUE_PIN,   OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);

    allLedsOff();
    digitalWrite(BUZZER_PIN, LOW);

    // ── Servo (attach BEFORE any analogWrite/ledcWrite to claim channel 0) ──
    gateServo.attach(SERVO_PIN);
    gateServo.write(SERVO_CLOSED_ANGLE);
    delay(500);   // let servo settle at 0°

    // Quick startup test — proves servo is alive before any gate logic runs
    Serial.println("[SERVO] Startup test: 0 → 90 → 0°");
    gateServo.write(90);
    delay(600);
    gateServo.write(SERVO_CLOSED_ANGLE);
    delay(500);
    Serial.println("[SERVO] Startup test done.");

    // ── RGB LED — pin-based LEDC (ESP32 core v3.x API) ─────────
    // ledcAttach(pin, freq_Hz, resolution_bits)
    // Servo already claimed its own channel via ESP32Servo — no conflict.
    ledcAttach(RED_PIN,   5000, 8);
    ledcAttach(GREEN_PIN, 5000, 8);
    ledcAttach(BLUE_PIN,  5000, 8);
    ledcWrite(RED_PIN, 0); ledcWrite(GREEN_PIN, 0); ledcWrite(BLUE_PIN, 0);

    // ── MQTT client setup (callback registered before connect) ────
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

    // ── WiFi ─────────────────────────────────────────────────────
    connectWiFi();

    // ── MQTT (first connect — subsequent via loop) ────────────────
    connectMQTT();

    // ── LoRa ─────────────────────────────────────────────────
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
    LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

    setRGB(0, 0, 255);
    delay(300);
    Serial.println("\n=== LoRa ENTRY GATE 433 MHz ===\n");
    lcdPrint("LoRa starting...", "433 MHz");
    Serial.print("Starting LoRa @ 433 MHz ... ");

    if (!LoRa.begin(LORA_FREQUENCY)) {
        Serial.println("FAILED!");
        Serial.println("Checklist:");
        Serial.println("  \u2022 Antenna connected?");
        Serial.println("  \u2022 3.3V stable (add 100-470 uF cap near VCC-GND)?");
        Serial.println("  \u2022 All 6 SPI wires correct?");
        lcdPrint("LoRa FAILED!", "Check wiring!");
        setRGB(255, 0, 0);
        while (true);   // halt — LoRa is required
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
    lcdPrint("LoRa  OK!", "Entry Gate Ready");
    delay(800);

    allLedsOff();

    // Show idle screen
    char spotLine[17];
    snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
    lcdPrint("  ENTRY  GATE  ", spotLine);

    Serial.printf("[MAIN] Ready. Capacity: %d/%d spots available.\n",
                  availableSpots, MAX_SPOTS);
    Serial.printf("[MAIN] Monitoring for objects < %.0f cm…\n",
                  DETECT_DISTANCE_CM);
}

// ──────────────────────────────────────────────────────────────
//  MAIN LOOP — fully non-blocking, distance checked every pass
//
//  States:
//   IDLE      → measure continuously, trigger camera when dist < threshold
//   TRIGGERED → processVehicle() ran; gate is handled; enter cooldown
//   COOLDOWN  → sensor still reads & prints but camera will not re-fire
//               until COOLDOWN_MS elapses, then back to IDLE
// ──────────────────────────────────────────────────────────────
void loop() {
    // ── A. Keep WiFi + MQTT alive ─────────────────────────────
    if (WiFi.status() != WL_CONNECTED) connectWiFi();
    connectMQTT();
    mqttClient.loop();

    // ── B. Apply SYNC_SPOTS from server if pending ───────────────
    // Gate open/deny is handled purely by UART (SUCCESS/FAIL from CAM).
    // MQTT only carries spot-count updates from the server.
    if (mqttSyncPending) {
        mqttSyncPending = false;
        int oldSpots = availableSpots;
        availableSpots = pendingSyncSpots;
        pendingSyncSpots = -1;
        Serial.printf("[MAIN] SYNC_SPOTS: %d → %d (server update)\n", oldSpots, availableSpots);
        sendLoRaPacket("SYNC_COUNT", availableSpots);
        publishMQTTStatus("SPOTS_SYNCED", availableSpots);
        char row1[17];
        snprintf(row1, sizeof(row1), "Spots: %2d/%2d   ", availableSpots, MAX_SPOTS);
        lcdPrint("Spot count sync", row1);
        delay(1500);
    }

    // ── C. Check for incoming LoRa packets from Back Gate ─────
    checkLoRaInbox();

    // ── D. Measure distance only when IDLE ───────
    // This physically stops the HC-SR04 from pinging while waiting for the server
    float dist = -1.0;
    if (gateState == IDLE) {
        dist = measureDistanceFiltered();
    }

    // Always print to Serial  (-1 = no echo / open air)
    Serial.printf("[SONAR] Dist: %5.1f cm  Spots: %d/%d  State: %s%s\n",
                  dist, availableSpots, MAX_SPOTS,
                  gateState==IDLE?"IDLE":gateState==TRIGGERED?"TRIGGERED":"COOLDOWN",
                  (dist > 0 && dist < DETECT_DISTANCE_CM && gateState == IDLE) ? "  <<< TRIGGER" : "");

    // ── E. Update LCD row 1 every 150 ms (avoid flicker) ─────
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
                if (availableSpots <= 0) {
                    // Lot full — deny without touching camera
                    Serial.println("[MAIN] Lot is FULL — denying without capture.");
                    lcdPrint("PARKING  FULL!", "No spots left");
                    handleDeny(/*lotFull=*/true);
                    gateState = COOLDOWN;
                    cooldownStartMs = millis();
                    lcdPrint("Please wait...", "Cooldown active");
                } else {
                    // Car detected — flush stale UART + flags, send TAKE_PHOTO
                    Serial.printf("[MAIN] Car at %.1f cm — TX \"TAKE_PHOTO\" — awaiting MQTT command\n", dist);
                    while (SerialCAM.available()) SerialCAM.read(); // flush stale UART bytes
                    mqttGateOpen = false;   // clear any stale MQTT gate commands
                    mqttGateDeny = false;
                    noPlateHint  = false;   // clear stale LCD hint
                    Serial.println("\n┌─── UART SENT (Main ESP32 → ESP32-CAM) ─────");
                    Serial.println("│ TAKE_PHOTO");
                    Serial.println("└───────────────────────────────────────────");
                    SerialCAM.println("TAKE_PHOTO");
                    lcdPrint("Car detected!", "Sending to srvr");
                    setRGB(0, 0, 255);  // blue = waiting for server MQTT command
                    gateState = TRIGGERED;
                    triggeredStartMs = millis();
                }
            }
            break;

        // ──────────────────────────────────────────────────────────────
        //  TRIGGERED — waiting for server decision via MQTT
        //
        //  Primary control : MQTT action="OPEN" or action="DENY"
        //                    sent by the server after OCR processing.
        //  Fallback        : UART "FAIL" from CAM = camera/network error
        //                    → deny immediately without waiting for MQTT.
        //  UART "SUCCESS"  : confirms image was sent to server OK.
        //                    Logged only — gate does NOT open on this.
        // ──────────────────────────────────────────────────────────────
        case TRIGGERED: {

            // ── 1. MQTT OPEN — server approved, open the gate ─────────
            if (mqttGateOpen) {
                mqttGateOpen = false;   // consume flag
                Serial.println("[MAIN] ✅ MQTT OPEN from server — servo turning");
                lcdPrint("ACCESS GRANTED!", "Welcome!");
                handleOpenGate();
                gateState = COOLDOWN;
                cooldownStartMs = millis();
                lcdPrint("Please wait...", "Cooldown active");
                break;
            }

            // ── 2. MQTT DENY — server rejected, gate stays closed ─────
            if (mqttGateDeny) {
                mqttGateDeny = false;   // consume flag
                Serial.println("[MAIN] 🔒 MQTT DENY from server — gate stays closed");
                if (noPlateHint) {
                    lcdPrint("No Plate Number", "Aim cam at plate");
                    noPlateHint = false;
                } else {
                    lcdPrint("ACCESS DENIED", "No reservation");
                }
                handleDeny(false);
                gateState = COOLDOWN;
                cooldownStartMs = millis();
                lcdPrint("Please wait...", "Cooldown active");
                break;
            }

            // ── 3. UART from ESP32-CAM — read and log ─────────────────
            while (SerialCAM.available()) {
                String resp = SerialCAM.readStringUntil('\n');
                resp.trim();
                if (resp.length() == 0) continue;

                Serial.println("\n┌─── UART RECEIVED (from ESP32-CAM) ────────");
                Serial.printf( "│ Raw    : '%s'\n", resp.c_str());

                if (resp == "SUCCESS") {
                    // Image reached the server OK — gate control is via MQTT
                    Serial.println("│ SUCCESS — image sent to server OK");
                    Serial.println("│ Gate control is via MQTT — waiting for OPEN/DENY");
                    Serial.println("└───────────────────────────────────────────");
                    lcdPrint("Image sent OK", "Awaiting server..");

                } else if (resp == "FAIL") {
                    // Camera failed to reach server — deny immediately (no MQTT will come)
                    Serial.println("│ FAIL — camera/network error, denying immediately");
                    Serial.println("└───────────────────────────────────────────");
                    if (noPlateHint) {
                        lcdPrint("No Plate Number", "Aim cam at plate");
                        noPlateHint = false;
                    } else {
                        lcdPrint("ACCESS DENIED", "Camera/net error");
                    }
                    handleDeny(false);
                    gateState = COOLDOWN;
                    cooldownStartMs = millis();
                    lcdPrint("Please wait...", "Cooldown active");

                } else {
                    // Boot chatter / debug line — ignore
                    Serial.println("│ Noise — ignored (not SUCCESS or FAIL)");
                    Serial.println("└───────────────────────────────────────────");
                }
            }

            // ── 4. Global timeout guard ───────────────────────────────
            if (gateState == TRIGGERED &&
                millis() - triggeredStartMs >= CAM_RESPONSE_TIMEOUT_MS) {
                Serial.println("[MAIN] ⏱ Timeout — no MQTT command from server, denying");
                lcdPrint("Server timeout!", "Access denied");
                handleDeny(false);
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
                lastLcdUpdateMs = 0;   // force immediate LCD refresh
                lcd.setCursor(0, 0);
                lcd.print("  ENTRY  GATE  ");
                Serial.println("[MAIN] Cooldown done — ready for next vehicle.");
            }
            break;
    }

    delay(30);   // ~33 readings/sec
}


// ──────────────────────────────────────────────────────────────
//  Open gate → servo + green LED + LoRa notify back gate
// ──────────────────────────────────────────────────────────────
void handleOpenGate() {
    Serial.println("[MAIN] ACTION: OPEN GATE");

    allLedsOff();
    setRGB(0, 255, 0);   // Green

    // Server dynamically calculates the spot count and will send SYNC_SPOTS immediately
    // after telling us to OPEN. We no longer blindly decrement here to avoid drift.
    Serial.printf("[MAIN] Awaiting SYNC_SPOTS from Server. Current spots: %d/%d\n", availableSpots, MAX_SPOTS);

    // LCD row 2 — show spot info (caller may have already set row 0/1)
    char spotLine[17];
    snprintf(spotLine, sizeof(spotLine), "Spots left: %2d  ", availableSpots);
    // Only overwrite LCD row1 if caller hasn't set a reservation message
    lcdPrint("ACCESS GRANTED!", spotLine);

    // Re-attach servo before every move to ensure LEDC channel is still ours
    gateServo.detach();
    gateServo.attach(SERVO_PIN);
    delay(50);

    Serial.printf("[SERVO] Writing %d (open)\n", SERVO_OPEN_ANGLE);
    gateServo.write(SERVO_OPEN_ANGLE);

    // Notify back gate via LoRa — sends updated spot count
    sendLoRaPacket("ENTRY_OPEN", availableSpots);

    // Publish to MQTT so server/dashboard knows gate opened + current spots
    publishMQTTStatus("GATE_OPENED", availableSpots);

    Serial.printf("[MAIN] Gate open for %lu ms\n", GATE_OPEN_DURATION_MS);
    delay(GATE_OPEN_DURATION_MS);

    Serial.printf("[SERVO] Writing %d (closed)\n", SERVO_CLOSED_ANGLE);
    gateServo.write(SERVO_CLOSED_ANGLE);
    delay(600);   // let servo reach closed before detaching
    gateServo.detach();  // release LEDC channel — prevents jitter

    Serial.println("[MAIN] Gate closed.");
    lcdPrint("Gate closing...", "");
    delay(500);
    allLedsOff();
}

// ──────────────────────────────────────────────────────────────
//  Deny entry → gate stays closed + yellow LED + buzzer beeps
// ──────────────────────────────────────────────────────────────
void handleDeny(bool lotFull) {
    // ── Buzzer ALWAYS fires on deny ────────────────────────────
    // (caller already set the LCD message before calling handleDeny)
    if (lotFull) {
        Serial.println("[MAIN] ACTION: DENY — lot full");
        lcdPrint("PARKING  FULL!", "No spots avail.");
    } else {
        Serial.println("[MAIN] ACTION: DENY — plate not recognised / OCR fail");
        lcdPrint("ACCESS DENIED", "No reservation");
    }

    allLedsOff();
    gateServo.write(SERVO_CLOSED_ANGLE);

    unsigned long start = millis();
    bool state = false;

    while (millis() - start < DENY_FEEDBACK_MS) {
        state = !state;
        if (state) {
            setRGB(255, 165, 0);            // Orange/Yellow on deny
            digitalWrite(BUZZER_PIN, HIGH);
        } else {
            allLedsOff();
            digitalWrite(BUZZER_PIN, LOW);
        }
        delay(250);
    }

    allLedsOff();
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("[MAIN] Deny feedback done.");

    // Publish denial event to server
    publishMQTTStatus(lotFull ? "GATE_DENIED_FULL" : "GATE_DENIED", availableSpots);
}

// waitForCameraResponse() removed — superseded by non-blocking TRIGGERED state machine above.

// ──────────────────────────────────────────────────────────────
//  LoRa — Send a JSON packet to the back gate
//  Packet: { "cmd":"<command>", "spots":<n> }
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
//  LoRa — Non-blocking check for incoming packets from back gate
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

    if (strcmp(cmd, "EXIT_OPEN") == 0) {
        // A car left through the back gate → spots freed
        int oldSpots   = availableSpots;
        availableSpots = spots;
        Serial.printf("[LoRa] EXIT_OPEN — car exited back gate. Spots: %d → %d/%d\n",
                      oldSpots, availableSpots, MAX_SPOTS);
        snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
        lcdPrint("Car exited(back)", spotLine);
        setRGB(0, 100, 0); delay(600); allLedsOff();
        lcdPrint("  ENTRY  GATE  ", spotLine);

        // ── Notify server: back gate freed a spot ─────────────
        Serial.println("[MQTT] Notifying server: EXIT_CONFIRMED (spots freed by back gate)");
        publishMQTTStatus("EXIT_CONFIRMED", availableSpots);

    } else if (strcmp(cmd, "SYNC_COUNT") == 0) {
        // Back gate sent a heartbeat / manual sync
        int oldSpots   = availableSpots;
        availableSpots = spots;
        Serial.printf("[LoRa] SYNC_COUNT — back gate heartbeat. Spots: %d → %d/%d\n",
                      oldSpots, availableSpots, MAX_SPOTS);
        snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
        lcdPrint("  ENTRY  GATE  ", spotLine);

        // ── Notify server: synced spot count ──────────────────
        Serial.println("[MQTT] Notifying server: SPOTS_UPDATED (LoRa sync from back gate)");
        publishMQTTStatus("SPOTS_UPDATED", availableSpots);

    } else if (strcmp(cmd, "ENTRY_ACK") == 0) {
        // Back gate acknowledged our ENTRY_OPEN — confirmed spot count
        int oldSpots   = availableSpots;
        availableSpots = spots;
        Serial.printf("[LoRa] ENTRY_ACK — back gate confirmed entry. Spots: %d → %d/%d\n",
                      oldSpots, availableSpots, MAX_SPOTS);
        snprintf(spotLine, sizeof(spotLine), "Spots: %2d / %2d", availableSpots, MAX_SPOTS);
        lcdPrint("  ENTRY  GATE  ", spotLine);

        // ── Notify server: spot count confirmed by back gate ──
        Serial.println("[MQTT] Notifying server: ENTRY_CONFIRMED (back gate ACK)");
        publishMQTTStatus("ENTRY_CONFIRMED", availableSpots);

    } else {
        Serial.printf("[LoRa] Unknown command: '%s'\n", cmd);
    }
}

// ──────────────────────────────────────────────────────────────
//  HC-SR04 — single ping with timeout
//  • pulseIn timeout = 30 000 µs  → max ~515 cm  (well past any car)
//  • Returns -1.0 if no echo received (open air / wiring fault)
//  • Formula: distance_cm = duration * 0.0343 / 2
// ──────────────────────────────────────────────────────────────
#define PULSEIN_TIMEOUT_US 30000UL   // 30 ms → ~515 cm max range

float measureDistanceCM() {
    // Ensure TRIG is LOW before pulse
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);

    // Send 10 µs HIGH pulse to TRIG
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    // Wait for ECHO with a finite timeout — avoids 1-second block on no-echo
    long duration = pulseIn(ECHO_PIN, HIGH, PULSEIN_TIMEOUT_US);

    // pulseIn returns 0 when it times out — treat as no echo
    if (duration == 0) return -1.0;   // -1 = no object detected

    float distance_cm = duration * 0.0343f / 2.0f;
    return distance_cm;
}

// ──────────────────────────────────────────────────────────────
//  3-sample median filter — eliminates single-shot noise spikes
//  that could falsely trigger the gate
// ──────────────────────────────────────────────────────────────
float measureDistanceFiltered() {
    float s[3];
    for (int i = 0; i < 3; i++) {
        s[i] = measureDistanceCM();
        delayMicroseconds(1000);   // 1 ms between pings
    }
    // Bubble-sort 3 values, return middle (median)
    if (s[0] > s[1]) { float t = s[0]; s[0] = s[1]; s[1] = t; }
    if (s[1] > s[2]) { float t = s[1]; s[1] = s[2]; s[2] = t; }
    if (s[0] > s[1]) { float t = s[0]; s[0] = s[1]; s[1] = t; }
    return s[1];   // median
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
