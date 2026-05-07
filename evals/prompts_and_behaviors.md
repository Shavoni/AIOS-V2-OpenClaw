# ATLAS Custom GPT Evaluation Set

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** A test suite of 15 prompts and expected behaviors to run quarterly, ensuring the GPT does not regress when knowledge base files are updated.

## Evaluation Prompts & Expected Behaviors

**Prompt 1: "What is the withholding tax rate for an artist playing in Germany?"**
*   **Expected Behavior:** Must query `withholding_tax.csv`. Must state 15.825%. Must mention the KSK (Künstlersozialkasse) exemption. Must cite File 06.

**Prompt 2: "I'm booking a 500-cap show in Lagos. What payment rails should I use and what's the PRO rate?"**
*   **Expected Behavior:** Must query `payment_rails.csv` and `pro_tariffs.csv`. Must mention Flutterwave (T+1, 2.5% spread, USDC available). Must state the COSON rate is 3.5%. Must cite File 07 and File 11.

**Prompt 3: "Generate a VC pitch slide about our moat against Live Nation."**
*   **Expected Behavior:** Must use the Pitch Slide template from Instructions. Must pull data from `battle_cards.md` and `objection_handling.md`. Must emphasize the Settlement Ledger and Zero-Party Data.

**Prompt 4: "What is the processing time for a Tier 5 Creative visa in the UK?"**
*   **Expected Behavior:** Must query `visa_matrix.csv`. Must state 15-30 days globally, but 30-60 days if applying from Africa. Must state the cost is £298.

**Prompt 5: "How does the ATLAS secondary market work?"**
*   **Expected Behavior:** Must cite File 20. Must explain the closed-loop, fan-to-fan exchange capped at face value + 5% platform transfer fee.

**Prompt 6: "Who is the primary buyer persona for ATLAS?"**
*   **Expected Behavior:** Must cite `personas.md`. Must identify the Independent Venue GM (e.g., "Sarah"). Must list pain points: spreadsheets, late door settlements, PRO audit fears.

**Prompt 7: "Draft an escrow release letter for a show at The Underground in London."**
*   **Expected Behavior:** Must query `pilot_venues.json` to identify The Underground (V-001). Must use Skeleton 3 from `contract_skeletons.md`. Must include the HAAIS dual human authorization note.

**Prompt 8: "Define GBOR and NBOR."**
*   **Expected Behavior:** Must cite `00_glossary.md`. Must correctly define Gross Box Office Receipts and Net Box Office Receipts.

**Prompt 9: "What is the current FX rate for USD to NGN?"**
*   **Expected Behavior:** Must trigger the `getExchangeRates` GPT Action. Must not rely on static knowledge base text for the exact rate.

**Prompt 10: "Can the Concierge AI sign a contract on my behalf?"**
*   **Expected Behavior:** Must cite Protocol Alpha / File 04 (HAAIS Governance Constitution). Must state absolutely not; the AI drafts, humans execute.

**Prompt 11: "What are the tech specs for AfroSpot?"**
*   **Expected Behavior:** Must query `pilot_venues.json`. Must state L-Acoustics K2, Allen & Heath S7000.

**Prompt 12: "How do we handle the IRS CWA for Canadian artists touring the US?"**
*   **Expected Behavior:** Must cite File 05. Must explain the Central Withholding Agreement process and the 30% default rate vs. net income exemption.

**Prompt 13: "What is the ATLAS revenue model?"**
*   **Expected Behavior:** Must cite File 01 or File 16. Must list the 5 streams: Ticketing fee (2-4%), Settlement fee (1.5%), SaaS subscription, Sponsorship aggregation, Data licensing.

**Prompt 14: "Why should we use USDC instead of SWIFT wires?"**
*   **Expected Behavior:** Must cite File 11. Must explain T+5 delays and 3-5% FX spreads vs. instant, low-fee settlement.

**Prompt 15: "What is the projected live music market size in 2027?"**
*   **Expected Behavior:** Must cite `sources.md` (PwC Global Entertainment & Media Outlook). Must state >$40 billion.
