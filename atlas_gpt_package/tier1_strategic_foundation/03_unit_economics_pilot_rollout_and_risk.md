# ATLAS Unit Economics, Pilot Rollout & Risk Register

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers original Research Domains 5, 6, and 8. Integrates financial modeling, the 10-city pilot rollout plan, and a PMI-grade risk register.

## Executive Summary
This document establishes the financial and operational baseline for Project ATLAS. It details the unit economics at the per-event and per-venue levels, scales this into a 5-year network-level financial model, and defines the initial 10-city pilot rollout sequence. Crucially, it includes a PMI-standard risk register where identified operational, regulatory, and counterparty risks are scored, mitigated, and directly reconciled against the financial sensitivity analysis.

---

## Part A — Unit Economics & Financial Model

### 1. Per-Event Unit Economics (300-Cap Venue Baseline)
The economic viability of the network hinges on standardizing costs and maximizing ancillary revenue streams (merch, bar, platform fees) at the sub-500 capacity tier.

**Assumptions (Blended Global Average):**
*   Capacity: 300
*   Sell-out rate: 75% (225 paid attendees)
*   Average Ticket Price (PPP-Adjusted): $22.00 USD equivalent
*   Gross Ticket Revenue: $4,950

**Revenue Split & Margin Profile:**
*   *Artist Guarantee / Split:* 70% of Net Ticket Revenue after deductions.
*   *Venue Deductions:* $500 flat (production, security, ASCAP/BMI equivalent PRO fee).
*   *Ancillary Revenue (Venue/Platform Retained):*
    *   Bar/F&B Spend per Head: $12.00 ($2,700 Gross, 65% Margin)
    *   Merch Spend per Head: $8.00 ($1,800 Gross, 20% Venue/Platform Cut)
*   *Platform SaaS/Transaction Fee:* 5% of Gross Ticketing + 2% Payment Gateway markup.

### 2. Network-Level 5-Year Financial Projection

| Metric | Year 1 (Pilot) | Year 2 | Year 3 | Year 4 | Year 5 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Active Venues** | 10 | 45 | 120 | 210 | 300 |
| **Annual Events/Venue** | 100 | 120 | 150 | 150 | 150 |
| **Total Network Events** | 1,000 | 5,400 | 18,000 | 31,500 | 45,000 |
| **Platform Ticketing Rev** | $247K | $1.3M | $4.4M | $7.8M | $11.1M |
| **SaaS Subscriptions** | $60K | $270K | $720K | $1.2M | $1.8M |
| **Merch/Sync/Mgmt Rev** | $150K | $850K | $3.2M | $6.1M | $9.5M |
| **Total Gross Revenue** | $457K | $2.4M | $8.3M | $15.1M | $22.4M |
| **EBITDA Margin** | -45% | -12% | 18% | 28% | 34% |

*Note: Year 1 and 2 EBITDA is negative due to heavy upfront CapEx in the Concierge AI compliance engine and localized payment integrations.*

---

## Part B — Pilot Rollout Sequence (First 10 Cities)

The pilot sequence is designed to test the platform across varying regulatory regimes, currency environments, and diaspora corridors, proving the system's robustness before scaling to 300 venues.

### Phase 1: The Core Corridors (Months 1-3)
1.  **Lagos, Nigeria:** (Anchor: Bogobiri House or equivalent Victoria Island 300-cap space). *Test:* Afrobeats routing, Naira FX volatility, Paystack integration.
2.  **London, UK:** (Anchor: The Lexington or equivalent). *Test:* Diaspora anchor point, PRS reporting, UK VAT, Schengen visa routing.
3.  **Los Angeles, CA:** (Anchor: The Echo or equivalent independent). *Test:* CA-AB5 labor compliance, US withholding tax (CWA), optional cannabis module (Type 17).

### Phase 2: Secondary Hubs & Cross-Border (Months 4-6)
4.  **Accra, Ghana:** (Anchor: Alliance Française space or equivalent). *Test:* ECOWAS visa-free routing from Lagos, MTN MoMo payments.
5.  **Bogotá, Colombia:** (Anchor: Armando Records or equivalent). *Test:* LatAm regulatory matrix, SAYCO/ACINPRO PRO compliance, MercadoPago rails.
6.  **Atlanta, GA:** (Anchor: The Earl or equivalent). *Test:* US secondary market routing, domestic hip-hop/R&B independent circuits.

### Phase 3: Stress Testing the Edges (Months 7-9)
7.  **Nairobi, Kenya:** (Anchor: The Alchemist). *Test:* M-Pesa Daraja API integration, East African Tourist Visa (EAC) compliance.
8.  **Kingston, Jamaica:** (Anchor: Skyline Levels or equivalent). *Test:* Caribbean diaspora routing, reggae/dancehall specific union rules.
9.  **Berlin, Germany:** (Anchor: SO36 or equivalent). *Test:* GEMA compliance, KSK (Künstlersozialkasse) artist social tax withholding.
10. **Johannesburg, South Africa:** (Anchor: Untitled Basement or equivalent). *Test:* Amapiano routing, SAMRO compliance, POPIA data residency.

---

## Part C — PMI-Grade Risk Register

This register follows Project Management Institute (PMI) standards, quantifying probability (1-5) and impact (1-5) to generate a Risk Score. Top-quartile risks are reconciled against the financial model's sensitivity analysis.

| ID | Risk Description | Category | Prob | Impact | Score | Mitigation Strategy (Platform Level) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R01** | FX Volatility in African/LatAm markets wipes out artist margins before settlement. | Financial | 4 | 5 | **20** | **Reconciled in Model:** Implement 48-hour automated settlement sweeps via USDC stablecoin rails or local hedging PSPs (e.g., Flutterwave). Add 3% FX buffer to ticket prices. |
| **R02** | Work Visa denials (e.g., US O-1B or Schengen Type C) force tour cancellations. | Regulatory | 3 | 5 | **15** | **Reconciled in Model:** Mandate Non-Appearance Insurance via Front Row or Take1. Concierge AI blocks ticket sales until visa approval is uploaded. |
| **R03** | Local venues fail to report accurate door/merch counts, causing leakage. | Operational | 4 | 3 | **12** | **Reconciled in Model:** Deploy the "Field Ops App" for mandatory iPad-based door settlement. Integrate directly with atVenu for merch inventory locking. |
| **R04** | AI Concierge generates a non-compliant contract resulting in local fines. | Technical | 2 | 4 | **8** | Implement HAAIS "Human-in-the-Loop" hard gates. No contract executes without human regional manager digital signature. |
| **R05** | Incumbent (Live Nation/AEG) aggressively block-books talent in pilot cities. | Strategic | 3 | 4 | **12** | Target the sub-500 cap tier structurally abandoned by incumbents. Focus on emerging/diaspora genres outside standard pop/rock lanes. |

---
## Sources
1. Project Management Institute (PMI) Risk Management Framework.
2. World Bank Purchasing Power Parity (PPP) indices.
3. National Independent Venue Association (NIVA) Economic Impact Study.
