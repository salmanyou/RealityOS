# The Reasoning Stack

> **RealityOS exists to reduce the gap between what is true and what people believe is true.**

Every bad decision happens because that gap exists: incomplete information, outdated information, disconnected systems, wrong assumptions, or an inability to reason about complex interactions. RealityOS narrows that gap by maintaining a living model of reality, reasoning over it mathematically, predicting its future, and making every assumption transparent.

**The mission:** build the world's reasoning infrastructure — a universal intelligence substrate that lets humans and AI understand, simulate, and improve any real-world system from a shared, continuously evolving model of reality.

**The discipline:** the vision is universal, the first product is specific (Blocker Radar for engineering teams), and the architecture is built so every new domain reuses the same core substrate rather than becoming a separate application.

---

## The stack

```
                 Humans / AI Agents
                        │
                 Decision Engine        reality-decide.js
                        │
                Simulation Engine       Monte Carlo, forked timelines
                        │
                Prediction Engine       stochastic critical path
                        │
               Optimization Engine      reality-optimize.js
                        │
                Causal Reasoning        reality-causal.js
                        │
                 Knowledge Graph        reality-graph.js
                        │
                    Event Log           reality-engine.js (append-only)
                        │
                     Storage            db.js (SQLite / Postgres)
```

Applications no longer own reality. RealityOS owns reality; applications visualise it.

**No LLM is used anywhere in this stack.** It is graph theory, probability, optimization, causal inference, and information theory. AI is an optional plugin (RFC-0038), never the core.

---

## 1. Knowledge Graph — `reality-graph.js`
Reality is a graph evolving through time. Every query is a traversal.

| Algorithm | Question it answers | Status |
|---|---|---|
| BFS / DFS | what's reachable from here? | ✅ |
| Topological sort | what order must work happen in? | ✅ |
| Dijkstra shortest path | what is the dependency chain from CEO to client? | ✅ |
| Cycle detection | is our plan self-contradictory? | ✅ |
| Tarjan SCC | which parts are mutually entangled? | ✅ |
| Betweenness centrality (Brandes) | who/what is the *true* bottleneck? | ✅ |
| **Critical Path (CPM)** | which chain causes maximum delay? (ES/EF/LS/LF, slack) | ✅ |
| Max-Flow / Min-Cut (Edmonds–Karp) | where does capacity actually bind? | ✅ |
| Community detection | which parts of the org cluster together? | ✅ |

**Verified:** CPM on a 7-task project returns `design → backend → payment → test → ship`, end day 14, correct slack for every task. Max-flow returns 5 with the exact min-cut.

## 2. Causal Reasoning — `reality-causal.js`
Pearl's ladder, implemented. **Correlation is not cause.**

- **Rung 1 — Association:** `P(Y|X)` (what we observe)
- **Rung 2 — Intervention:** `P(Y|do(X))` via graph surgery; **backdoor criterion** finds a valid adjustment set
- **Rung 3 — Counterfactual:** "what *would* have happened if we hadn't cut marketing?"
- **Root-cause ranking:** each candidate fix scored by the delay it removes (counterfactual effect)

**Verified:** on confounded data where holiday-end causes both the marketing cut and the sales drop, the naive association reports **0.448**; backdoor adjustment recovers the **true causal effect 0.150**.

## 3. Optimization — `reality-optimize.js`
"20 engineers, 200 tasks — what's the optimal assignment?"

- **Hungarian algorithm** — provably optimal assignment, O(n³)
- **Constraint satisfaction** — "find a slot where CEO + Lawyer + Engineer + Room are all free"
- **Simulated annealing** — for NP-hard sizes
- **Complexity guard** — exact when small, approximate when large, and it *tells you which it used*

**Verified:** Hungarian's answer matches brute-force optimum exactly (8 days). A 300×300 assignment falls back to annealing automatically in ~110 ms.

## 4. Probability — `reality-probability.js`
Nothing is certain. RealityOS never says "ships Friday"; it says "87%".

- **PERT / triangular / normal / lognormal** duration distributions
- **Monte Carlo** — completion as a *distribution* (p10/p50/p90), and `P(miss deadline)`
- **Bayesian updating** — evidence changes belief, with the full trace
- **Kalman filter** — recover true team velocity from noisy weekly signals
- **Uncertainty propagation** — "what if we hire someone?" as a distribution
- **Seeded RNG** — every simulation is reproducible (Law 9: simulation is deterministic given the seed)

