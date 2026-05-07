# ATLAS Platform Technical Architecture

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domain 12 (Platform technical architecture, database design, and microservices for the ATLAS Concierge and Ticketing Engine).

## Executive Summary
This document outlines the core technical architecture for the ATLAS SaaS platform. To handle high-velocity ticket on-sales, cross-border payment routing, and complex multi-tenant venue management, ATLAS employs an Event-Driven Microservices Architecture deployed on AWS. The system is designed to be highly available, fault-tolerant, and capable of operating in low-bandwidth environments via offline-first edge nodes.

---

## Part A — System Topology & Microservices

The ATLAS platform is decomposed into loosely coupled microservices to allow independent scaling during high-traffic events (e.g., a major Afrobeats artist dropping a tour).

### 1. Core Microservices
*   **Identity & Access Management (IAM) Service:** Handles OAuth2/OIDC authentication for Venues, Promoters, and Fans. Implements Role-Based Access Control (RBAC) to separate venue owners from box office staff.
*   **Inventory & Seating Service:** The most critical component. Manages venue floor plans, seat locks, and VIP table inventory. 
*   **Concierge AI Service:** The orchestration layer that interacts with LLMs to generate contracts, calculate routing, and provide compliance alerts.
*   **Settlement & Ledger Service:** A double-entry accounting ledger that tracks all fiat and stablecoin (USDC) movements, calculating PRO deductions, tax withholdings, and split payouts.
*   **Field Ops Service:** Manages the API endpoints for the mobile scanning apps used at the venue doors.

### 2. Event-Driven Architecture (Kafka)
*   **The Problem:** During a high-demand ticket drop, thousands of users may attempt to add the same VIP table or GA ticket to their cart simultaneously. Traditional synchronous REST APIs will lock the database and crash.
*   **The Solution:** ATLAS utilizes **Apache Kafka** as an event broker. 
    *   When a user clicks "Buy," a `SeatLockRequested` event is published to Kafka.
    *   The Inventory Service consumes the event, verifies availability via Redis, and if successful, publishes a `SeatLocked` event, giving the user a 10-minute cart timer.
    *   This asynchronous flow ensures the database is never overwhelmed by concurrent write requests.

---

## Part B — Data Layer & Multi-Tenancy

ATLAS operates a B2B2C model. Venues are the "Tenants," and fans are the "Customers."

### 1. Multi-Tenant Database Design (PostgreSQL)
*   ATLAS uses a **Pool Model (Shared Database, Shared Schema)** for maximum resource efficiency, powered by PostgreSQL with Row-Level Security (RLS).
*   Every table (e.g., `Events`, `Tickets`, `Customers`) contains a `tenant_id` (the Venue ID).
*   *Security Protocol:* The application layer injects the `tenant_id` into the Postgres session context. RLS policies ensure that a venue manager querying `SELECT * FROM Tickets` only ever sees rows matching their `tenant_id`, preventing data leakage between competing venues.

### 2. Caching Layer (Redis)
*   **Redis** is used heavily for distributed locking and session management.
*   *Seat Locking:* The actual 10-minute lock on a ticket during checkout is stored in Redis with a Time-To-Live (TTL) expiration. If the payment is not completed in time, the key expires, and the ticket is instantly returned to the available inventory pool without hitting the primary Postgres database.

---

## Part C — Edge Architecture for Low-Bandwidth Environments

A key differentiator for ATLAS in emerging markets (Africa, LatAm) is the ability to operate when the local internet grid fails.

### 1. The Field Ops App (Offline-First)
*   The ATLAS mobile scanning app (used by venue security) is built with an offline-first architecture using **SQLite** on the device.
*   *Pre-Show Sync:* 2 hours before doors open, the app downloads the complete encrypted guest list and ticket hashes from the cloud.
*   *Offline Scanning:* If the venue loses internet, the app continues to scan QR codes locally, validating the cryptographic signature of the ticket to prevent fraud.
*   *Post-Show Sync:* Once connectivity is restored, the app syncs the "Scanned" timestamps back to the central database, triggering the final door settlement process.

### 2. Infrastructure Hosting
*   **AWS Deployment:** The core stack is hosted on AWS using Elastic Kubernetes Service (EKS) for container orchestration.
*   **Content Delivery Network (CDN):** Cloudflare is used to cache static assets (venue maps, artist images) close to the user, significantly reducing load times in regions with high latency.

---
## Sources
1. AWS Architecture Center: Event-Driven Architectures.
2. PostgreSQL Documentation on Row-Level Security (RLS) for Multi-Tenancy.
3. Apache Kafka Documentation (Event Streaming).
