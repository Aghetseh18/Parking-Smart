# Smart Parking System API (Prototype)

This is a Node.js/Express.js backend for a smart parking system designed to interact with ESP32-CAM and ESP32 microcontrollers.

## Features

- **License Plate Recognition**: Uses `tesseract.js` to extract text from images uploaded by ESP32-CAM.
- **Session Management**: Automatically starts and ends parking sessions based on plate detection.
- **Reservation System**: Users can reserve spots and get one-time codes for gate entry.
- **Pricing Engine**: Configurable hourly rates with duration calculation.

- **Admin Dashboard**: Endpoints for stats, active sessions, and transaction history.
- **Automatic Expiry**: Cron job to free up reserved spots if the user doesn't show up.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **OCR**: Tesseract.js
- **Scheduling**: node-cron
- **Uploads**: Multer

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure environment**:
    Create a `.env` file (already initialized) with:
    ```env
    PORT=3000
    DB_URI=postgresql://postgres:password@localhost:5432/smart_parking
    RATE_PER_HOUR=500
    MAX_SPOTS=20
    ONE_TIME_CODE_EXPIRY_MINUTES=30
    ```

3.  **Start the server**:
    ```bash
    npm run dev
    ```

## API Endpoints

### Gates (ESP32-CAM)
- `POST /api/gate/entry/capture`: Upload image (`image`) for entry.
- `POST /api/gate/exit/capture`: Upload image (`image`) for exit.
- `POST /api/gate/entry/code`: Body `{ oneTimeCode }` for manual entry.


### Reservations (Website)
- `POST /api/reservations`: Body `{ userId, spotNumber, reservedFrom, reservedUntil }`.
- `GET /api/reservations/:userId`: Get user reservations.
- `DELETE /api/reservations/:reservationId`: Cancel reservation.

### Dashboard (Admin)
- `GET /api/dashboard/stats`: Get overview stats.
- `GET /api/dashboard/sessions/active`: All active sessions.
- `GET /api/dashboard/sessions/history`: Completed sessions.
- `GET /api/dashboard/transactions`: Billing history.

## Project Structure

- `src/models`: Database connection and data models.
- `src/controllers`: Business logic for gates and reservations.
- `src/services`: OCR, Pricing, and Timer services.
- `src/jobs`: Cron jobs for background tasks.
- `src/middleware`: Multer and error handling.
- `uploads/`: Temporary storage for camera captures.
