# Decision log

Record started: 16 October 2026. This is a living log, not a reconstructed history of every earlier change.

## D001 - Keep decisions and execution flow beside the code

- Status: accepted by the user on 16 October 2026 (documentation changes only).
- Problem: future maintainers need the reasons behind changes and the path through the code.
- Decision: use root-level `decision.md` and `flow.md`, with durable instructions in `AGENTS.md`.
- Reason: Markdown is readable in GitHub, diffable and requires no extra library or service. The requested filenames are retained exactly.
- Alternative: only a Word/PDF handover. Useful for sharing, but harder to keep synchronized with each code review.
- Tradeoff: documentation needs maintenance; AGENTS.md requires updates alongside meaningful changes. It guides agents but is not a technical GitHub merge restriction.
- Scope: documentation only; no dependency, runtime or database changes.
- Verification: entry points and representative calls were checked against source. Runtime tests are unnecessary for this documentation-only change.

## D002 - Quiz before acceptance

- Status: accepted by the user on 16 October 2026 (documentation changes only).
- Decision: prepare and verify changes, then ask short questions about behaviour and tradeoffs before acceptance, commit/push/deployment.
- Reason: the user explicitly wants to understand changes before accepting them.
- Alternative: explain changes without checking understanding.
- Tradeoff: an extra conversation step; keep questions short and relevant. Unanswered questions never count as approval. Push/deployment still requires authorization.

## Baseline notes for already prepared local changes

These describe the existing implementation, not newly approved changes or a complete historical rationale.

### Mobile Settings shift fields

- Observed change: ShiftSettings.jsx uses labelled responsive form rows instead of the trip-sheet table; styles.css provides two columns on mobile, one below 360px, and Remove underneath.
- Reason supported by the reported bug: the shared trip table has a 1100px minimum width, which made Settings overflow and shrink on mobile.
- Tradeoff: repeated field labels use more vertical space but avoid horizontal scrolling for simple settings. No new library is needed.
- Verification recorded previously: client production build passed. Real iPhone layout remains to be confirmed. Status: local; acceptance under the new quiz rule pending.

### Expiry reminders

- Observed design: dashboard alerts are independent of email enablement. Email is off by default; the worker uses saved expiry dates, India calendar days, database delivery claims and provider idempotency.
- Tradeoff: an in-process scheduler cannot run while hosting sleeps. External scheduling and live Resend delivery remain deferred; do not describe them as configured.
- Relevant files: shared/vehicleExpiry.js; server/services/expiryReminderService.js; client/src/features/ExpiryAlerts.jsx and ReminderSettings.jsx; docs/expiry-reminders.md.
- Status: local implementation; external setup deferred. This note does not approve pending code.

## Template for the next meaningful change

- ID/date and status (prepared / awaiting quiz / accepted / superseded)
- Problem and desired behaviour
- Decision and reasons, including library choice if any
- Alternatives and accepted tradeoffs
- Affected files and flow.md updates
- Verification and remaining limitations
- Quiz questions, user answers and explicit acceptance reference

## Documentation acceptance - 16 October 2026

- Scope: D001 and D002; decision.md, flow.md and AGENTS.md.
- Quiz answers: reasons for choosing a library or approach belong in decision.md; the agent must wait for quiz answers and explicit acceptance.
- User explicitly accepted the documentation changes with "yes" after the quiz.
- This acceptance does not approve other pending code changes or authorize a commit, push or deployment.