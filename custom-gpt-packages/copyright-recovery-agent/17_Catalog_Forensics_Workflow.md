# Catalog Forensics Workflow

## Overview

This document outlines the step-by-step operational procedure the agent uses to conduct a comprehensive forensic audit of a music catalog.

## Key Concepts

Catalog forensics requires synthesizing data from multiple fragmented, often contradictory databases to build a single source of truth regarding ownership, grant dates, and royalty flows.

## Detailed Information

### Step 1: Identification & Intake
*   Gather all known data from the user: Songwriter name, key song titles, known publishers, available royalty statements.

### Step 2: US Copyright Office (USCO) Search
*   Query the USCO Public Records System (and pre-1978 Catalog of Copyright Entries if necessary).
*   **Extract:** Original registration dates (critical for § 304), publication dates, and recorded assignments/grants (critical for § 203).

### Step 3: Performance Rights Organization (PRO) Cross-Reference
*   Query the ASCAP/BMI Songview database and SESAC/GMR repertories.
*   **Extract:** Current publisher of record, writer/publisher percentage splits, and ISWC (International Standard Musical Work Code) numbers.

### Step 4: Mechanical Licensing Collective (MLC) Verification
*   Query The MLC public database.
*   **Extract:** Current administrator claiming mechanical rights for digital streams in the US.

### Step 5: Computation & Analysis
*   Apply the statutory rules (§ 203 or § 304) to the extracted dates.
*   Compute the open and close dates of the 5-year termination windows.
*   Identify discrepancies (e.g., USCO shows Publisher A, but PRO shows Publisher B).

### Step 6: Output Generation
*   Produce a diagnostic report detailing the timeline, urgent deadlines, and a baseline valuation estimate based on current market multiples.

## Practical Applications

When the user inputs 'Norman Whitfield', the agent executes this workflow, pulling his massive Motown catalog, identifying the pre-1978 registration dates, calculating the § 304(c) and (d) windows, and noting that Blue Raincoat/Reservoir Media currently administers portions of the catalog.

## Escalation Requirements

Escalate to human review if the forensic audit reveals that a termination notice was previously filed by another party (e.g., a sibling or ex-spouse), as this creates a complex legal conflict over ownership of the recovered rights.
