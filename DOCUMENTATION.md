# RealityOS — Documentation

**Organizational Computing.** RealityOS models everything your organization *is* and *does* as one living graph — Objects, Events, Relationships, Time — and reasons over it: Context, Understanding, Prediction, Simulation, Decision, Learning, Coordination.

Support: **support@stmzkinetic.com**

---

## What's in this package

| File | What it is |
|------|------------|
| `index.html` | The full app (installable PWA). Engine + UI embedded — open it and it runs. |
| `reality-engine.js` | The **Reality Engine** — the reference implementation. Pure, dependency-free, runs in the browser *and* Node. This is the heart. |
| `ui.js` | The app's UI layer (already embedded in `index.html`; shipped separately so you can edit it). |
| `server.js` | Backend reference: universal event ingestion (uses the same engine) + Paddle webhook verification. |
| `package.json` | Backend dependencies + `npm start` / `npm test`. |
| `REALITYOS_SPECIFICATION.md` | The technical spec (the RFC for the paradigm). |
| `manifest.json`, `service-worker.js`, `icon-*.png` | Make the app installable + offline. |

---

## 1. Run the app

**Right now, locally:** open `index.html` in any modern browser. It works fully offline — the engine, time-travel, reasoning, and simulation all run in the browser.

**On your phone (install like a native app):** a PWA must be served over HTTPS to be installable.
1. On a computer, open **https://app.netlify.com/drop**
2. Drag this whole folder onto the page → you get a public HTTPS link.
3. Open that link on your phone.
4. **iPhone:** Share → *Add to Home Screen*. **Android:** ⋮ → *Install app*.
5. It now opens full-screen, offline-capable, like a native app.

(Other free hosts work too: Vercel, Cloudflare Pages, GitHub Pages.)

---

## 2. Using the app

- **Reality (home):** live counts, the **time machine** slider (drag to see your org as of N days ago — real reconstruction, not a mock), **Understanding** (risks), **Decide** (ranked actions with expected results), and the **Timeline**.
- **Graph:** every Object by type. Tap one to see **Context** — *why* it's in its state, its relationships, and its history. Add Objects and Relationships. On a task, record events (Block / Unblock / Start / Complete) and watch the whole model re-derive.
- **Reason:** ask in plain language — "what's at risk?", "why is QA stuck?", "will we hit the date?", "who needs to act?" Answers come from the graph, each with a confidence level.
- **Simulate:** pick a hypothetical ("unblock & finish X", "slip the deadline 3 days"). RealityOS clones the event log, applies it, **re-derives the future**, and shows the real before/after.
- **More:** your event API key + ingestion snippet, connectors, **plans & billing (Paddle)**, workspace export/reset, and support.

---

## 3. The Reality Engine API

`reality-engine.js` exports `{ Reality, seed }`. It runs anywhere.

```js
const { Reality, seed } = require('./reality-engine.js');
const R = new Reality();                       // or: const R = seed();  (a live example graph)

// ---- ingestion (the only write primitive) ----
R.object('task:pay', 'task', { name: 'Payment integration' });
R.object('goal:ship', 'goal', { name: 'Ship v2', deadline: Date.now() + 9*864e5 });
R.relate('task:pay', 'advances', 'goal:ship');
R.emit('task.blocked', 'task:pay', { reason: 'waiting on vendor' });

// ---- time travel ----
R.materialize(Date.now() - 3*864e5);           // full state as of 3 days ago

// ---- reasoning layers ----
R.context('task:pay');                          // L2: why
R.understand();                                 // L3: risks, bottlenecks, cycles
R.predict('goal:ship');                         // L4: probability + drivers + projected date
R.simulate([{type:'task.unblocked',subject:'task:pay'},
            {type:'task.completed',subject:'task:pay'}], 'goal:ship');  // L5: real what-if
R.decide();                                     // L6: ranked actions + evidence + expected result
R.coordinate('goal:ship');                      // L8: who / what / when

// ---- persistence ----
const json = R.toJSON();                         // the event log + memory
const R2 = Reality.fromJSON(json);               // rebuild exactly
```

Every event you append is the source of truth; objects and the graph are *derived*. Improve the derivation logic and replay the log, and all historical insight upgrades.

