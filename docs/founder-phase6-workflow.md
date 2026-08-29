# Founder Studio Phase 6 — Supplier & Production Workflow

## Purpose

Phase 6 helps a founder move from a product idea to a realistic first production conversation without presenting unverified suppliers, prices, capacity, or manufacturing claims as facts. It is a private planning workspace, not a supplier marketplace and not a purchase order system.

## Founder journey

| Step | Founder action | What Uvel stores locally | What Uvel must not claim |
|---|---|---|---|
| 1. Production target | Set a first-run unit target, target cost, currency, and production notes. | Founder-entered planning assumptions. | That the target cost is achievable or market-validated. |
| 2. Supplier shortlist | Add potential suppliers with name, location, specialty, minimum order, lead time, status, and notes. | Founder-entered supplier leads. | That a supplier is verified, available, safe, or endorsed by Uvel. |
| 3. Sample tracker | Attach a sample to a supplier and track requested, received, approved, or changes-needed status. | Sample decisions, quoted cost, dates, and notes. | That a sample meets a quality or legal standard. |
| 4. Production milestones | Mark specification, supplier, sample, and cost milestones as to-do, in progress, or done. | A private production checklist. | That a production run has been placed or paid for. |
| 5. Launch handoff | Use the production summary to improve the public application and readiness review. | A concise production snapshot. | That the brand is registered, verified, or ready to sell. |

## Design decisions

The workspace is embedded in Founder Studio so the first product brief remains the source of truth. All fields are optional planning fields and can be edited later. A supplier record is intentionally manual in this phase; real supplier discovery should be a later integration with explicit source attribution and availability timestamps.

The production workspace uses the existing near-black and lime/ivory visual system. Empty states explain what the founder should add next. Status controls are explicit text controls rather than color-only indicators. The model is backward-compatible: old projects receive an empty production object during normalization.

## Phase 6 completion signal

Phase 6 is considered prepared when the founder has set a target, added at least one supplier, recorded one sample decision, and advanced at least one production milestone. This is a planning signal only and must not replace the existing four-part launch-readiness gate.
