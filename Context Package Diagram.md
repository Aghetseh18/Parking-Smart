# Smart Parking System: Context & Package Diagram

This document outlines the high-level system architecture through a Package Diagram. It illustrates how the different functional modules (packages) of the Smart Parking System are organized and how they communicate with one another.

## Package Diagram

```mermaid
classDiagram
    %% Core Backend Packages
    package "Backend System (Node.js)" {
        class Controllers {
            +authController
            +dashboardController
            +gateController
            +reservationController
            +spotController
            +userController
        }
        class Services {
            +mqttService
            +ocrService
            +pricingService
            +reservationService
            +sseService
            +timerService
        }
        class Jobs {
            +reservationExpiry
        }
        class Models {
            +User
            +Reservation
            +ParkingSession
            +ParkingSpot
            +Transaction
        }
    }

    %% Frontend UIs
    package "Client Interfaces" {
        class UserWebsite {
            +UserInterface()
            +APIClient()
        }
        class AdminDashboard {
            +AnalyticsView()
            +SessionMonitor()
        }
    }

    %% Microservices
    package "OCR Microservice (Python)" {
        class ImageProcessor {
            +EasyOCR_Engine
            +ImageEnhancement
        }
    }

    %% IoT edge components
    package "IoT Edge (Hardware)" {
        class ESP32_CAM {
            +CameraModule
            +GateActuator
        }
        class ESP32_Node {
            +UltrasonicSensor
            +MqttClient
        }
    }

    %% Database
    package "Database Layer" {
        class PostgreSQL {
            +RelationalStore
        }
    }

    %% Relationships and Dependencies
    UserWebsite ..> Controllers : HTTP/REST
    AdminDashboard ..> Controllers : HTTP/REST
    ESP32_CAM ..> Controllers : HTTP POST (Image Upload)
    ESP32_Node ..> Services : MQTT (Topic Pub/Sub)
    
    Controllers --> Services : Uses
    Services --> Models : Data Access
    Jobs --> Models : Auto-Expiry
    
    Models --> PostgreSQL : ORM Query
    
    Services ..> ImageProcessor : HTTP Request (Python API)
    Controllers ..> UserWebsite : Server-Sent Events (SSE)
```

## Package Explanations

### 1. Client Interfaces
This package represents the external-facing applications that users interact with.
*   **UserWebsite**: A web-based application interface designed for standard users to manage their parking sessions, check live availability, and make reservations comfortably from their browsers.
*   **AdminDashboard**: A web-based application built for the parking administration team. It consumes the API endpoints to retrieve statistical analytics, visualize transaction histories, and monitor active/live parking sessions.

### 2. IoT Edge (Hardware)
This package dictates the physical interactions occurring at the parking gates.
*   **ESP32_CAM**: Specialized hardware connected to the physical gate infrastructure. It's responsible for capturing visual data (license plate images upon entry and exit) and securely uploading them to the Backend System's endpoints for processing. It also handles the physical actuation of opening the gate when the backend gives the authorization signal.

### 3. Backend System (Node.js)
The core logic center of the parking project. It processes all incoming external data and handles domain rules.
*   **Controllers**: Acts as the API Gateway/Router. Contains files like `gateController`, `authController`, `dashboardController`, etc. It delegates REST workloads to the correct services.
*   **Services**: The core business logic layer. Includes `pricingService` handling costs, `mqttService` handling IoT message brokering, `sseService` for real-time frontend updates, and the `ocrService` acting as an adapter for the Python microservice.
*   **Jobs**: The asynchronous scheduling layer containing `reservationExpiry` that automatically frees up unused reserved slots based on time logic.
*   **Models**: The formal Sequelize data models containing entities like `User`, `Reservation`, `ParkingSession`, `ParkingSpot`, and `Transaction` defining relational schemas.

### 4. OCR Microservice (Python)
An isolated microservice designed efficiently for computational text extraction.
*   **ImageProcessor**: This engine accepts raw snapshots taken by the ESP32 array, runs intelligent filtration mechanisms, and utilizes Python-based detection (e.g., EasyOCR/Tesseract pipelines) to resolve an image back into an actionable vehicle license plate string. The Node.js backend communicates with it via internal HTTP calls.

### 5. Database Layer
The persistent data store wrapping the entire platform.
*   **PostgreSQL**: A robust relational database system mapping to the Node Models, maintaining the system's absolute state and ensuring data integrity through foreign keys—from temporal parking reservations to completed, immutable financial records.