**Verified:** a plan a deterministic CPM calls "14 days" has, under Monte Carlo, a **90% chance of missing** its 14-day deadline. Bayesian chain moves belief 30% → 89.8% as CI failure, engineer unavailability, and a blocking review arrive.

## 5. Information Theory — `reality-information.js`
"What information is missing? What evidence reduces uncertainty most?"

- **Shannon entropy** of current belief · **mutual information**
- **Expected information gain** per candidate question, and **gain per unit cost**

**Verified:** with 0.99 bits of uncertainty about a slip, *"check if CI is green"* yields **0.328 bits** for cost 1, while *"read every Slack message"* yields **0.007 bits** for cost 5. Ask the first one.

## 6. Decision Engine — `reality-decide.js`
It stops recommending and starts **explaining**. Every answer carries:

**Evidence · Reasoning path · Confidence · Assumptions · Unknowns**

It returns *options*, not an answer, and marks the **Pareto front** over `(days, cost, risk)`:
- Option A — fastest
- Option B — cheapest
- Option C — lowest risk
Dominated options are labelled as such.

## 7. The bridge — `reality-reason.js`
Turns any Reality (Objects · Events · Relationships · Time) into the task DAG the mathematics consumes, and runs the whole stack in one call:

```js
const ROS = require('realityos');
const out = ROS.reason(reality, { deadline: 9, interventions: [...] });
out.criticalChain;      // the chain driving maximum delay
out.bottlenecks;        // by betweenness centrality
out.forecast;           // p50 / p90 / P(on time)
out.decision.options;   // Pareto trade-offs with evidence + assumptions + unknowns
```

---

## Proof it's universal — `demo/universal.js`
The same function call, four unrelated domains:

| Domain | Critical chain found | Bottleneck |
|---|---|---|
| Software team | Requirements → Backend impl → DB migration → CI → Deploy | DB migration |
| Hospital | Admission → Lab work → Operation → Insurance → Recovery | Operation |
| Factory | Order intake → Supply → Machining → QC → Shipment | Machining |
| Spacecraft | Design freeze → Fabrication → Static fire → Telemetry → Certification | Static fire |

Identical structure ⇒ identical mathematics ⇒ identical answer shape. The engine never knew what a patient, a machine, or a rocket engine *is*. It only knew Objects, Events, Relationships, Time.

## Proof it reasons — `demo/ci-failure.js`
The scenario from the vision document, computed:

- A dashboard says **"Status: Delayed."**
- RealityOS says: critical chain is `requirements → backend-impl → db-migration → ci-pipeline → deploy`; if nothing changes, **launch probability 19%** (p50 5.95 days vs a 5-day deadline); the root cause worth fixing is the migration; and here are three options —
  - *Reassign Engineer A* → 5.86 days, 85% risk
  - *Wait for the DB engineer* → 8.95 days, 100% risk **(adds 2.98 days)**
  - *Roll back + split deployment* → **3.98 days, 4% risk** — **FASTEST / LOWEST RISK**
- Plus: reasoning path, confidence (69%), the four assumptions, and the two unknowns worth resolving first.

That recommendation is not magic. It is topological sort + Monte Carlo + counterfactual + Pareto analysis.

---

## Honest limits
- **Durations are modelled**, not learned — the PERT triples come from estimates or defaults. Learning them from a team's real history is the first thing a pilot should improve (the Evidence Loop already scores prediction quality).
- **Causal graphs are supplied**, not discovered. Causal *discovery* from observational data (PC/FCI algorithms) is deliberately future work; asserting a discovered graph without domain review would be irresponsible.
- **Backdoor adjustment requires the confounders be observed.** Unobserved confounding cannot be fixed by mathematics alone — the code tells you when the adjustment set is insufficient rather than pretending.
- **Optimization is exact only under the modelled constraints.** The complexity guard reports whether the answer is exact or approximate.
- **Multi-agent, GNNs, differential equations, category theory** from the vision documents are *not* implemented. They are honest future work, not silent gaps: nothing above pretends to include them.

Everything claimed on this page is executed and checked by `demo/` and the tests run at build time. Nothing here is aspirational prose.
