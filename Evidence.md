# Evidence

The most important document in the company. Every time the product proves value to a real team, it gets written here — in **human and dollar terms**, not engine terms. This is how you move from *"it can…"* to *"it has already…"*.

> Rule: nothing goes in this file unless it actually happened with a real team. The entries below the line marked **EXAMPLES** are illustrative templates — delete them and replace with real ones. Keep this honest; fabricated evidence is worse than none.

---

## Scoreboard (update as entries are added)

| Metric | Total so far |
|---|---|
| Teams piloted | 0 |
| Blockers caught before the team escalated | 0 |
| Delays predicted early & later confirmed | 0 |
| Estimated value protected | $0 |
| Teams that said they'd pay | 0 |

---

## How to capture an entry (during a pilot)
For each real moment of value, fill in:
- **Team** (anonymised is fine: "Team A, 8-person fintech eng team")
- **What it caught / predicted**
- **How early** — vs the team's first manual escalation (in hours/days)
- **Outcome** — what would have happened otherwise; did the team confirm it?
- **Estimated value** — in their terms (engineer-hours saved × cost, or a release protected)
- **Confirmation** — a quote or a yes from the lead/manager

You can auto-draft an entry from measured pilot numbers: `node wedge/evidence.js` (it formats your inputs; it never invents them).

---

## Lead with these, not "RealityOS"
When you write or speak about a result, use the outcome line, not the engine:
- ✅ "Caught a blocker 17 hours before the team escalated — protected the release."
- ✅ "Predicted the sprint slip 3 days early; the manager confirmed it was right."
- ❌ "RealityOS's inference engine derived a goal_at_risk fact with 0.8 confidence."

---

## EXAMPLES (illustrative format — replace with real entries)

> ⚠️ These are **not real**. They show the shape of a good entry. Delete once you have real ones.

### [EXAMPLE] Team A — blocker caught before escalation
- **Caught:** PR #441 (payment) blocked by a review that requested changes
- **How early:** 17 hours before anyone raised it in standup/Slack
- **Outcome:** unblocked same day; release shipped on time (would likely have slipped a day)
- **Estimated value:** ~1 day of an 8-person team ≈ **$8,000** protected
- **Confirmed by:** Eng lead — "we'd have caught that Thursday, not Tuesday."

### [EXAMPLE] Team B — sprint delay predicted early
- **Predicted:** sprint would miss its date, **3 days early**
- **Outcome:** manager re-scoped two tickets; sprint landed on time
- **Confirmed by:** EM — "the call was correct, and early enough to act on."

### [EXAMPLE] Team C — less time discovering problems
- **Result:** standup dropped from 22 → 10 minutes; problems arrived already surfaced with owners
- **Estimated value:** ~**12 minutes/day** × 6 engineers reclaimed

---

## Real entries (start here)

*(empty — your first real pilot result goes here. That entry is worth more than anything in the spec.)*

— STMZ Kinetic · support@stmzkinetic.com
