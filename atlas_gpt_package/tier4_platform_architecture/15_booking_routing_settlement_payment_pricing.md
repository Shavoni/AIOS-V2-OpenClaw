# ATLAS Booking, Routing, Settlement, Payment & Pricing

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domains 8 (Dynamic Pricing & Settlement Logic) and 9 (Routing Algorithms) for the ATLAS SaaS platform.

## Executive Summary
This document outlines the mathematical and algorithmic engines that power the financial and logistical core of the ATLAS platform. It covers the Traveling Salesman heuristic used for tour routing, the ethical implementation of dynamic pricing (avoiding the pitfalls of legacy ticketing giants), and the automated digital door settlement system that ensures artists and promoters are paid instantly and accurately.

---

## Part A — The Routing Engine (TSP Optimization)

Booking a multi-city tour is a variation of the classic Traveling Salesman Problem (TSP). The ATLAS Routing Engine optimizes for minimum travel time and maximum profit.

### 1. The Heuristic Routing Algorithm
*   **The Problem:** Given 10 potential cities in Europe, what is the optimal sequence to visit them, factoring in "off-days" and geographical constraints?
*   **The ATLAS Solution:** The platform utilizes a Nearest Neighbor (NN) heuristic combined with real-time flight and train API data (e.g., Amadeus).
*   **Constraints Injected:**
    *   *Visa Boundaries:* The algorithm will not route an artist from the UK (non-Schengen) to France (Schengen) and back to the UK within 3 days to avoid burning multiple visa entries.
    *   *Cabotage Limits:* For EU tours, the algorithm ensures no more than 3 internal cabotage movements within 7 days for UK-registered freight.
    *   *Radius Clauses:* The engine automatically respects standard 90-mile / 60-day radius clauses, preventing a routing that cannibalizes ticket sales in adjacent markets.

---

## Part B — Ethical Dynamic Pricing

Legacy ticketing platforms have weaponized dynamic pricing, leading to massive fan backlash (e.g., the Oasis 2025/2026 ticketing fiascos). ATLAS implements a "Smart Pricing" model that protects fan trust while maximizing venue revenue.

### 1. The "Capped Beta" Pricing Algorithm
*   **The Mechanism:** Instead of allowing prices to surge infinitely based on real-time demand, ATLAS promoters set a **Price Floor** and a **Hard Price Ceiling** (e.g., $30 to $60) during the initial build.
*   **Demand Sensing:** The algorithm monitors the velocity of sales (tickets sold per minute). If velocity exceeds the historical benchmark for that venue, the price steps up incrementally within the capped range.
*   **The "Deal Score" Integration:** Similar to SeatGeek's API, the ATLAS consumer widget displays a "Value Score" to the fan, showing transparency about the current price tier relative to the ceiling.

### 2. Anti-Scalping Protocols
*   **Cryptographic Ticketing:** All ATLAS tickets are dynamically rotating QR codes tied to the purchaser's device ID. Screenshots do not work.
*   **Face-Value Exchange:** Fans who cannot attend can only resell their ticket on the internal ATLAS exchange, capped at the original purchase price plus a nominal 5% administrative fee.

---

## Part C — Digital Door Settlement & Split Payouts

The "Settlement" (the post-show accounting where the venue, promoter, and artist divide the revenue) is historically a tense, manual process done with spreadsheets at 2 AM. ATLAS automates this entirely.

### 1. The Automated Settlement Ledger
*   As tickets are scanned at the door via the Field Ops App, the digital ledger locks the final attendance numbers.
*   **The Waterfall Calculation:**
    1.  **Gross Box Office Receipts (GBOR):** Total ticket revenue.
    2.  **Taxes & Tariffs:** Automatic deduction of VAT (e.g., 20% UK), PRO fees (e.g., 4.2% PRS), and local tax withholdings (e.g., 5% KSK in Germany).
    3.  **Net Box Office Receipts (NBOR):** The divisible pool.
    4.  **Venue Expenses:** Deduction of pre-approved, receipt-backed expenses (e.g., $500 for local stagehands, $200 for catering).
    5.  **The Split:** The remaining NBOR is divided according to the smart contract (e.g., 85% Artist / 15% Promoter).

### 2. Instant Payout Execution
*   Once the venue manager and the tour manager click "Approve Settlement" on their respective ATLAS dashboards, the API triggers the payout.
*   Funds held in the ATLAS Stripe/Flutterwave escrow are instantly routed to the respective bank accounts or crypto wallets (USDC), eliminating the standard 30-to-60-day wait for wire transfers.

---
## Sources
1. arXiv: Ticket Pricing Distributions as Scaled Beta Distributions (2025).
2. MDPI: Heuristic Methods for Generating TSP Candidate Sets.
3. Tipalti / Prism.fm: Automated Settlement in Live Music.
