# ATLAS Concierge AI Specification

**Version:** 1.0
**Last Updated:** 2026-05-06
**Scope:** Covers Research Domain 13 (AI Concierge logic, LLM orchestration, and RAG implementation for legal/logistics automation).

## Executive Summary
The ATLAS Concierge is not a standard chatbot; it is an **Agentic AI Workflow** designed to replace the administrative bloat of traditional booking agencies. It acts as the intelligent orchestration layer between the Venue, the Promoter, and the Artist. This document specifies the LLM architecture, the Retrieval-Augmented Generation (RAG) pipeline for legal compliance, and the routing logic required to execute cross-border tours autonomously.

---

## Part A — LLM Orchestration & Agentic Routing

The Concierge utilizes a multi-agent architecture (implemented via LangChain/LangGraph) to handle complex, multi-step logistics.

### 1. The Triage/Router Agent
*   **Function:** Acts as the primary API endpoint for user input (e.g., a promoter requesting to book an artist across 4 African countries).
*   **Logic:** The Router Agent classifies the intent and dispatches sub-tasks to specialized agents:
    *   *Routing Agent:* Calculates optimal travel paths based on flight data and visa restrictions.
    *   *Finance Agent:* Models unit economics, calculates break-even, and locks FX rates.
    *   *Legal Agent:* Drafts contracts and compliance checklists.

### 2. Workflow Execution vs. Autonomous Agents
*   To adhere to the HAAIS "Human Governance" mandate, the Concierge operates as a **Workflow Engine** rather than a fully autonomous agent.
*   *ATLAS Protocol:* The AI can gather data, calculate math, and draft contracts, but it **cannot execute a binding transaction** (e.g., locking funds in escrow or finalizing a booking) without a human "Approve" click.

---

## Part B — RAG Pipeline for Legal & Compliance

Cross-border touring requires adherence to hundreds of localized tax, visa, and performance rights regulations. The Concierge relies on a Retrieval-Augmented Generation (RAG) architecture to ensure accuracy.

### 1. The Vector Database (Knowledge Base)
*   ATLAS maintains a continuously updated vector database containing:
    *   Statutory tax withholding rates (e.g., IRS CWA rules, Mexico SAT rates).
    *   PRO tariff schedules (e.g., SOCAN, PRS, SAMRO).
    *   Visa processing timelines and requirements.
    *   Historical venue performance data.

### 2. The RAG Execution Flow
1.  **Query:** "Generate a booking contract for Artist X at Venue Y in Berlin."
2.  **Retrieval:** The system queries the vector database for "Germany KSK tax," "Schengen 90/180 rule," and "GEMA tariff."
3.  **Augmentation:** The retrieved legal constraints are injected into the LLM's prompt context.
4.  **Generation:** The LLM generates a localized contract that explicitly includes clauses for KSK withholding and GEMA reporting, ensuring the venue is legally protected.

---

## Part C — Core Concierge Capabilities

### 1. Dynamic Unit Economics Modeling
*   When a promoter initiates a booking, the Concierge automatically builds a dynamic P&L (Profit & Loss) sheet.
*   It pulls real-time data:
    *   Flight APIs (Skyscanner/Amadeus) for travel costs.
    *   Local diesel/power costs (for African venues).
    *   Current PRO tariff percentages.
*   *Output:* A clear "Break-Even Ticket Sales" metric presented to the promoter before they submit the offer to the artist.

### 2. Multi-Currency Settlement Logic
*   The Concierge orchestrates the split payments at the point of digital door settlement.
*   *Example:* If a show generates $10,000 USD equivalent in local fiat:
    *   AI routes 3% to the local PRO.
    *   AI routes 5% to the ATLAS platform fee.
    *   AI calculates the local tax withholding and escrows it.
    *   AI splits the remainder 80/20 between Artist and Promoter via USDC or direct fiat rails.

### 3. Automated Advancing
*   "Advancing" a show (coordinating tech riders, hospitality riders, and load-in times) is historically done via messy email threads.
*   *ATLAS Protocol:* The Concierge parses the artist's PDF tech rider, cross-references it with the venue's technical specs stored in the database, and highlights discrepancies (e.g., "Artist requires Pioneer CDJ-3000s; Venue only has CDJ-2000s. Shall I source a local rental?").

---
## Sources
1. LangChain Documentation: Multi-Agent Routing.
2. IBM Think: LLM Agent Orchestration.
3. Thomson Reuters: RAG in Legal Tech.