---

## 4. Run the backend

The backend is a reference for going multi-user/live. It uses the **same engine**.

```bash
npm install
npm start          # serves on :8787
npm test           # runs a real simulation assertion
```

**Universal ingestion** (the only write endpoint — any tool posts here):
```bash
curl -X POST http://localhost:8787/v1/ingest \
  -H "Authorization: Bearer rk_live_demo" \
  -H "Content-Type: application/json" \
  -d '{"type":"task.blocked","subject":"task:pay","payload":{"reason":"vendor delay"}}'
# → { ok:true, event:"ev_…", risks:1, top_risk:{…} }   (reasoning, not just an ack)
```

Reasoning endpoints: `GET /v1/reality/understand`, `/v1/reality/predict?goal=…`, `/v1/reality/decide`.

Configure with environment variables:
```
REALITYOS_INGEST_KEYS=rk_live_xxx,rk_live_yyy
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_PRICE_PRO=pri_...
PADDLE_PRICE_BUSINESS=pri_...
```
The in-memory stores are marked in the code — swap them for your database (start with Postgres: one append-only `events` table + materialized projections, exactly as the spec's storage model describes).

---

## 5. Billing (Paddle) — going live

The app integrates **Paddle Billing** (Paddle.js v2). Paddle is a merchant of record, so it handles global sales tax and compliance for you — ideal when selling worldwide from anywhere.

**Steps:**
1. Create a Paddle account → activate **Paddle Billing**.
2. **Developer Tools → Authentication →** create a **client-side token**.
3. **Catalog → Products/Prices →** create your Pro and Business prices. Copy the `pri_...` IDs.
4. In `ui.js` (and the embedded copy in `index.html`), set `CONFIG.paddle`:
   ```js
   CONFIG.paddle = {
     environment: 'sandbox',          // 'production' when live
     clientToken: 'live_xxx',         // your client-side token
     pricePro: 'pri_...',             // your Pro price ID
     priceBusiness: 'pri_...',        // your Business price ID
   };
   ```
5. **Notifications →** add a destination pointing to `https://your-backend/webhook/paddle`; copy its secret into `PADDLE_WEBHOOK_SECRET`. The backend already verifies the `Paddle-Signature` and grants entitlements on `transaction.completed`.
6. Test in **sandbox** first (sandbox and production are entirely separate — different tokens, price IDs, and webhook secrets), then flip `environment` to `production`.

Until you set these, checkout opens safely in sandbox/no-op mode and never charges anyone.

### Pricing (chosen, and why)
| Plan | Price | For |
|------|-------|-----|
| **Developer** | **$0** | Solo/evaluation: 1 workspace, up to 500 objects, Context/Understanding/Prediction. A real funnel top, not a crippled demo. |
| **Pro** | **$29 / user / mo** | The default paid tier: unlimited objects, full reasoning + Simulation, Decide + Coordination, event API. Priced where modern team-software lands ($20–30/seat) and where a single prevented slip pays for the whole team. |
| **Business** | **$59 / user / mo** | Growing orgs: advanced prediction & learning, SSO, audit log, time-travel exports, priority support. |
| **Enterprise** | **Custom** | Single-tenant, customer-managed keys, security review, SLAs. Contact support@stmzkinetic.com. |

Rationale: seat-based with a free entry tier matches how this category is bought, keeps the math obvious (one avoided missed deadline > a year of seats), and leaves Enterprise as the high-touch, high-margin tier. As AI reasoning cost grows, add a usage allowance per seat with overage — the cleanest way to protect margin without a confusing price.

---

## 6. What's real vs. what's next (honest)

**Real and working now:** the Reality Engine (event-sourced, temporal, graph) and every reasoning layer — context, understanding, prediction, **genuine** simulation, decision, coordination; the installable app on top; the universal ingestion API and webhook-verifying backend; the Paddle integration code; this documentation; the specification. All engine layers are validated by running them over a real seed graph — every number is derived, nothing hardcoded.

**The step to a live, paid, multi-customer product:** deploy the backend with a real database behind the in-memory stores; plug in your Paddle keys (above); add OAuth adapters that translate GitHub/Slack/etc. webhooks into RealityOS events (the engine already accepts them — adapters are thin translators, not new concepts); and put authentication + per-tenant permissions in front (the spec's security model). That is productionization of a real foundation — not rebuilding it.

---

*RealityOS Specification and reference implementation. © STMZ Kinetic. Support: support@stmzkinetic.com*

---

## 7. Live data: the GitHub adapter (end-to-end)

RealityOS does not write a "connector per tool." It has **one** ingestion primitive, and adapters are *thin translators* that turn an external payload into RealityOS events. `adapters/github.js` is the first one, and it's wired into the backend.

**What it maps**

| GitHub event | Becomes in your reality |
|--------------|-------------------------|
| `push` | `commit.pushed` events on the repo object; contributor `person` linked |
| `pull_request` opened/closed/merged | a `code` object (the PR), `pr.opened` / `pr.merged` / `pr.closed` events, author `owns` PR, PR `belongs_to` repo, and `Fixes #N` in the body → PR `fixes` issue |
| `issues` opened/closed | a `task` object, `issue.opened` / `issue.completed` events |
| `pull_request_review` (changes requested) | `pr.reviewed` **and** `pr.blocked` — so a review that asks for changes shows up as a real blocker the engine reasons about |

**Wire it up**
1. Deploy the backend (below). Set `GITHUB_WEBHOOK_SECRET` to any strong random string.
2. In your repo: **Settings → Webhooks → Add webhook**
   - Payload URL: `https://your-host/webhook/github`
   - Content type: `application/json`
   - Secret: the same `GITHUB_WEBHOOK_SECRET`
   - Events: pushes, pull requests, issues, pull request reviews
3. That's it. Every event now flows into your reality; `understand()`, `predict()`, `decide()` update live. The backend verifies GitHub's `X-Hub-Signature-256` and rejects anything unsigned.

Adding Slack, Stripe, a calendar, or your own app is the same shape: a ~100-line translator file. The engine never changes.

---

## 8. Persistence: the event store

The backend is **event-sourced on disk**. An append-only `events` table is the source of truth; on boot, each workspace's reality is rebuilt by replaying its events. Lose the materialized state and nothing is lost — replay rebuilds it. Improve the reasoning and replay — and all history gets smarter.

Two real drivers, one interface (`db.js`):

- **SQLite (default, zero-config).** Uses Node's built-in `node:sqlite`. Set `REALITYOS_DB=./realityos.db` (default). Great for a single node, a pilot, or self-hosting.
- **Postgres (production).** Set `DATABASE_URL=postgres://user:pass@host:5432/realityos` (and `PGSSL=1` for managed hosts like Neon/Supabase/RDS). The driver creates the schema on first run.

```bash
# local (SQLite, nothing to install)
npm install && npm start

# production (Postgres)
DATABASE_URL=postgres://... PGSSL=1 \
GITHUB_WEBHOOK_SECRET=... PADDLE_WEBHOOK_SECRET=... \
PADDLE_PRICE_PRO=pri_... PADDLE_PRICE_BUSINESS=pri_... \
npm start
```

**Schema (both drivers):** `events(seq, id, workspace, type, subject, payload, at, source)` append-only, indexed on `(workspace, at)`; `entitlements(email, plan, status, since)`. This is exactly the storage model in the specification (§6).

**Deploy targets:** any Node host — Railway, Render, Fly.io, a VPS. Point a managed Postgres (Neon/Supabase have free tiers) at `DATABASE_URL`. Put the static app (`index.html` + assets) on Netlify/Vercel and the API on the Node host; set the app's ingest/checkout URLs to your API.

**Verified:** the adapter, signature checks, and persistence-across-restart are all covered by tests run during the build — events posted over HTTP survive a full server restart and rebuild the identical reality.

---

## 9. Foundations (v2): ontology, laws, causality, RealityQL, SDK

v2 turns the substrate into a real platform. All of the following are implemented and tested in `reality-engine.js`, `realityql.js`, `reality-sdk.js`:

- **Ontology** — every type belongs to a hierarchy rooted at `entity` (`isA('robot','machine')`), open to new types. (RFC-0007)
- **Laws** — nine kernel-enforced invariants: events immutable & frozen, identity required, provenance + confidence + timeline mandatory. Illegal writes throw. (RFC-0008)
- **Identity** — RealityIDs minted automatically (`rid:sensor:floor-3`). (RFC-0005)
- **Evidence + Confidence** — every reasoning result is traceable and carries a number in [0,1]. (RFC-0009/0010)
- **Causality** — `causalChain(goal)` returns *root cause → … → goal* (e.g. vendor delay → Payment blocked → QA → Security → goal). (RFC-0012)
- **Intent/Goal graph** — goals form a hierarchy; `intentOf(id)`, `goalGraph()`. (RFC-0013)
- **Memory tiers, Attention, Economics, Permissions** — `memory()`, `attention()`, `economics()` (value-at-risk in money), `view(principal)` (permission at retrieval). (RFC-0017–0020)

### RealityQL — query your reality
A real language (tokenizer + parser + executor). In the app's **Reason** screen, type plain English *or* RealityQL. Over HTTP: `POST /v1/ql {"query":"…"}`.
```
OBSERVE goal                 UNDERSTAND                WHY task:pay
PREDICT goal:checkout        CAUSE goal:checkout       DECIDE LIMIT 2
COORDINATE goal:checkout     ATTENTION                 ECONOMICS
PREDICT goal:checkout AS OF 3      # time-travel: 3 days ago
```

### Reality SDK — program with verbs
```js
const { RealitySDK } = require('./reality-sdk.js');
const { githubToOps } = require('./adapters/github.js');
const rx = new RealitySDK(require('./reality-engine.js').seed());

rx.predict('goal:checkout');         // { data, evidence, confidence }
rx.why('task:pay');
rx.cause('goal:checkout');
rx.ql('DECIDE LIMIT 1');

// adapters are pure translators behind one contract
RealitySDK.registerAdapter('github', githubToOps);
rx.ingestFrom('github', 'pull_request', payload);
```

These foundations are exercised by build-time tests covering the ontology, law enforcement, identity, causality, intent graph, memory, attention, economics, permissions, the full RealityQL verb set (including time-travel), and the SDK adapter contract.

---

## 10. Platform precision layer (v2.1): types, inference, kernel

This layer makes RealityOS precise enough to implement from spec. All tested together (13/13 integration checks).

- **Type system** (`reality-types.js`) — each type defines behavior: **lifecycle** state machines (a task can't go `created→done`), **capabilities** (`person can approve`, `sensor cannot move`), and **constraints** (a task can't finish before it starts; a payment needs an invoice). `checkConstraints()` reports violations. (RFC-0024/0025/0026/0032)
- **Inference engine** (`reality-inference.js`) — forward-chaining to a fixpoint, deriving facts nobody recorded with evidence + confidence. Multi-hop: *overdue invoice → cash-flow risk → hiring delay → capacity reduction.* (RFC-0027)
- **Reality Kernel** (`reality-kernel.js`) — the precise API + execution pipeline:
  `Observe · Record · Replay · DeriveState · ForkTimeline · MergeTimeline · Verify · Explain · ResolveConflict`.
  Adds **bitemporal time** (event/valid/observed/processed), **contradiction detection** with **source reliability** (believe GitHub 0.9 over Slack 0.6), **timeline fork/merge**, **versioning**, and **REF/ROF/RID** export so other software can speak Reality. (RFC-0028–0035)

### New RealityQL verbs
```
VERIFY            # constraints + contradictions → is reality consistent?
INFER             # show derived facts
CAPABILITIES <type>   LIFECYCLE <type>   REMEMBER "<note>"
```
These work in the app's Reason screen and over HTTP.

### New backend endpoints
```
POST /v1/kernel/record   # run the full pipeline on one event
GET  /v1/verify          # consistency (violations + contradictions)
GET  /v1/export/ref      # export reality as REF/1
```

### Read next
- `REALITYOS_REASONING_MODEL.md` — **how RealityOS thinks** (the 8 questions), the **mathematical model**, the **execution loop**, and a **developer-experience** guide (create objects, add inference rules, plug a reasoning service, build a connector, build an app).
- `REALITYOS_RFC_SERIES.md` — RFC-0001…0035, the implementable specification.
