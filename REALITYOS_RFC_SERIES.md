# RealityOS — RFC Series

*Internet-standard-style specifications for Organizational Computing.*
Each RFC defines one part of the substrate precisely enough that independent implementations interoperate. Status: **Draft Standard v1**. Contact: **support@stmzkinetic.com**.

These RFCs are normative and are implemented by the reference engine (`reality-engine.js`), language (`realityql.js`), and SDK (`reality-sdk.js`). The prose rationale lives in `REALITYOS_SPECIFICATION.md`; this file is the formal index.

> **The one sentence everything serves:** RealityOS is not software that stores information. It is software that maintains a continuously evolving, evidence-backed model of reality from which every application, agent, dashboard, automation, and decision derives its understanding.

---

## RFC-0001 — Reality Object
**Status:** Stable.
An Object is an entity with identity and derived state.
```
Object { id: RealityID, type: OntologyType, status: string, props: map<string,any> }
```
Rules: every Object has an `id` (RFC-0005) and a `type` (RFC-0007). State is never written directly; it is derived from Events (RFC-0002, RFC-0004). `type` is open; unknown types resolve to `entity`.

## RFC-0002 — Reality Event
**Status:** Stable.
An Event is an immutable, timestamped, attributed record that something happened. Events are the sole source of truth.
```
Event { id, type:"<noun>.<verb>", subject:RealityID, payload:map, at:timestamp, source:string }
```
Rules: append-only; never modified or deleted (RFC-0003); every Event has `at` (RFC-0006) and `source` (RFC-0009). Reference impl freezes Event objects on creation.

## RFC-0003 — Immutability & Redaction
**Status:** Stable.
History cannot be edited. Corrections are new Events. Deletion is **tombstoning**: an `object.tombstoned` Event marks an Object redacted; with crypto-shredding the payload key is destroyed, satisfying deletion obligations without breaking the append-only log.

## RFC-0004 — Derivation (State as a function of Events)
**Status:** Stable.
`materialize(t)` reconstructs `⟨Objects(t), Relationships(t)⟩` by folding all Events with `at ≤ t`. Given the same log, all conforming implementations MUST produce identical state. Improving derivation and replaying the log upgrades all historical insight.

## RFC-0005 — Identity (RealityID)
**Status:** Stable.
Everything has identity — people, agents, machines, sensors, tasks, invoices, buildings. Canonical form: `rid:<ontology-type>:<slug|uuid>`. Legacy/source-native ids (e.g. `task:pay`, `pr:owner/repo#441`) are valid identifiers; the engine mints a RealityID when none is supplied.

## RFC-0006 — Time & Timeline
**Status:** Stable.
Every Event carries `at`. Time enables reconstruction (`materialize(t)`), velocity, prediction, and audit. Logical time is monotonic per append; backfilled historical Events are permitted and ordered by `at`.

## RFC-0007 — Ontology (Type System)
**Status:** Stable.
A hierarchy rooted at `entity`: actors (`human→person`, `ai_agent`, `organization→team/customer`), physical (`machine→robot/sensor/vehicle`, `asset→repo`, `location→building`, `resource`), informational (`document→code/note`, `product`, `service`), and work/intent (`intent→goal`, `process→project/task/meeting`). `isA(type, ancestor)` is defined for all types. Open by design; new types attach under `entity` unless registered. Relationship types have a canonical registry with inverses (`depends_on/enables`, `blocks/blocked_by`, `advances`, `belongs_to`, `owns`, `causes`, `serves`, `part_of`, `located_at`, …).

## RFC-0008 — Reality Laws (physics)
**Status:** Stable. Enforced by the kernel.
1) Reality only changes through Events. 2) Events are immutable and never disappear. 3) History cannot be edited (deletion is tombstoning). 4) State is always derived. 5) Everything has identity. 6) Every Event has provenance. 7) Every Prediction carries a confidence in [0,1]. 8) Everything exists on a timeline. 9) Predictions never modify reality; Simulation creates virtual timelines.

