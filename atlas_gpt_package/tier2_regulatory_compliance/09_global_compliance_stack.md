# ATLAS Global Compliance Stack

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domains 10 (Visas) and 11 (Insurance), synthesizing them with global data privacy and tax withholding into a unified "Compliance Stack" for the ATLAS Concierge.

## Executive Summary
The ATLAS platform's primary value proposition is not just ticketing, but removing the friction of cross-border touring for independent artists. This document outlines the unified Global Compliance Stack—the rules engine that powers the ATLAS Concierge. It covers the four pillars of touring risk: Immigration (Visas & Work Permits), Financial Protection (Insurance), Taxation (Withholding), and Data Sovereignty (Privacy).

---

## Pillar 1: Immigration & Visa Routing Engine

The Concierge AI must calculate lead times and document requirements for cross-border movement.

### Key Global Visa Pathways
1.  **United States:**
    *   *O-1B (Individuals with Extraordinary Ability in the Arts):* Requires extensive press and peer recommendation letters. *Timeline:* 3-6 months (or 15 days with Premium Processing for an additional fee).
    *   *P-1B / P-2 / P-3 (Groups & Reciprocal Exchange):* Standard for touring bands.
    *   *ATLAS Protocol:* The AI must prompt the promoter to act as the petitioner or connect the artist with a bonded visa agent if the tour touches US soil.
2.  **United Kingdom:**
    *   *Permitted Paid Engagement (PPE):* Max 30 days. Must be declared at the border.
    *   *Tier 5 (Creative Worker):* Requires a Certificate of Sponsorship (CoS) from a UK entity.
3.  **Schengen Area (EU):**
    *   *The 90/180 Rule:* Non-EU artists are limited to 90 days within a 180-day period.
    *   *ATLAS Protocol:* The AI must maintain a rolling day-count for all touring personnel to prevent overstays.
4.  **Africa Regional Blocs:**
    *   *ECOWAS:* 90-day visa-free travel for West African nationals.
    *   *EAC (East African Tourist Visa):* Joint visa for Kenya, Uganda, and Rwanda.

---

## Pillar 2: The Insurance Architecture

Live music is inherently high-risk. The ATLAS platform mandates specific insurance minimums for all network venues.

### Required Venue Coverages
*   **General Liability (GL):** Minimum $1,000,000 per occurrence / $2,000,000 aggregate. Covers third-party bodily injury (e.g., a fan slipping) and property damage.
*   **Liquor Liability (Dram Shop):** Mandatory for any venue serving alcohol. Covers damages resulting from the actions of an intoxicated patron.

### Required Tour Coverages (Triggered by Concierge)
*   **Event Cancellation & Non-Appearance:**
    *   *Scope:* Protects the promoter's sunk costs (flights, marketing, venue deposits) if the artist cannot perform due to illness, travel delays, or visa denial.
    *   *ATLAS Protocol:* If a tour's cross-border logistics score high on the risk matrix (e.g., tight visa turnaround), the AI mandates the purchase of Non-Appearance insurance (via partners like Take1 or Front Row) before escrowing the artist deposit.
*   **Equipment Floater:** Covers loss or damage to specialized touring gear (instruments, backline).

---

## Pillar 3: Cross-Border Tax Withholding

Governments aggressively tax foreign entertainers. The ATLAS Settlement Agent must calculate and escrow these funds before the artist leaves the country.

*   **United States (IRS):** 30% statutory withholding on gross income for Non-Resident Aliens (NRAs). *Mitigation:* The AI prompts the filing of a Central Withholding Agreement (CWA) to reduce withholding to net profits.
*   **Mexico (SAT):** Up to 40% withholding on foreign artists without a permanent establishment.
*   **Germany (KSK):** The Künstlersozialkasse requires a ~5% social security levy paid by the *promoter* on top of the artist's net fee.
*   *ATLAS Protocol:* The Settlement Agent dashboard must display the "Gross Guarantee" and the "Net Remittance (Post-Withholding)" to ensure artists understand their actual take-home pay.

---

## Pillar 4: Global Data Privacy (GDPR, CCPA, POPIA)

As a centralized ticketing and CRM platform, ATLAS is a massive data processor.

*   **Europe (GDPR):** Requires explicit, granular opt-in for marketing. Mandates Data Processing Agreements (DPAs) between ATLAS and the venues.
*   **California (CCPA/CPRA):** Requires a "Do Not Sell or Share My Personal Information" link on the ticketing widget.
*   **South Africa (POPIA) & Brazil (LGPD):** Impose strict rules on international data transfers.
*   *ATLAS Protocol:* The Compliance Engine automatically applies the strictest applicable privacy regime based on the IP address of the ticket purchaser and the physical location of the venue.

---
## Sources
1. USCIS O-1 and P-1 Visa Guidelines.
2. IRS Publication 515 (Withholding of Tax on Nonresident Aliens).
3. Risk Strategies: Event Cancellation and Non-Appearance Insurance.
4. EU General Data Protection Regulation (GDPR).
