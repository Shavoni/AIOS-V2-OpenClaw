# Copyright Reversion & Catalog Recovery Agent — Custom GPT Package

## Deployment Guide

This package contains everything needed to deploy the **Copyright Reversion & Catalog Recovery Agent** as a Custom GPT in OpenAI's GPT Editor.

---

## Package Contents

| File | Purpose |
|------|---------|
| `instructions.txt` | Paste into the **Instructions** field (4,881 characters — within 8,000 limit) |
| `description.txt` | Paste into the **Description** field (225 characters — within 300 limit) |
| `01_Governance_Framework.md` through `20_Glossary_and_Definitions.md` | Upload all 20 files to the **Knowledge** section |

---

## Deployment Steps

1. Navigate to [https://chat.openai.com/gpts/editor](https://chat.openai.com/gpts/editor)
2. Click **Create a GPT** or **Edit** an existing one
3. In the **Configure** tab:
   - **Name:** Copyright Reversion & Catalog Recovery Agent
   - **Description:** Copy the contents of `description.txt`
   - **Instructions:** Copy the contents of `instructions.txt`
   - **Knowledge:** Upload all 20 `.md` files (01 through 20)
4. Under **Capabilities**, enable:
   - Web Browsing (for USCO and PRO database lookups)
   - Code Interpreter (for date calculations and valuation modeling)
5. Save and publish

---

## Knowledge Base Architecture

The 20 knowledge files are organized into a comprehensive curriculum:

| # | File | Domain |
|---|------|--------|
| 01 | Governance Framework | Operational boundaries and ethics |
| 02 | Principal Profile | Agent persona and communication style |
| 03 | Strategic Vision | Business model and productization |
| 04 | Organization Structure | Ecosystem map of industry players |
| 05 | Pre-1978 Termination | § 304(c) and § 304(d) mechanics |
| 06 | Post-1978 Termination | § 203 mechanics |
| 07 | Foreign Rights Reversion | Canada, EU, UK reversion laws |
| 08 | Termination Exceptions | Work Made for Hire and Derivative Works |
| 09 | Notice Requirements | 37 C.F.R. § 201.10 procedural compliance |
| 10 | Catalog Valuation | NPS multiples and DCF methodology |
| 11 | Buyer Landscape | Taxonomy of catalog acquirers |
| 12 | Estate Activation | Case studies (MJ, Miles Davis, Marley, Houston) |
| 13 | The Heir Problem | Diagnostic workflow for uninformed heirs |
| 14 | Pre-1972 Sound Recordings | CLASSICS Act and MMA implications |
| 15 | New Revenue Streams | AI licensing and sync boom |
| 16 | Public Domain Cliff | Copyright expiration timelines |
| 17 | Catalog Forensics | Step-by-step audit workflow |
| 18 | Legal Precedents | Key cases (Vetter, Waite, Willis) |
| 19 | Key Resources | Databases, tools, and administration partners |
| 20 | Glossary | Legal and financial terminology |

---

## Suggested GPT Name Options

- Copyright Reversion & Catalog Recovery Agent
- The Catalog Recovery Agent
- RightsBack AI
- The Termination Window Agent

---

## Notes

- The instructions are well within the 8,000-character limit, leaving room for future additions
- The description is within the 300-character limit
- All 20 knowledge file slots are utilized
- The agent is designed to be proactive, calculating deadlines and valuations without being asked
- Web Browsing capability is recommended for real-time USCO and Songview lookups
