# ATLAS Africa Regulatory Matrix

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domain 2 and 3 (Africa live music infrastructure, PROs, visa regimes, and data compliance).

## Executive Summary
This document establishes the compliance baseline for ATLAS network venues and touring artists operating across the African continent. Africa is not a monolith; it requires navigating fragmented regional economic communities, distinct Performance Rights Organizations (PROs), and emerging data privacy laws. This matrix focuses on the primary touring corridors: West Africa (ECOWAS), East Africa (EAC), and Southern Africa (SADC).

---

## Part A — Regional Visa Regimes & Touring Corridors

To build viable, multi-city tours across Africa, ATLAS must leverage regional visa blocs to minimize friction and cost.

### 1. West Africa: The ECOWAS Corridor (Nigeria, Ghana, Senegal, Côte d'Ivoire)
*   **ECOWAS Protocol on Free Movement:** Citizens of the 15 Economic Community of West African States (ECOWAS) member countries can travel visa-free within the bloc for up to 90 days.
    *   *ATLAS Protocol:* For West African artists (e.g., a Nigerian Afrobeats artist touring Ghana and Senegal), the AI routes the tour using ECOWAS visa-free status, significantly reducing advance timelines.
*   **Non-ECOWAS Artists:** Artists from outside the bloc (e.g., US, UK, South Africa) must obtain separate visas for each country.
    *   *ATLAS Protocol:* The AI must flag the "Nigeria Short Visit Visa (SVV)" or "Temporary Work Permit (TWP)" requirement 60 days in advance, as processing times via the Nigerian Immigration Service can be unpredictable.

### 2. East Africa: The EAC Corridor (Kenya, Uganda, Rwanda)
*   **East African Tourist Visa (EATV):** A joint initiative allowing tourists (and often short-term cultural performers, depending on the specific immigration officer's interpretation) to travel freely between Kenya, Uganda, and Rwanda for 90 days on a single $100 USD visa.
    *   *ATLAS Protocol:* The AI should optimize East African routing to cluster these three countries, utilizing the EATV to minimize border friction.
*   **Tanzania:** Currently not part of the EATV scheme; requires a separate visa.

### 3. Southern Africa: The SADC Corridor (South Africa, Zambia, etc.)
*   **SADC Protocol:** While the Southern African Development Community (SADC) aims for free movement, practical implementation varies. South Africa maintains strict visa requirements for many African nationals.
    *   *ATLAS Protocol:* South Africa requires a Section 11(2) Visitor's Visa with authorization to conduct work for touring artists. The AI must initiate this process via VFS Global at least 8 weeks prior to the tour.

---

## Part B — Performance Rights Organizations (PROs)

Licensing compliance is aggressively enforced in key African markets. The ATLAS Settlement Agent must integrate the following PRO tariffs:

### 1. Nigeria (COSON & MCSN)
*   **The Landscape:** Nigeria has a dual-PRO system due to historical legal battles between the Copyright Society of Nigeria (COSON) and the Musical Copyright Society Nigeria (MCSN). Both claim authority to collect public performance royalties.
*   *ATLAS Protocol:* Venues must hold a valid license from the government-approved collecting society (currently MCSN holds primary regulatory backing, though COSON remains active). The AI must verify the venue's MCSN/COSON certificate during onboarding to prevent the venue from being shut down by enforcement raids.

### 2. South Africa (SAMRO)
*   **Southern African Music Rights Organisation (SAMRO):** The dominant PRO in Southern Africa.
*   *ATLAS Protocol:* Venues must pay annual licensing fees, and promoters must submit setlists for live events. The ATLAS Document Automation Engine automatically generates and submits the SAMRO setlist return post-show.

### 3. Other Key Markets
*   **Ghana:** GHAMRO (Ghana Music Rights Organization).
*   **Kenya:** MCSK (Music Copyright Society of Kenya).

---

## Part C — Data Privacy & Compliance (POPIA & NDPR)

As ATLAS processes ticketing data and artist information, it must comply with emerging African data protection frameworks.

### 1. South Africa: Protection of Personal Information Act (POPIA)
*   **Requirement:** POPIA is South Africa's equivalent to GDPR. It mandates strict consent for marketing, data localization considerations, and mandatory breach notification.
*   *ATLAS Protocol:* Any ticketing data collected from South African IP addresses or for South African venues must be processed through POPIA-compliant servers. The AI must ensure the venue onboarding DPA includes POPIA-specific clauses.

### 2. Nigeria: Nigeria Data Protection Regulation (NDPR)
*   **Requirement:** NDPR governs the processing of personal data for Nigerian citizens.
*   *ATLAS Protocol:* ATLAS must appoint a Data Protection Officer (DPO) for its Nigerian operations and conduct an annual data protection audit if processing data for more than 2,000 Nigerian data subjects annually.

---
## Sources
1. ECOWAS Protocol on Free Movement of Persons.
2. East African Community (EAC) Joint Tourist Visa Guidelines.
3. South Africa Protection of Personal Information Act (POPIA).
4. Nigerian Copyright Commission (NCC) Directives on MCSN/COSON.
