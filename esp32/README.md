# ESP32 Hardware Layer — Parking Smart

## Architecture Overview

```
                     ┌───────────────────────────────────────┐
                     │          Node.js Server               │
                     │  POST /api/gate/entry/capture (OCR)   │
                     │  POST /api/gate/exit/capture  (OCR)   │
                     └──────────┬──────────────┬─────────────┘
                                │ WiFi          │ WiFi
                    ┌───────────▼──┐         ┌──▼───────────┐
                    │ ESP32-CAM    │         │ ESP32-CAM    │
                    │ (Entry Lane) │         │ (Exit Lane)  │
                    └──────┬───┬──┘         └──┬───┬───────┘
             UART TX(13)   │   │ UART RX(4)    │   │
                   GPIO13  │   │  GPIO4        │   │
             ◄─────────────┘   └─────────────► │   │
              GPIO16(RX)         GPIO17(TX)   GPIO16  GPIO17
                    │                              │
        ┌───────────▼──────────────┐  LoRa    ┌───▼──────────────────┐
        │   ESP32 ENTRY GATE       │◄────────►│   ESP32 BACK GATE    │
        │                          │  433MHz  │                      │
        │  HC-SR04 detects entry   │          │  HC-SR04 detects exit│
        │  Servo + RGB LED         │          │  Servo + RGB LED     │
        │  Tracking spots (local)  │          │  Tracking spots      │
        └──────────────────────────┘          └──────────────────────┘
```

## LoRa Message Protocol

| Sender | Command | Meaning |
|--------|---------|---------|
| Entry → Back | `ENTRY_OPEN` | Car entered, spots decremented |
| Back → Entry | `EXIT_OPEN` | Car exited, spots incremented |
| Back → Entry | `SYNC_COUNT` | Heartbeat every 30 s |
| Back → Entry | `ENTRY_ACK` | Acknowledgement of ENTRY_OPEN |

**JSON format:** `{ "cmd": "EXIT_OPEN", "spots": 18 }`

---

## Files

| File | Board | Role |
|------|-------|------|
| `esp32_cam/esp32_cam.ino` | AI-Thinker ESP32-CAM | Photo capture + server POST |
| `esp32_main/esp32_main.ino` | ESP32 Dev (Entry gate) | Sensor + servo + LoRa TX/RX |
| `esp32_back_gate/esp32_back_gate.ino` | ESP32 Dev (Back gate) | Exit sensor + servo + LoRa TX/RX |

---

## Full Pin Reference (Entry Gate & Back Gate — same PCB)

| `#define` | GPIO | Component | Notes |
|---------|------|-----------|-------|
| `TRIG_PIN` | 32 | HC-SR04 Trigger | |
| `ECHO_PIN` | 34 | HC-SR04 Echo | Input-only GPIO — no `pinMode` needed |
| `LORA_SCK` | 18 | LoRa SPI Clock | |
| `LORA_MISO` | 19 | LoRa SPI MISO | |
| `LORA_MOSI` | 22 | LoRa SPI MOSI | |
| `LORA_CS` | 23 | LoRa Chip Select | |
| `LORA_RST` | 5 | LoRa Reset | |
| `LORA_DIO0` | 21 | LoRa IRQ / DIO0 | |
| `RED_PIN` | 12 | RGB LED – Red | 330 Ω resistor |
| `GREEN_PIN` | 14 | RGB LED – Green | 330 Ω resistor |
| `BLUE_PIN` | 27 | RGB LED – Blue | 330 Ω resistor |
| `SERVO_PIN` | 26 | Servo signal | |
| `BUZZER_PIN` | 13 | Buzzer | |
| `I2C_SDA` | 33 | I2C Data (LCD) | |
| `I2C_SCL` | 25 | I2C Clock (LCD) | |
| `CAM_RX` | 16 | UART2 RX ← CAM GPIO13 (TX) | |
| `CAM_TX` | 17 | UART2 TX → CAM GPIO4 (RX) | |

> ⚠️ **Common GND** required between: both ESP32 boards (for UART) and the LoRa module.

---

## LoRa Module Wiring (SX1276 / SX1278 breakout)

```
LoRa Module     ESP32
───────────     ─────
NSS (CS)   →   GPIO 23
SCK        →   GPIO 18
MOSI       →   GPIO 22
MISO       →   GPIO 19
RST        →   GPIO  5
DIO0       →   GPIO 21
3.3V       →   3.3V
GND        →   GND
```

> ⚠️ LoRa modules are **3.3V logic only**. Do NOT connect to 5V.

---

## RGB LED Status Codes

| Colour | Meaning |
|--------|---------|
| 🔵 Blue (solid/blinking) | Waiting for server OCR result |
| 🟢 Green (solid) | Gate opened — access granted |
| 🟠 Orange/Yellow (blinking) | Access denied — buzzer also beeps |
| 🔴 Red (rapid flash at boot) | LoRa module not found — check wiring |

---

## Arduino IDE Setup

### Libraries to install (Library Manager)
1. **ESP32Servo** — servo on ESP32
2. **LoRa** by Sandeep Mistry — SX1276/SX1278 driver
3. **ArduinoJson** by Benoit Blanchon — JSON encode/decode

### Board settings
| Board | Setting |
|-------|---------|
| ESP32-CAM | `AI Thinker ESP32-CAM` |
| Entry/Back Gate | `ESP32 Dev Module` |

---

## Configuring the ESP32-CAM (`esp32_cam.ino`)

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_IP     = "192.168.1.105";   // run `ipconfig` on your PC
const int   SERVER_PORT   = 3000;
// Entry cam:  ENDPOINT = "/api/gate/entry/capture"
// Exit cam:   ENDPOINT = "/api/gate/exit/capture"
```

---

## Tunable Parameters

Defined near the top of each `.ino`:

```cpp
const float  DETECT_DISTANCE_CM      = 30.0;   // trigger range (cm)
const int    SERVO_CLOSED_ANGLE      = 0;       // degrees
const int    SERVO_OPEN_ANGLE        = 90;      // degrees
unsigned long GATE_OPEN_DURATION_MS  = 5000;    // gate-open time
unsigned long DENY_FEEDBACK_MS       = 3000;    // deny buzzer duration
unsigned long COOLDOWN_MS            = 4000;    // post-action cooldown
unsigned long CAM_RESPONSE_TIMEOUT_MS= 20000;  // max wait for OCR
const int    MAX_SPOTS               = 20;      // total parking capacity
unsigned long SYNC_INTERVAL_MS       = 30000;  // (back gate) heartbeat rate
```

> Change `LORA_FREQUENCY` to `433E6`, `868E6`, or `915E6` to match your module. Both gates must use the **same value**.
