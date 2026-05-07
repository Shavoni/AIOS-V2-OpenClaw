# ATLAS LatAm & Caribbean Regulatory Matrix

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domain 6 (Latin America and Caribbean regulatory and market data).

## Executive Summary
This document details the regulatory compliance matrix for the Latin American and Caribbean regions. Operating live music venues and routing tours through LatAm requires navigating strict foreign artist withholding taxes, complex Performance Rights Organizations (PROs), and stringent data privacy laws (such as Brazil's LGPD). Furthermore, it addresses the recent easing of FX controls (the "cepo") in Argentina, which drastically impacts cross-border settlement logic for the ATLAS Concierge.

---

## Part A — Latin America: Key Market Regulations

### 1. Mexico
*   **Foreign Artist Withholding Tax:** Mexico imposes a steep withholding tax on non-resident artists. While the statutory corporate rate is 30%, payments to foreign-related parties or artists without a permanent establishment in Mexico can face withholding rates up to 40% depending on the tax treaty status and specific contract structure.
    *   *ATLAS Protocol:* The Concierge AI must generate contracts that explicitly define whether the artist guarantee is "Net of Mexican Withholding" or "Gross." The Settlement Agent must escrow the withholding amount prior to artist payout to ensure the venue is not left with the tax liability.
*   **PRO Compliance (SACM):** The *Sociedad de Autores y Compositores de México* (SACM) aggressively enforces live performance tariffs.
    *   *ATLAS Protocol:* Venues must hold an annual SACM license. The AI will flag any venue operating without a verified SACM certificate.

### 2. Brazil
*   **Data Privacy (LGPD):** The *Lei Geral de Proteção de Dados* (LGPD) is Brazil's equivalent to the GDPR. It applies to any entity processing the personal data of individuals located in Brazil, regardless of where the entity is headquartered.
    *   *ATLAS Protocol:* All ticketing data collected for Brazilian shows must comply with LGPD international data transfer rules. The ATLAS DPA must include specific clauses referencing Articles 7 and 11 of the LGPD.
*   **PRO Compliance (ECAD):** The *Escritório Central de Arrecadação e Distribuição* (ECAD) is a centralized agency that collects royalties on behalf of several Brazilian PROs. ECAD fees for live concerts are typically calculated as a percentage of gross box office receipts (often around 10%, though negotiable based on venue size).
    *   *ATLAS Protocol:* The Settlement Agent must automatically deduct the ECAD provision from the final door settlement.

### 3. Argentina
*   **FX Controls (The "Cepo"):** Historically, Argentina maintained strict capital controls ("cepo cambiario"), making it incredibly difficult to pay foreign artists in USD or EUR, forcing reliance on parallel exchange rates (e.g., Dólar Blue or Contado con Liqui).
    *   *2025/2026 Update:* As of mid-2025, Argentina has largely eliminated the "cepo" following a new IMF agreement, allowing for freer repatriation of dividends and artist fees.
    *   *ATLAS Protocol:* The AI Settlement Agent must monitor the Argentine Central Bank (BCRA) official rate. While the cepo is lifted, FX volatility remains high. Contracts must stipulate the exact date and time the ARS to USD conversion is locked for final settlement.
*   **PRO Compliance (SADAIC):** *Sociedad Argentina de Autores y Compositores de Música* collects live performance royalties, typically around 12% of gross ticket sales.

---

## Part B — The Caribbean Corridor

The Caribbean represents a vital diaspora routing corridor, particularly for reggae, dancehall, and soca artists.

### 1. Jamaica
*   **Entertainment Licensing:** Venues must obtain an Amusement Licence from the local Parish Council (e.g., Kingston and St. Andrew Municipal Corporation).
*   **Noise Abatement Act:** Strictly enforced, typically requiring outdoor events to end by midnight on weekdays and 2 AM on weekends, though extensions can be applied for.
    *   *ATLAS Protocol:* The AI must enforce hard curfews on set times generated for Jamaican venues to prevent police shutdowns.

### 2. General Caribbean Compliance
*   **CARICOM:** While the Caribbean Community (CARICOM) allows free movement for certain skilled nationals, touring artists often still require specific work permits depending on the island (e.g., Trinidad & Tobago requires a work permit for non-nationals performing at Carnival events).
*   **Tax Withholding:** Varies wildly by island. The ATLAS Compliance Engine must maintain a localized database of withholding rates for the Bahamas, Barbados, and the Dominican Republic.

---
## Sources
1. PwC Worldwide Tax Summaries (Mexico).
2. Brazil General Data Protection Law (LGPD).
3. Reuters/IMF Reports on Argentina FX Controls (2025).
4. ECAD (Brazil) and SADAIC (Argentina) Tariff Guidelines.
