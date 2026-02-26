# Smart Parking System: Use Case Diagrams

This document outlines the primary use cases for the **User** and **Admin** actors within the Smart Parking System.

## 1. User Use Case Diagram

The **User** interacts with the system primarily through a web application and physically at the parking gate.

```mermaid
flowchart LR
    %% Actor
    User((User))

    %% Use Cases
    subgraph User Website
        UC1([View Parking Details])
        UC2([Make a Reservation])
        UC3([View Reservation])
        UC4([See Sessions])
        UC7([View Bills])
    end

    subgraph Physical Gate
        UC5([Enter Parking Facility])
        UC6([Exit Parking Facility])
    end
    
    %% Base Relationships
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC7

    User --> UC5
    User --> UC6

    %% Sub-systems / Excludes
    Sys((OCR System))
    UC5 -.->|includes license reading| Sys
    UC6 -.->|includes license reading| Sys
```

### Detailed User Actions:
- **View Parking Details**: Check information about the parking facility, rates, and operating hours.
- **Make a Reservation**: Book a spot in advance. The user receives a one-time code as a fallback if OCR fails.
- **View Reservation**: Check specifics about current or upcoming reservations.
- **See Sessions**: Review past and currently active parking durations.
- **View Bills**: Access and settle the financial charges calculated from parking sessions.
- **Enter Parking Facility**: Physically arrive at the entry gate. System grants access automatically via the ESP32-CAM License Plate Recognition (OCR) or manually using the fallback one-time code.
- **Exit Parking Facility**: Leave the parking lot. The exit ESP32-CAM reads the plate to authorize departure.

---

## 2. Admin Use Case Diagram

The **Admin** monitors and audits the system operations predominantly via a web dashboard UI.

```mermaid
flowchart LR
    %% Actor
    Admin((Admin))

    %% Use Cases
    subgraph Web Dashboard
        UC1([View Overview Statistics])
        UC2([Monitor Active Sessions])
        UC3([View Sessions History])
        UC4([Audit Transactions/Billing])
    end
    
    %% Relationships
    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
```

### Detailed Admin Actions:
- **View Overview Statistics**: Access a high-level summary that tracks overarching system availability, revenue, and active capacity trends.
- **Monitor Active Sessions**: Actively track all vehicles currently parked in the facility with live duration information.
- **View Sessions History**: Audit logs for previously completed parking durations, including plate data.
- **Audit Transactions/Billing**: Access financial transaction logs, viewing precisely what was charged based on the pricing engine.
