# Feature 10: Seamless Authentication & Privacy

## 1. System Overview
Because the Traffic Brain logs user coordinates and daily commute patterns to generate suggestions, stringent privacy architectures are required. The system implements a robust JWT (JSON Web Token) authentication layer to secure endpoints, coupled with a cryptographic anonymization engine that sanitizes telemetry data before it ever reaches the database or the ML engine.

## 2. Architecture & Data Flow

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant Auth as Security Middleware
    participant API as Telemetry API
    participant DB as PostgreSQL

    App->>Auth: POST /telemetry/log (Bearer JWT)
    Auth->>Auth: verify_token()
    alt Token Invalid
        Auth-->>App: 401 Unauthorized
    else Token Valid
        Auth->>API: Inject `current_user`
        API->>API: anonymize_id(current_user) -> Hash
        API->>DB: INSERT (hashed_id, coordinates)
        DB-->>API: Success
        API-->>App: 200 OK
    end
```

## 3. Deep Code Trace
The primary security functions reside in `backend/core/security.py`.

1. **JWT Verification (`get_current_user`):** This function acts as a FastAPI Dependency (`Depends`). When attached to an endpoint (like `/ingest/camera` or `/check-commute`), it intercepts the incoming HTTP request.
   - It extracts the `Bearer` token from the `Authorization` header.
   - It uses the `jose.jwt` library to decode and cryptographically verify the signature against the server's `SECRET_KEY`.
   - If the token is missing, expired, or tampered with, it throws an `HTTPException(401, "Invalid authentication credentials")` before the API logic even executes.
2. **Telemetry Anonymization (`anonymize_id`):** 
   - Before logging user location data or routing requests, the `user_id` string is passed through `hashlib.sha256()`.
   - The SHA-256 hash securely encrypts the user's identity. The backend tracks behavioral patterns (e.g., User A drives the same route every morning) without ever knowing *who* User A actually is.
3. **Edge Node Authentication:** The physical cameras (`detector.py`) also utilize this JWT framework. When the edge node pushes flow data to `/ingest/camera`, it must provide a valid service token. This prevents malicious actors from spoofing the API and artificially injecting fake "CONGESTION" statuses to clear traffic for themselves.

## 4. API Contract

**Secure Request Header Example:**
```http
POST /api/v1/telemetry/log HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI...
Content-Type: application/json
```

**Anonymized Database Schema:**
```sql
CREATE TABLE user_journeys (
    id SERIAL PRIMARY KEY,
    anon_user_id VARCHAR(64) NOT NULL, -- SHA256 Hash
    origin_lat FLOAT,
    dest_lat FLOAT
);
```

## 5. Failure Modes & Fallbacks
- **Secret Key Compromise:** If the `SECRET_KEY` in the `.env` file is accidentally exposed, all existing JWTs are compromised. The system requires the server administrator to rotate the key. Upon rotation, all existing tokens instantly invalidate, and edge nodes/mobile apps must re-authenticate.
- **Development Bypass:** To facilitate rapid development, some API endpoints contain bypass logic. If `settings.ENVIRONMENT == "development"` or a specific demo token (`Bearer demo-token`) is provided, the middleware may mock the validation process to allow testing without spinning up a full OAuth provider.

## 6. Configuration Variables
- `SECRET_KEY`: The cryptographic string used to sign and verify JWTs.
- `ALGORITHM`: The hashing algorithm used (Default `HS256`).
- `ACCESS_TOKEN_EXPIRE_MINUTES`: How long a token remains valid before requiring refresh (Default 1440, or 24 hours).
