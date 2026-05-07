# ATLAS US/Canada Regulatory Matrix & Cannabis Module

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domain 4 (US/Canada Regulatory Matrix) and the specialized Cannabis Event Licensing Module for California and emerging markets.

## Executive Summary
This document provides the definitive regulatory baseline for operating ATLAS network venues within the United States and Canada. It outlines federal, state/provincial, and municipal compliance requirements covering labor laws, tax withholding for foreign artists, performance rights organization (PRO) tariffs, and accessibility standards. Additionally, it details a specialized operational module for legally executing cannabis-integrated live music events under California's MAUCRSA framework, providing a blueprint for high-margin, compliant ancillary revenue.

---

## Part A — United States Regulatory Matrix

### 1. Federal Compliance & Taxation
*   **Foreign Artist Withholding (IRS CWA):** The IRS mandates a 30% withholding tax on the gross income of nonresident alien (NRA) artists touring the US. 
    *   *ATLAS Protocol:* The Concierge AI must automatically prompt the filing of a Central Withholding Agreement (CWA) 45 days prior to the first tour date. A CWA allows withholding based on *net* projected income (after deductible expenses like flights and hotels) rather than gross, significantly improving cash flow for international acts.
*   **Americans with Disabilities Act (ADA):** Title III requires public accommodations, including concert venues, to provide accessible seating, clear sightlines, and accessible restrooms.
    *   *ATLAS Protocol:* Venue onboarding requires an ADA compliance checklist upload. Venues failing ADA compliance are flagged with a "Restricted Capacity" tag in the booking engine until remediation is proven.
*   **Labor Classification (W-2 vs. 1099):** Strict enforcement by the Department of Labor (DOL) regarding the classification of touring crew and local stagehands.
    *   *ATLAS Protocol:* All local venue stagehands must be classified as W-2 employees of the venue or a bonded third-party staffing agency. Touring crew paid directly by the artist may remain 1099 independent contractors if they meet the IRS control test.

### 2. State & Municipal Level (Key Markets)
*   **California (AB5):** The "gig worker" bill severely limits the use of 1099 contractors.
    *   *ATLAS Protocol:* CA venues must utilize a payroll service (e.g., Wrapbook or Entertainment Partners) integrated via API for all local crew to ensure AB5 compliance.
*   **New York (SLA & Noise Code):** The State Liquor Authority (SLA) enforces strict operational boundaries. NYC Noise Code limits amplified sound to 42 dBA as measured from inside a neighboring residence between 10 PM and 7 AM.
    *   *ATLAS Protocol:* NYC venues must install integrated decibel limiters that feed telemetry back to the ATLAS dashboard to prevent SLA violations.

---

## Part B — Canada Regulatory Matrix

### 1. Performance Rights & Tariffs
*   **SOCAN (Society of Composers, Authors and Music Publishers of Canada):** The sole PRO in Canada for musical works.
    *   *ATLAS Protocol:* Under SOCAN Tariff 4.A (Popular Music Concerts), venues/promoters must remit 3% of gross ticket receipts to SOCAN. The ATLAS Settlement Agent automatically deducts this 3% at the point of digital door settlement and holds it in escrow for quarterly SOCAN remittance.

### 2. Provincial Liquor Licensing
*   **Ontario (AGCO):** The Alcohol and Gaming Commission of Ontario requires specific licensing for live music venues.
    *   *ATLAS Protocol:* For pop-up or non-traditional spaces, the AI must guide the promoter through the Special Occasion Permit (SOP) process via the iAGCO portal at least 30 days prior to the event.

---

## Part C — The Cannabis Event Module (California MAUCRSA)

With the passage of the Medicinal and Adult-Use Cannabis Regulation and Safety Act (MAUCRSA), California established a framework for legal cannabis consumption and sales at live events. This represents a massive ancillary revenue opportunity for independent venues.

### 1. Licensing Requirements
To host a legal cannabis consumption event, two specific licenses are required:
*   **Type 17 (Cannabis Event Organizer License):** Held by the promoter or the ATLAS platform entity. Requires background checks and state bonding.
*   **Temporary Cannabis Event License:** Applied for on a per-event basis (at least 60 days in advance). The event must be held at a venue that has written authorization from the local municipality (e.g., a county fairground or a specifically zoned private venue).

### 2. Operational Constraints
*   **Age Gating:** Strict 21+ entry. No individuals under 21 may enter the designated consumption area, even if they are the performing artist.
*   **Sales & Distribution:** Only licensed retail dispensaries (Type 9 or Type 10) may sell cannabis products at the event. The Event Organizer (Type 17) cannot directly sell products but can charge the retailers a booth fee or a percentage of gross sales.
*   **Alcohol Prohibition:** Under current California regulations, alcohol and cannabis cannot be sold or consumed in the same designated area. 
    *   *ATLAS Protocol:* Venues must be architecturally zoned. The AI will generate floor plans separating the "Type 47 Liquor Zone" from the "Type 17 Cannabis Zone" with hard physical barriers and separate security checkpoints.

### 3. Concierge AI Workflow for Cannabis Events
1.  **Feasibility Check:** Promoter requests a cannabis-integrated show. AI checks municipal zoning laws (e.g., City of West Hollywood permits it; City of Beverly Hills may not).
2.  **License Routing:** AI verifies the promoter holds a Type 17 license and automatically drafts the Temporary Event application.
3.  **Vendor Matching:** AI matches the event with licensed local dispensaries willing to pay the vendor fee, integrating the contracts via the Document Automation Engine.

---
## Sources
1. IRS Central Withholding Agreement (CWA) Guidelines.
2. California Department of Cannabis Control (DCC) License Types.
3. SOCAN Tariff 4.A Decisions (Copyright Board of Canada).
4. NYC Department of Environmental Protection (DEP) Noise Code.