## RFC-0009 — Evidence & Provenance
**Status:** Stable.
Every derived claim is traceable.
```
Evidence { claim:string, events:[EventID], objects:[RealityID], sources:[string] }
```
Context, Understanding, Prediction, Causality, and Decision all attach Evidence. RealityOS proves, it does not merely assert.

## RFC-0010 — Confidence
**Status:** Stable.
Every reasoning output carries `confidence` or `probability` ∈ [0,1] — including risks, predictions, causal chains, bottlenecks, and economics. No bare assertions.

## RFC-0011 — Context Engine
**Status:** Stable.
Context is an object, not a string. For a subject it assembles: time, status, governing goal/intent, dependencies, dependents, owners, and Evidence. `context(id, t)` returns the structured `contextObject` plus human-readable reasons.

## RFC-0012 — Causality Engine
**Status:** Stable.
Distinct from relationships. `causes` is a first-class relationship; `effects(id)` propagates a delay downstream through `depends_on` and `causes`; `causalChain(goalId)` returns ordered `root_cause → blocked → effect* → at_risk` chains with confidence. Example: *vendor delay → Payment blocked → QA → Security review → goal at risk.*

## RFC-0013 — Intent & Goal Graph
**Status:** Stable.
Projects are temporary; goals are durable. Goals form a hierarchy via `advances`/`part_of` (company → department → project → task). `intentOf(id)` walks up to the governing goal; `goalGraph()` returns the hierarchy. Everything ultimately serves intent.

## RFC-0014 — Prediction
**Status:** Stable.
`predict(goalId, t)` returns probability, drivers, projected date, Evidence, and confidence, computed from remaining work, blocked critical-path items, time-to-deadline, and velocity measured from real completion-Event timestamps. The model is explicit and inspectable.

## RFC-0015 — Simulation
**Status:** Stable.
`simulate(hypotheticalEvents)` clones the log, appends hypotheticals on a **virtual timeline** (Law 9), re-derives, and diffs predictions/state. Results are real consequences of the hypothesis, never estimates. Real reality is never mutated.

## RFC-0016 — Decision
**Status:** Stable.
`decide()` ranks actions by impact × simulated improvement. Each action carries reason, Evidence, confidence, and an **expected result drawn from Simulation** (e.g. "48% → 97%, 5 days earlier").

## RFC-0017 — Memory
**Status:** Draft.
Tiers: working (live risks), short (recent Events), long & organizational (resolved patterns that survive staff turnover), semantic (type census), historical (full log). `memory()` exposes all tiers. `remember(signature, situation, resolution)` / `recall(signature)` capture organizational memory.

## RFC-0018 — Attention
**Status:** Draft.
Out of N events, few matter. `attention(limit, t)` scores open Objects by blocked-state, risk-path membership, dependency centrality, recency, and business value, returning the ranked few with reasons.

## RFC-0019 — Economics
**Status:** Draft.
Objects/Events may carry `cost`, `revenue`, `value`, `businessValue`. `economics()` computes value-at-risk = Σ(committed-customer value + goal value) × risk-probability, per goal, with confidence. Managers buy outcomes, so reasoning surfaces money.

## RFC-0020 — Permissions (reality-level)
**Status:** Draft.
A `Principal` holds capabilities (`see`, `predict`, `simulate`, `observe`, `coordinate`, `learn`, `delete`) and scope (object types / ids). Permission is evaluated **at retrieval**: `view(principal, t)` returns only what the Principal may see; reasoning runs over that view. Not bolted on per feature.

## RFC-0021 — RealityQL
**Status:** Stable.
A query language for reality (not SQL, not REST). Verbs map to engine capabilities:
```
OBSERVE <type|id|all>      UNDERSTAND                 EXPLAIN | WHY <id>
PREDICT <goal>             SIMULATE <action> <id>     DECIDE
COORDINATE <goal>          CAUSE <goal>               ATTENTION
ECONOMICS                  MEMORY                     GOALS
```
Modifiers: `AS OF <n>` (time-travel n days back), `LIMIT <n>`. Every read-verb result carries text + structured data (+ confidence where applicable).

