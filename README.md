# ⚡ Loopin by Genesis Hacks

> **The verified developer passport and real-time networking engine for tech hackathons, meetups, and developer ecosystems.**

---

[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web%20PWA-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://capacitorjs.com/)
[![React](https://img.shields.io/badge/React-18_TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6.0-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2_Caching-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Compliance](https://img.shields.io/badge/Compliance-India_DPDP_Act-FF9933?style=for-the-badge&logo=shield&logoColor=white)](#-privacy-security--dpdp-compliance)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](LICENSE)

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Problems \& The Loopin Solution](#-key-problems--the-loopin-solution)
- [Target Audience](#-target-audience)
- [Core Pillars \& Features](#-core-pillars--features)
  - [1. The Dev Passport (Proof-of-Skill Graph)](#1-the-dev-passport-proof-of-skill-graph)
  - [2. High-Speed Physical Networking Layer](#2-high-speed-physical-networking-layer)
  - [3. Genesis Community Hub \& Live Operations](#3-genesis-community-hub--live-operations)
- [System Architecture](#-system-architecture)
  - [High-Level Architecture Diagram](#high-level-architecture-diagram)
  - [Dynamic QR Verification \& Stamping Workflow](#dynamic-qr-verification--stamping-workflow)
- [Technical Stack \& Hardware Abstraction](#-technical-stack--hardware-abstraction)
- [Data Models \& Schema Design](#-data-models--schema-design)
- [Privacy, Security \& DPDP Compliance](#-privacy-security--dpdp-compliance)
- [Performance Benchmarks \& Success Metrics](#-performance-benchmarks--success-metrics)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Web \& PWA Development](#web--pwa-development)
  - [Android Build \& Deployment (Capacitor)](#android-build--deployment-capacitor)
  - [Backend \& Database Setup](#backend--database-setup)
- [Contributing](#-contributing)
- [License \& Acknowledgements](#-license--acknowledgements)

---

## 📖 Overview

**Loopin by Genesis Hacks** is a native-first Android and web mobile application engineered to transform fragmented, ephemeral tech networking into a verified developer reputation network. 

Traditional in-person tech events rely on business cards, fleeting LinkedIn QR codes, or Telegram handles that degrade into dead contact lists. Loopin replaces this with the **Dev Passport**—an immutable, organizer-verified record of hackathon attendances, track podiums, submitted codebases, and peer-vouched project roles.

Built on top of a **sub-400ms QR scanning layer**, Loopin bridges high-energy physical hackathon venues with high-signal, long-term talent intelligence.

```
       Physical Venue                             Immutable Digital Identity
┌───────────────────────────┐                     ┌───────────────────────────┐
│  • Dynamic QR Badges      │                     │  • Organizer-Stamped Visas│
│  • Instant Contact Swaps  │ ──[ Sub-400ms ]───▶ │  • Track Podiums & Bounties│
│  • Private Context Notes  │     Sync Layer      │  • Verified Repos & Roles │
│  • Real-Time FCM Alerts   │                     │  • Peer-Vouched Skill Graph│
└───────────────────────────┘                     └───────────────────────────┘
```

---

## ⚡ Key Problems & The Loopin Solution

| Challenge in Tech Events | Legacy Approach | The Loopin Solution |
| :--- | :--- | :--- |
| **Contact Fragmentation** | Exchanging LinkedIn, Twitter, GitHub, and Telegram across 5 different apps. | **Single Scan Exchange:** Instant profile swap with all verified links and custom contextual notes. |
| **Unverified Resumes** | Hackers claiming track wins or major contributions with zero verification. | **Dev Passport:** Cryptographic "visa stamps" issued exclusively by authorized organizer/judge scans. |
| **Lost Follow-ups** | Forgetting who you met, what you discussed, or their project role 2 days later. | **Private Contextual Notes:** Instant post-scan local notes attached directly to the connection entity. |
| **Live Venue Chaos** | Missing critical announcements (food drops, mentor sessions, deadline extensions). | **Genesis Live Ops:** Direct FCM broadcast engine with segmented push alerts. |
| **QR Code Scraping** | Static badges photographed and scraped by unauthorized aggregators. | **Time-Decay Tokenized QR:** Rotating ephemeral QR payloads validated against Redis in real-time. |

---

## 🎯 Target Audience

### 👨‍💻 1. Hackers & Builders
- Instant, friction-free profile exchange during busy hackathons.
- Maintain an unforgeable "proof-of-work" portfolio showing real code, real track wins, and teammate vouches.
- Private contextual logs to remember technical discussions and potential collaboration ideas.

### 🎪 2. Event Organizers (Genesis Team)
- Streamlined check-in operations with automated attendance stamp issuance.
- Centralized, high-priority push announcement hub for live updates (mentorship queues, food, deadlines).
- Real-time venue flow analytics and attendee engagement metrics.

### 🏢 3. Sponsors & Technical Recruiters
- High-signal talent discovery based on validated GitHub repositories and organizer-stamped wins.
- Filter candidates by verified roles (e.g., *Systems Engineer*, *RAG Pipeline Architect*, *UI/UX Lead*).
- Teammate peer reviews for honest, organic skill validation.

---

## 🚀 Core Pillars & Features

### 1. The Dev Passport (Proof-of-Skill Graph)

The Dev Passport is the heart of Loopin—a cryptographic travel log of a developer’s hackathon journey.

- 🛂 **Organizer-Stamped Travel Log:** Earn digital "visa stamps" for every hackathon, mini-hack, and meetup attended. Stamps are cryptographically signed and issued exclusively through authorized organizer scanner keys.
- 🏆 **Trophy Case & Podium Tracking:** Showcases track wins, bounties, and podium finishes verified directly by event judges and organizers.
- 💻 **Verified Codebases:** Direct links to public GitHub repositories built during specific events, tagged with exact tech stacks and system modules authored by the user.
- 🤝 **Peer Vouches:** Teammates from the same project team can vouch for specific module contributions (e.g., *"Engineered the WebRTC signaling server"*, *"Designed full UI system in Tailwind"*).

### 2. High-Speed Physical Networking Layer

- ⚡ **Sub-400ms Dynamic QR Scanning:** High-performance platform-agnostic camera integration powered by native ML Kit on Android and WebAssembly/HTML5 streams on the web.
- 📝 **Private Contextual Notes:** Attach private, encrypted notes immediately after scanning a peer (e.g., *"Met at Track 2 table; looking for a Rust backend co-founder"*). These notes are strictly local to your profile and never exposed to the other party.
- 🏷️ **Tagging & Instant Filtering:** Organize connections by event name, primary role, tech stack, or custom tags (*#Genesis2026*, *#AI-Engineer*, *#PotentialCoFounder*).

### 3. Genesis Community Hub & Live Operations

- 📢 **Real-Time Event Announcements:** Sub-second push notifications powered by Firebase Cloud Messaging (FCM) for schedule changes, stage announcements, food drops, mentorship slots, and submission countdowns.
- 🌐 **Curated Community Feed:** Centralized hub for upcoming Genesis hackathons, ecosystem workshops, bounty drops, and community highlights.

---

## 🏗️ System Architecture

Loopin is architected as a native-first hybrid application using React and Capacitor for hardware-accelerated mobile execution, backed by a microservices/REST API infrastructure backed by PostgreSQL and Redis.

### High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientLayer ["📱 Client Runtime (Android / Web PWA)"]
        UI["React 18 + TypeScript + Tailwind CSS"]
        ScannerHook["useScanner Hardware Hook"]
        MLKit["@capacitor-mlkit/barcode-scanning (Android)"]
        HTML5Cam["HTML5 Video / Canvas Stream (Web)"]
        FCMClient["@capacitor/push-notifications / FCM SDK"]
        LocalCache["IndexedDB / SQLite Storage (Private Notes)"]
        
        UI --> ScannerHook
        ScannerHook -->|Native Bridge| MLKit
        ScannerHook -->|Web Fallback| HTML5Cam
        UI --> FCMClient
        UI --> LocalCache
    end

    subgraph Gateway ["🌐 API & Live Ingestion Gateway"]
        APIGateway["Reverse Proxy / API Gateway (TLS 1.3)"]
        AuthMiddleware["JWT & Token Rotation Middleware"]
        RateLimiter["Redis Token Bucket Rate Limiter"]
    end

    subgraph AppServices ["⚙️ Core Backend Services"]
        PassportService["Passport & Stamping Engine"]
        NetworkService["Connection & Networking Service"]
        LiveOpsService["Genesis Live Ops & Announcement Service"]
        FCMService["Firebase Cloud Messaging Dispatcher"]
    end

    subgraph DataPersistence ["💾 Persistence & Cache Layer"]
        RedisCluster[("Redis 7.2 Cache & QR Token Registry\n• Ephemeral QR Tokens\n• Feed & Announcement Cache\n• Session State")]
        PostgresDB[("PostgreSQL 16 Database\n• Users & Passports\n• Visa Stamps & Vouches\n• Event Podium & Repos")]
    end

    ClientLayer <-->|HTTPS / WSS| APIGateway
    APIGateway --> AuthMiddleware --> RateLimiter
    RateLimiter --> AppServices

    PassportService --> PostgresDB
    PassportService --> RedisCluster
    NetworkService --> PostgresDB
    NetworkService --> RedisCluster
    LiveOpsService --> RedisCluster
    LiveOpsService --> FCMService
    FCMService -->|Push Dispatch| FCMClient
```

---

### Dynamic QR Verification & Stamping Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Attendee as 📱 Attendee App
    participant Scanner as 📷 Organizer / Peer App
    participant Redis as ⚡ Redis Cache
    participant Backend as 🖥️ Loopin Backend
    participant DB as 🐘 PostgreSQL

    Note over Attendee,Redis: Ephemeral QR Generation (Time-Decay)
    Attendee->>Backend: Request Dynamic QR Token (JWT/Nonce)
    Backend->>Redis: SetEX qr_token:{user_id} TTL=60s
    Backend-->>Attendee: Return Rotating Encrypted Payload
    Attendee->>Attendee: Render Dynamic QR Code (Auto-refresh 30s)

    Note over Scanner,DB: High-Speed Scan & Verification (<400ms)
    Scanner->>Scanner: ML Kit Scans QR Payload
    Scanner->>Backend: POST /api/v1/network/exchange { token, context }
    Backend->>Redis: GET & Invalidate qr_token:{payload}
    alt Token Valid
        Backend->>DB: Record Mutual Connection & Exchange Metadata
        Backend-->>Scanner: 200 OK (Attendee Profile + Badge Meta)
        Scanner->>Scanner: Trigger Haptic Feedback & Badge Flip Animation
        Scanner->>Scanner: Prompt for Private Contextual Note (Local Save)
    else Token Expired or Invalid
        Backend-->>Scanner: 400 Bad Request (Stale / Invalid QR)
    end

    Note over Scanner,DB: Organizer Cryptographic Stamping
    opt If Scanner is Verified Organizer
        Scanner->>Backend: POST /api/v1/passport/stamp { attendee_id, event_id, signature }
        Backend->>DB: INSERT INTO passport_stamps (verified_by, event_id, timestamp)
        Backend->>Attendee: Push Notification ("🎉 New Stamp Earned!")
    end
```

---

## 💻 Technical Stack & Hardware Abstraction

### Client & Native Mobile
- **Core Framework:** React 18 with TypeScript
- **Native Container:** Capacitor 6.0 (Android build target with native Java/Kotlin bridge)
- **Styling:** Tailwind CSS with GPU-accelerated CSS transforms for 3D passport flips and stamp application
- **Icons & UI Assets:** Lucide React, Framer Motion
- **Native Plugins:**
  - `@capacitor-mlkit/barcode-scanning` (Google ML Kit Barcode scanning on Android)
  - `@capacitor/push-notifications` (FCM native push bindings)
  - `@capacitor/haptics` (Physical feedback on scan completion)
  - `@capacitor/storage` / `@capacitor-community/sqlite` (Encrypted offline-first storage)

### Backend & Infrastructure
- **Server Runtime:** Node.js / Express (TypeScript) or Go REST microservices
- **Primary Database:** PostgreSQL 16 (Relational models for passport graphs, connections, stamps, and vouches)
- **In-Memory Cache & Session:** Redis 7.2 (Time-decay QR token verification, active event broadcast caches, rate limiting)
- **Push Engine:** Firebase Admin SDK / Firebase Cloud Messaging (FCM)
- **Containerization & CI/CD:** Docker, Docker Compose, GitHub Actions for automated Android APK builds

### Hardware Abstraction: `useScanner` Hook
Loopin implements a unified, platform-agnostic scanner hook that transparently detects the underlying execution environment:

```typescript
// src/hooks/useScanner.ts
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

export interface ScanResult {
  rawValue: string;
  format?: string;
  durationMs: number;
}

export function useScanner() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    async function checkSupport() {
      if (isNative) {
        const { supported } = await BarcodeScanner.isSupported();
        setIsSupported(supported);
      } else {
        // Fallback check for HTML5 MediaDevices API
        setIsSupported(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
      }
    }
    checkSupport();
  }, [isNative]);

  const startScan = useCallback(async (): Promise<ScanResult | null> => {
    const startTime = performance.now();
    setIsScanning(true);

    try {
      if (isNative) {
        // Request camera permissions via Capacitor
        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera !== 'granted' && camera !== 'limited') {
          throw new Error('Camera permission denied on Android device.');
        }

        // Fast native ML Kit scan
        const { barcodes } = await BarcodeScanner.scan({
          formats: [BarcodeFormat.QrCode],
        });

        const scanDuration = performance.now() - startTime;
        if (barcodes.length > 0) {
          return {
            rawValue: barcodes[0].rawValue,
            format: barcodes[0].format,
            durationMs: scanDuration,
          };
        }
      } else {
        // PWA / Browser HTML5 Video Stream implementation
        return await startWebScan(startTime);
      }
      return null;
    } finally {
      setIsScanning(false);
    }
  }, [isNative]);

  const stopScan = useCallback(async () => {
    if (isNative) {
      await BarcodeScanner.stopScan();
    }
    setIsScanning(false);
  }, [isNative]);

  return { isSupported, isScanning, startScan, stopScan };
}

// Fallback HTML5 Web scanner helper omitted for brevity
async function startWebScan(startTime: number): Promise<ScanResult | null> {
  // WebRTC / BarcodeDetector API implementation
  return null;
}
```

---

## 🗄️ Data Models & Schema Design

### PostgreSQL Relational Schema

```sql
-- Users & Dev Passports
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    handle VARCHAR(50) UNIQUE NOT NULL,
    headline VARCHAR(255),
    github_url VARCHAR(255),
    linkedin_url VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hackathon & Meetup Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    tagline TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'hackathon', 'mini_hack', 'meetup'
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE
);

-- Cryptographic Visa Stamps (Organizer-issued)
CREATE TABLE passport_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES users(id),
    stamp_signature TEXT NOT NULL, -- Cryptographic organizer signature
    tier VARCHAR(50) DEFAULT 'ATTENDEE', -- 'ATTENDEE', 'FINALIST', 'PODIUM', 'WINNER'
    track_name VARCHAR(100),
    stamped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_event_stamp UNIQUE(user_id, event_id, tier)
);

-- Verified Hackathon Repositories & Modules
CREATE TABLE event_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    project_title VARCHAR(200) NOT NULL,
    repo_url VARCHAR(255) NOT NULL,
    demo_url VARCHAR(255),
    track_name VARCHAR(100),
    podium_position INT, -- 1, 2, 3 or NULL
    tech_stack TEXT[] NOT NULL DEFAULT '{}'
);

-- Peer Vouches
CREATE TABLE peer_vouches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES event_submissions(id) ON DELETE CASCADE,
    voucher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_contributed VARCHAR(200) NOT NULL, -- e.g., "RAG Indexing Pipeline"
    testimonial TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_vouch UNIQUE(submission_id, voucher_id, recipient_id)
);

-- In-Person Connections
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_context_id UUID REFERENCES events(id) ON DELETE SET NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_mutual_connection UNIQUE(user_a_id, user_b_id)
);

-- Private Contextual Notes (Client-synced, encrypted)
CREATE TABLE private_connection_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    encrypted_note TEXT NOT NULL,
    custom_tags TEXT[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔒 Privacy, Security & DPDP Compliance

Loopin is architected from the ground up to respect data minimization and consent requirements defined under **India's Digital Personal Data Protection (DPDP) Act, 2023**.

1. **Time-Decay Tokenized QR Payloads:**
   - Attendee QR codes do not embed raw profile data or static UUIDs.
   - Payloads contain short-lived, encrypted tokens (`TTL = 60s`) signed with HMAC-SHA256 and rotated automatically to prevent physical badge scraping and unauthorized surveillance.
2. **Private Notes Isolation:**
   - Contextual notes attached after a scan are strictly one-directional and private.
   - The scanned party is never notified of private notes, and note payloads can be end-to-end encrypted with the author's local key.
3. **Right to Erasure & Purpose Limitation:**
   - Attendees maintain complete sovereignty over their Dev Passport visibility.
   - Supports granular privacy toggles: *Public Portfolio*, *Genesis Ecosystem Only*, or *Selective Connection Access*.
4. **Cryptographic Organizer Signatures:**
   - Stamp issuance requires valid organizer asymmetric cryptographic signatures, preventing unauthorized stamp forging or rogue database tampering.

---

## 📊 Performance Benchmarks & Success Metrics

| Metric | Target / Benchmark | Implementation Strategy |
| :--- | :--- | :--- |
| **Scan-to-Exchange Latency** | **$\le 400\text{ ms}$** | Direct Android ML Kit hardware binding without JS thread serialization bottlenecks. |
| **QR Verification Throughput** | **$> 2,500\text{ ops/sec}$** | In-memory Redis pipeline verification for active venue check-ins. |
| **Event Day Engagement** | **$> 80\%$ adoption** | Frictionless PWA fallback with instant Android APK onboarding at venue gates. |
| **Post-Event D30 Retention** | **$> 40\%$ active** | Long-term utility of the verifiable Dev Passport for internship and job applications. |
| **Live Push Alert Latency** | **$< 1.5\text{ s}$** | High-priority FCM broadcast multicast channels with Redis subscriber queues. |

---

## 📂 Project Directory Structure

```text
loopin-by-genesishacks/
├── android/                        # Native Android Capacitor Project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── java/org/genesishacks/loopin/MainActivity.java
│   │   └── build.gradle
│   └── capacitor.settings.gradle
├── backend/                        # Node.js / Express API Server
│   ├── src/
│   │   ├── config/                 # Redis, Postgres, and FCM setup
│   │   ├── controllers/            # Passport, Network, Auth, LiveOps
│   │   ├── middleware/             # RateLimiter, DPDPAuth, Validator
│   │   ├── models/                 # Database models and queries
│   │   ├── routes/                 # Express API route endpoints
│   │   ├── services/               # Stamping engine, QR Token manager
│   │   └── server.ts
│   ├── Dockerfile
│   └── package.json
├── client/                         # React + TypeScript + Capacitor Client
│   ├── public/
│   │   ├── favicon.ico
│   │   └── manifest.json           # PWA Manifest
│   ├── src/
│   │   ├── assets/                 # Icons, badge 3D textures, stamp SVGs
│   │   ├── components/
│   │   │   ├── passport/           # Dev Passport, Visa Stamp, Trophy Case
│   │   │   ├── scanner/            # Camera Viewfinder, Overlay, Flash
│   │   │   ├── networking/         # Connection Cards, Private Notes Modal
│   │   │   └── liveops/            # Announcement Feed, Push Banner
│   │   ├── hooks/
│   │   │   ├── useScanner.ts       # Platform-agnostic scanner hook
│   │   │   ├── usePassport.ts      # Stamping & reputation query hook
│   │   │   └── useLiveOps.ts       # FCM notifications & event stream
│   │   ├── pages/
│   │   │   ├── PassportScreen.tsx
│   │   │   ├── ScannerScreen.tsx
│   │   │   ├── ConnectionsScreen.tsx
│   │   │   └── LiveOpsFeed.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── capacitor.config.ts         # Capacitor Native Config
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml              # PostgreSQL, Redis & API orchestration
├── LICENSE
└── README.md
```

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js:** `v18.x` or `v20.x` LTS
- **Package Manager:** `npm` or `pnpm`
- **Docker & Docker Compose:** For running PostgreSQL and Redis services
- **Android Studio:** Android SDK Platform 34, Build Tools, and JDK 17 (for Android builds)

---

### Environment Configuration

Create a `.env` file inside both `client/` and `backend/`:

#### `backend/.env`
```env
PORT=5000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://loopin_admin:loopin_secret@localhost:5432/loopin_db
REDIS_URL=redis://localhost:6379

# JWT & Cryptographic Salts
JWT_SECRET=super_secret_jwt_key_loopin_2026
QR_HMAC_SECRET=super_secret_hmac_qr_salt_genesis

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=genesis-loopin
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@genesis-loopin.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

#### `client/.env`
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_ENABLE_MOCK_SCANNER=false
VITE_FIREBASE_VAPID_KEY=your_public_vapid_key
```

---

### Web & PWA Development

To run the web client locally with hot-reloading:

```bash
# 1. Navigate to client
cd client

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

### Android Build & Deployment (Capacitor)

To compile the application to a native Android APK:

```bash
# 1. Inside client directory, build production web assets
npm run build

# 2. Sync web assets with native Android platform
npx cap sync android

# 3. Open project in Android Studio
npx cap open android
```

From Android Studio, click **Run** (or `Shift + F10`) to deploy to a connected Android device or emulator with camera permissions enabled.

To generate a signed APK directly from CLI:
```bash
cd android
./gradlew assembleRelease
```

---

### Backend & Database Setup

Use Docker Compose to bootstrap PostgreSQL and Redis:

```bash
# 1. Start database and cache services
docker-compose up -d postgres redis

# 2. Navigate to backend and install packages
cd backend
npm install

# 3. Run database migrations and seed default events
npm run db:migrate
npm run db:seed

# 4. Start backend API in watch mode
npm run dev
```

---

## 🤝 Contributing

We welcome contributions from the Genesis Hacks builder community!

1. Fork the repository (`git checkout -b feature/amazing-feature`).
2. Ensure your TypeScript compiles without warnings (`npm run typecheck`).
3. Commit your changes with conventional commits (`git commit -m 'feat: add haptic feedback on organizer stamp'`).
4. Push to your branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request for review by the Genesis Core Team.

---

## 📜 License & Acknowledgements

- **License:** Distributed under the [Apache 2.0 License](LICENSE).
- **Engineered with ❤️ by:** The **Genesis Hacks** Core Architecture Team for hackers and organizers worldwide.
