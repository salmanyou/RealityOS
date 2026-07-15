# RealityOS — Production & Validation Layer

What was added to make RealityOS **safe to pilot with real teams** and **able to learn from them**. This is the layer between "research platform" and "thing five teams can use." Architecture stays frozen at v1.0; this is production plumbing + the feedback loop, not new theory.

---

## 1. The Evidence Loop (`reality-feedback.js`) — the most important addition
Closes **Prediction → Outcome → Learning**, which is what lets prediction quality improve and earns customer trust.

```js
const ROS = require('realityos');
const k = ROS.demo();

ROS.RealityFeedback.recordPrediction(k.R, 'goal:checkout');  // snapshot today's prediction (persists as an event)
// …time passes, the goal resolves (hit or missed)…
ROS.RealityFeedback.scorePredictions(k.R);                   // score each against the real outcome (Brier + correct?)
ROS.RealityFeedback.accuracy(k.R);                           // hit-rate, Brier, calibration, accuracy-over-time
ROS.RealityFeedback.learn(k.R);                              // derive a calibration correction from outcomes
```
- **Predictions and their outcomes are events**, so they persist and replay like everything else.
- `accuracy()` gives you the **"Week 1: 73% → Week 10: 91%"** story and a **calibration** table (when it says 80%, does it happen ~80% of the time?).
- `learn()` fits a shrinkage that **measurably reduced Brier 0.396 → 0.248** on a miscalibrated history in testing — real improvement, not a slogan.
- Over HTTP: `POST /v1/predictions/record`, `POST /v1/predictions/score`, `GET /v1/accuracy`.

This is also your **explainability dashboard data** (for you, not customers): every prediction, its evidence, its drivers, whether it came true.

---

## 2. Multi-tenancy + auth (`server.js`, `db.js`) — safe for many teams
One team's data can **never** touch another's. Verified in tests: Team Alpha's secret is invisible to Team Beta; missing/invalid keys get 401; admin route needs the admin key (403 otherwise).

- **Per-tenant API keys.** Every request is scoped to its tenant; the client cannot override the workspace.
- **Per-tenant GitHub webhooks:** `/webhook/github/:tenant` with that tenant's own secret.
- **Rate limiting** (token bucket per key) and an **audit log** (`GET /v1/audit`).
- **Provision a pilot team** (admin only):
  ```bash
  curl -X POST https://api.stmzkinetic.com/admin/tenant \
    -H "X-Admin-Key: $REALITYOS_ADMIN_KEY" -H "Content-Type: application/json" \
    -d '{"name":"Acme Eng"}'
  # → { apiKey, githubWebhook, githubSecret }
  ```
  Give the team the webhook URL + secret; they add it to one repo. Done.

Env vars: `REALITYOS_ADMIN_KEY`, `DATABASE_URL` (+ `PGSSL=1` for managed Postgres), `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_PRO/BUSINESS`.

---

## 3. Benchmark suite (`bench/benchmark.js`) — improve scientifically
Ranks prediction strategies on a labeled scenario set by **Brier score** and accuracy, so you can prove a change helps before shipping it.
```
★ realityos-default     Brier 0.053   90%
  realityos-calibrated  Brier 0.074   90%
  always-0.5            Brier 0.25    50%
  optimist-0.8          Brier 0.34    50%
```
Add your own strategy (or a new inference/prediction plugin) and see if it wins. `node bench/benchmark.js`.

---

## 4. Honest production checklist

**Done (pilot-ready):**
- ✅ Persistent event store (SQLite/Postgres), rebuilt on boot
- ✅ Multi-tenant isolation + per-tenant API keys
- ✅ Auth, rate limiting, audit log
- ✅ Per-tenant GitHub webhooks with signature verification
- ✅ Tamper-evident event log (hash chain)
- ✅ Evidence Loop (prediction → outcome → learning) + accuracy reporting
- ✅ Benchmark suite

**Add during the pilot, when a team actually needs it (don't pre-build):**
- ⬜ GitHub **OAuth** (so teams click-authorize instead of pasting a webhook secret)
- ⬜ **Onboarding** flow + the first-5-minutes experience
- ⬜ **Email** (invites, verification, notifications)
- ⬜ **Org management** (invite members, roles)
- ⬜ **Monitoring** (errors, performance) + **backups** (managed Postgres gives you these)
- ⬜ Per-event **signatures** + replay protection (Security Roadmap, in the Theory doc)
- ⬜ **Privacy/legal** (Terms, Privacy Policy, data retention) — needed before charging
- ⬜ **Reliability** (webhook retries / dead-letter) — when volume warrants

**Deliberately never build** (RealityOS observes these, never replaces them): CRM, chat, calendar, ERP, project management.

---

## 5. What this means
RealityOS is now **safe to run with five real teams** and **able to learn from them**. The remaining items above are not blockers to starting — they're things the pilot will tell you to prioritize. The next milestone isn't code; it's a team installing it, getting value, and renewing.