## RFC-0022 — Adapter (Plugin) Contract
**Status:** Stable.
Integrations are **pure translators**, not connectors: `translate(eventType, payload) -> Op[]` where `Op` ∈ `{object|rel|event}`. `applyOps` ingests them uniformly (de-duplicating objects/relationships). GitHub, Slack, ERP, hospital, factory all share this one shape; the kernel never changes. Webhook adapters MUST verify source signatures before ingesting.

## RFC-0023 — Reality SDK
**Status:** Stable.
Developers program reality with verbs: `observe, understand, explain/why, predict, simulate, decide, coordinate, cause, attention, economics, memory, goals, remember/recall`, plus `ingest`, `ingestFrom(adapter,…)`, and `ql(query)`. Reads return `{ data, evidence?, confidence? }`.

---

## What was intentionally deferred (and why)

Faithful to "the core becomes smaller and more precise":
- **Multi-agent runtime** (Observer/Planner/Reasoner/…): specified as *roles over the SDK verbs* (an Observer calls `observe`, a Predictor calls `predict`), not a separate engine. Building a full agent runtime now would add surface area without strengthening the core.
- **Digital Twin** is not a separate product: the materialized reality (RFC-0004) **is** the live twin. No new concept required.
- **AI is a service, not the core.** The kernel reasons deterministically with Evidence and Confidence; an LLM is one optional Context/Explanation provider behind the same interfaces. (Aligns with the advisor's "remove AI emphasis.")
- **Chat is one client.** The same engine serves chat, dashboard, RealityQL, API, and adapters. (Aligns with "remove chat-as-core.")

— End of RFC Series v1 —

---

# RFC Series — Part II (v2 platform precision)

These RFCs make the platform precise enough that an independent team could implement a compatible kernel. All are implemented in `reality-types.js`, `reality-inference.js`, and `reality-kernel.js`.

## RFC-0024 — Reality Type System
**Status:** Stable.
An ontology *classifies*; a type system defines *behavior*. Each type declares `properties`, `lifecycle` (RFC-0025), `capabilities` (RFC-0032), and `constraints` (RFC-0026). `typeDef(type)` returns the behavior contract; capabilities are inherited along `extends`.

## RFC-0025 — Lifecycle
**Status:** Stable.
Every stateful type has a state machine: `{ initial, states:{from:[to…]}, terminal:[…] }`. `validTransition(type, from, to)` rejects illegal moves (a task may not go `created → done`). Engine status maps to a lifecycle state via `statusToLifecycle`. Examples: task `created→assigned→active→blocked→done→archived`; ai_agent `created→configured→learning→running→paused→stopped`; invoice `draft→issued→{paid|overdue}→archived`.

## RFC-0026 — Reality Constraints
**Status:** Stable.
Constraints define *valid* reality, independent of events: a task cannot finish before it starts; a child task needs a parent; a payment needs an invoice; no self-approval; no dependency cycle; a blocked item needs a reason. `checkConstraints(R, t)` returns `{constraint, subject, message, severity}` violations. Errors make reality inconsistent (RFC-0033 Verify).

## RFC-0027 — Reality Inference Engine
**Status:** Stable.
Forward-chaining derivation of facts nobody recorded, to a fixpoint. A rule reads the snapshot + facts-so-far and asserts new facts; facts can trigger further rules (multi-hop). Every inferred fact carries `confidence` and `because` (evidence). Example chain: *overdue invoice → cash-flow risk → hiring-delay risk → capacity-reduction risk.* Facts may be recorded back as `fact.inferred` events (source `inference`) so they persist and replay.

## RFC-0028 — Temporal Model (bitemporal+)
**Status:** Stable.
Each recorded Event carries four timestamps: **event time** (when it happened), **valid time** (when it became/ceases true), **observation time** (when we learned it), **processing time** (when the kernel received it). This enables honest audits ("what did we believe on date X?") and correct replay when data arrives late.

## RFC-0029 — Contradictions
**Status:** Stable.
Reality is not clean. When two sources assert conflicting states for the same subject (GitHub: *done*; Slack: *waiting*), the kernel **detects** the contradiction rather than silently overwriting. `detectContradictions()` returns the subject and the competing claims with their sources.

## RFC-0030 — Source Reliability
**Status:** Stable.
Each source carries a trust weight (sensor 0.95, github 0.9, erp 0.85, manual 0.8, ai 0.74, inference 0.7, slack 0.6, …). `resolveConflict(claims)` chooses the highest-reliability claim and records which it believed and why. Weights are configurable per deployment.

## RFC-0031 — Reality Versioning
**Status:** Stable.
Reality (not software) is versioned. Because the log is append-only, a version is a labeled point in the log; `tagVersion(name)` records `{name, at, seq}` and `versionState(name)` replays reality as of that version. Org-structure v4 → promotion → v5, each fully replayable.

## RFC-0032 — Universal Capability Model
**Status:** Stable.
Objects have capabilities, not just properties: human `decide/approve/communicate/learn`, robot `observe/move/report/act`, ai_agent `predict/recommend/simulate`. `can(type, capability)` is the authorization and orchestration primitive (who/what may do a thing).

## RFC-0033 — Reality Kernel API
**Status:** Stable.
The calls a conforming kernel MUST expose: `Observe()`, `Record()`, `Replay()`, `DeriveState()`, `ForkTimeline()`, `MergeTimeline()`, `Verify()`, `Explain()`, `ResolveConflict()`. Reference implementation in `reality-kernel.js`.

## RFC-0034 — Standard Formats (REF / ROF / RTP / RID)
**Status:** Draft Standard.
Interop formats so other software can speak Reality: **REF** (Reality Event Format) — `{id,type,subject,at,source,payload}`; **ROF** (Reality Object Format) — objects + relationships; **RID** (Reality Identity Format) — `rid:<type>:<slug|uuid>`, validated by `validRID`; **RTP** (Reality Timeline Protocol) — ordered REF stream with bitemporal stamps. "Our software exports REF" is how an ecosystem forms.

## RFC-0035 — Execution Model
**Status:** Stable.
The canonical pipeline `Record()` runs for every event:
`validate (lifecycle) → store → derive → constraints → inference → contradictions → resolve (reliability) → attention → predictions → publish (subscribers)`.
Each stage is observable in the returned trace; subscribers receive the trace for downstream automations.

— End of RFC Series Part II —

---

# RFC Series — Part III (the science layer)

## RFC-0036 — Integrity (tamper-evident log)
**Status:** Stable. The event log is sealed with a hash chain `hₖ = SHA256(hₖ₋₁ | canon(eₖ))`; any change to a historical event breaks all subsequent hashes. `sealChain()` / `verifyChain()`. **[demonstrated]**

## RFC-0037 — Federation & Distributed Reality
**Status:** Draft Standard. Instances exchange REF streams; because events are immutable and state is derived by folding a sorted set, instances converge order-independently (CRDT-like). `stateHash()` proves convergence; `mergeTimeline()` performs union-merge. Namespaced RIDs prevent identity collisions. **[demonstrated]**

## RFC-0038 — AI Plugin Interface
**Status:** Stable. AI is optional: Reasoning / Prediction / Optimization plugins over the deterministic kernel. `registerPlugin(kind,name,fn)` / `plugin(kind,name,input)`. The core runs with zero LLMs. **[demonstrated]**

---

# 🔒 SPECIFICATION FROZEN — v1.0

Per the principal-engineer review: **the specification is frozen at v1.0.** RFC-0001…0038 plus the Theory of Organizational Reality constitute the standard. No new RFCs will be added until the wedge has run with real teams — because the next improvements to this spec should come from **evidence from real usage**, not from more design.

What changes the spec from here on: data from real engineering teams using the GitHub wedge (does it detect blockers earlier? explain delays better? reduce coordination time? will someone pay?). Everything in `/wedge` exists to answer those four questions.
