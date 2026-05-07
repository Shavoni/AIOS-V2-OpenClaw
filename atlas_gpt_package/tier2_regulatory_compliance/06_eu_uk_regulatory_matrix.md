# ATLAS EU/UK Regulatory Matrix

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domain 5 (EU and UK regulatory matrix for touring artists and live venues).

## Executive Summary
This document establishes the compliance baseline for ATLAS network venues and touring artists operating within the United Kingdom and the European Union. The post-Brexit regulatory environment has severely complicated cross-channel touring. This matrix details the visa pathways, the Schengen 90/180 rule, cabotage limits for touring freight, Performance Rights Organization (PRO) tariffs, artist social tax withholding (KSK in Germany), and GDPR ticketing data compliance. 

---

## Part A — United Kingdom Post-Brexit Touring

### 1. Visa Pathways for Artists
Following Brexit, EU artists no longer have freedom of movement to work in the UK. The ATLAS platform must route artists through one of two primary pathways:
*   **Permitted Paid Engagement (PPE) Visitor Route:** Allows professionals (including musicians) to enter the UK for up to 30 days to fulfill a paid engagement. 
    *   *Constraint:* The engagement must be pre-arranged, and the artist must prove they are a professional in their home country.
*   **Tier 5 (Temporary Worker - Creative and Sporting) Visa:** For longer tours or residencies. Requires a UK sponsor (e.g., the UK promoter or venue) to issue a Certificate of Sponsorship (CoS).
    *   *ATLAS Protocol:* The Concierge AI must assess the tour length. If >30 days, the AI automatically prompts the UK ATLAS node to generate a Tier 5 CoS application.

### 2. Performance Rights (PRS for Music)
*   **PRS for Music:** The UK's primary PRO.
    *   *Tariff LP (Live Popular Music):* The standard rate is 4.2% of gross ticket receipts. 
    *   *ATLAS Protocol:* The Settlement Agent deducts 4.2% from the digital door settlement and escrows it for PRS remittance.

---

## Part B — European Union (Schengen Area) Compliance

### 1. The Schengen 90/180 Rule & Work Permits
UK and non-EU artists are limited to spending 90 days out of any 180-day period within the Schengen Area. Furthermore, a Schengen visa waiver does *not* automatically grant the right to work (perform for pay).
*   *ATLAS Protocol:* The Concierge AI must track the passport stamps of all touring personnel. If a proposed tour routing pushes an artist past day 85 of their Schengen allowance, the AI must block the routing and alert the human operator.
*   *Bilateral Exceptions:* Certain EU member states (e.g., France, Germany) offer limited work permit exemptions for short-term cultural activities (typically under 90 days), but these must be verified country-by-country.

### 2. Cabotage and Freight Logistics
*   **Cabotage Rules:** Post-Brexit, UK hauliers (tour buses/trucks carrying gear) are limited to a maximum of three internal movements (cabotage operations) within the EU within a 7-day period.
    *   *ATLAS Protocol:* For tours spanning more than three EU cities, the AI must mandate the hiring of an EU-registered transport company or split the logistics to remain compliant.

### 3. Performance Rights Organizations (PROs) by Key Market
The ATLAS Settlement Agent must adjust its PRO deduction algorithms based on the venue's jurisdiction:
*   **France (SACEM):** Variable rates based on venue size and ticket price; typically ranges from 4% to 8%.
*   **Germany (GEMA):** Highly complex tariff structure (Tarif U-K) based on venue square footage and admission price.
*   **Netherlands (BUMA/STEMRA):** Typically around 5% of box office.
*   **Spain (SGAE) & Italy (SIAE):** Often exceed 8% and require pre-event licensing deposits.

### 4. Germany-Specific: Künstlersozialkasse (KSK)
*   **The KSK Tax:** Germany requires promoters/venues to pay an "Artists' Social Security Insurance Levy" (Künstlersozialabgabe) on the net fees paid to freelance artists, regardless of whether the artist is German or foreign.
    *   *ATLAS Protocol:* The AI must calculate the current KSK rate (approx. 5.0% - 5.2%) on top of the artist guarantee and factor this into the venue's break-even calculation prior to offer generation.

---

## Part C — GDPR & Ticketing Data Sovereignty

The General Data Protection Regulation (GDPR) imposes strict rules on how fan data (purchasers) is collected, stored, and shared.

### 1. Data Processing Agreements (DPAs)
*   **Requirement:** ATLAS acts as a "Data Processor" for the venues (the "Data Controllers").
*   *ATLAS Protocol:* Every venue onboarding contract must include a standard GDPR DPA. 

### 2. Marketing Consent & "Opt-In"
*   **Requirement:** Pre-ticked boxes for marketing communications are illegal under GDPR.
*   *ATLAS Protocol:* The ATLAS ticketing widget must require explicit, active opt-in for (a) venue marketing and (b) artist marketing. The database must segment these consents and provide a one-click "Right to be Forgotten" erasure tool.

---
## Sources
1. UK Home Office Guidance on Permitted Paid Engagement and Tier 5 Visas.
2. PRS for Music Tariff LP.
3. European Commission Schengen Border Code (90/180 Rule).
4. Künstlersozialkasse (KSK) Information for Promoters (Germany).
5. EU General Data Protection Regulation (GDPR) Art. 28 (Processors).
