[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21384603.svg)](https://doi.org/10.5281/zenodo.21384603)

# RealityOS

> **RealityOS is not an application, nor an AI platform. It is a computational model for representing, understanding, predicting, and coordinating the evolving reality of organizations through evidence-backed events, relationships, and time.**

Everything is **Objects · Events · Relationships · Time**. From that substrate, RealityOS derives **context, understanding, prediction, simulation, decision, learning, and coordination** — each with evidence and a confidence number. The specification is **frozen at v1.0** (RFC-0001…0038); what changes it next is evidence from real teams, not more design.

---

## Start here (5 minutes)
```js
const ROS = require('realityos');
const k = ROS.demo();                       // a kernel preloaded with a sample team

k.understand().risks[0].title;              // → "Ship Checkout v2" is at risk
k.predict('goal:checkout');                 // → 48% on time (confidence 0.78) + evidence
k.ql('CAUSE goal:checkout').text;           // → vendor keys → Payment → QA → Security → Ship Checkout v2
k.simulate([{type:'task.unblocked',subject:'task:pay'},
            {type:'task.completed',subject:'task:pay'}],'goal:checkout');  // → 48% → 97%
```
Full walkthrough: **`QUICKSTART.md`**. (Every snippet is tested as part of the build.)


---

## The reasoning stack (mathematics, no LLM)
RealityOS doesn't store data and show it red. It **reasons**: graph theory finds the chain that drives the delay, Monte Carlo turns a date into a probability, causal inference separates cause from correlation, optimization assigns work provably optimally, and information theory says what to ask next. The Decision Engine returns **options with trade-offs**, each carrying evidence, reasoning path, confidence, assumptions, and unknowns.

```bash
npm run demo:reason      # the CI-failure scenario: "Status: Delayed" → 3 options with risk
npm run demo:universal   # same code on software, hospital, factory, spacecraft
```
Details and what's verified: **`REASONING_STACK.md`**.

---


## Formally specified. Machine-verified. Benchmarked.
Twelve axioms of the Reality Model are checked against randomly generated realities (`npm run verify` → 12/12). Temporal specifications (`payment ⊰ shipment`) return counterexamples, not just `false`. The engine justifies *which algorithm it chose and why not the others*. Incremental reasoning provably equals full recomputation; partitioned reasoning equals centralized. And the claims are falsifiable:

```bash
npm run verify        # 12/12 axioms over 60 random realities
npm run bench:suite   # RealityOS vs 5 baselines, ground truth known, with calibration
```

| Question | RealityOS | Best baseline |
|---|---|---|
| Which project slips? | **Brier 0.094** | 0.395 |
| Best intervention (regret) | **0.001 d** | 0.373 d |
| True bottleneck (top-1) | 0.525 | 0.555 *(not significant)* |
| Calibration (ECE) | **0.049** | — |

Read: **`FORMAL_SEMANTICS.md`** · **`RESEARCH_AGENDA.md`** (what's proven, measured, and openly unsolved).

---

## The intelligence layer (everything above Decision)
Truth maintenance (ATMS) that holds competing hypotheses instead of choosing · Understanding that finds *abstractions* (fragility, bus factor, systemic process weakness) not just facts · an HTN autonomous planner · a Contract-Net multi-agent society · Reality Physics that learns domain laws and rejects coincidences · a Reality Compiler that turns a domain into a reality · a Digital Twin that admits when it is stale · an Explanation Engine that publishes decisions like proofs.

```bash
npm run demo:intelligence   # all nine systems, end to end
```
Details and honest limits: **`INTELLIGENCE_LAYER.md`**.

---

## The product: Blocker Radar (the wedge)
RealityOS sells through one painkiller engineering teams understand immediately:

> **Know what's about to slip — before standup.**

Blocker Radar connects to GitHub (read-only) and flags what's blocked, *why*, and *who needs to act* — before the team's first manual escalation. See **`wedge/`**: the landing page (`index.html`), the pilot measurement harness (`measure.js`), the outreach playbook (`OUTREACH.md`), and the validation plan (`VALIDATION.md`).

### Don't let the wedge become the product
```
Customer → installs → Blocker Radar (painkiller)
                          → runs on → Platform (kernel, SDK, RealityQL, adapters)
                                         → is a → RealityOS (the Organizational Reality Model)
```
Sell the painkiller; build on the platform. Git→GitHub, Stripe→payments: the wedge earns the right to the platform, where the durable value lives.

---

## What's inside
| File | What it is |
|---|---|
| `index.js` | package entry — `require('realityos')` |
| `reality-engine.js` | the substrate: objects/events/relationships/time, 8 reasoning layers (tested) |
| `reality-types.js` | type system: lifecycles, capabilities, constraints |
| `reality-inference.js` | forward-chaining inference (facts nobody recorded) |
| `reality-kernel.js` | kernel API + execution pipeline, integrity, federation, AI-plugin |
| `realityql.js` | RealityQL — a query language for reality |
| `reality-sdk.js` | verb SDK + adapter contract |
| `adapters/github.js` | the first real data source |
| `server.js` + `db.js` | persistent backend (SQLite/Postgres), webhooks, RealityQL/kernel over HTTP |
| `index.html` + `ui.js` | installable PWA app |
| `REALITYOS_RFC_SERIES.md` | the frozen v1.0 spec (RFC-0001…0038) |
| `REALITYOS_REASONING_MODEL.md` | how RealityOS thinks (+ math, execution, DX) |
| `THEORY_OF_ORGANIZATIONAL_REALITY.md` | the science: model, physics, math, complexity, security, federation |
| `wedge/` | Blocker Radar: landing, measurement, outreach, validation |

---

## Run it
```bash
npm install            # express + pg
npm start              # backend on :8787 (SQLite default; Postgres via DATABASE_URL)
npm test               # engine smoke test
node wedge/measure.js  # the four pilot metrics on a sample week
```
Install the app on a phone, connect GitHub, set up Paddle billing: **`DOCUMENTATION.md`**.

---

## The next 30 days
Not more code. **Get five engineering teams to install Blocker Radar, connect GitHub, and let it observe for two weeks.** Then answer three questions with evidence: did it find something useful the team missed; did the explanations make sense; would anyone pay. That's the line between an elegant design and a real platform.

— STMZ Kinetic · support@stmzkinetic.com
