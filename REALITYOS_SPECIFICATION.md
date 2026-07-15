# The RealityOS Specification

**Document:** RealityOS Core Specification
**Version:** 1.0 (Draft Standard)
**Status:** Foundational — defines the primitives, rules, engine, and conformance for any RealityOS implementation
**Field:** Organizational Computing
**Contact:** support@stmzkinetic.com

---

## Abstract

RealityOS defines a universal substrate for representing and reasoning about an organization. Where conventional software stores records and automates isolated tasks, RealityOS maintains a **living model of an organization** — its people, work, decisions, dependencies, and changes over time — and exposes reasoning over that model: context, understanding, prediction, simulation, decision, learning, and coordination.

This document specifies the primitives (Objects, Events, Relationships, Time), the rules that govern them, the reasoning layers built on top, the public API, the storage and security models, and the conformance requirements an implementation must meet. A conforming reference implementation accompanies this specification (`reality-engine.js`).

The guiding principle: **define the physics, and the products emerge.** Connectors, dashboards, chat, voice, and automation are all *interfaces* onto one substrate; none of them is the system.

---

## 1. Definition of Reality

> **Reality** is everything that exists and everything that happens, together with the relationships between them, through time.

Formally, the state of an organization's reality at time *t* is a tuple:

```
Reality(t) = ⟨ O(t), R(t), E≤t ⟩
```

where `E≤t` is the set of all events with timestamp ≤ *t*, and both the object set `O(t)` and relationship set `R(t)` are **derived functions** of `E≤t`. Reality is never stored directly; it is *reconstructed* from the event log. This makes time a first-class dimension: any past state is recoverable by replaying events up to a chosen *t*.

Reality is always a **model with uncertainty**, not ground truth. Every derived statement carries a confidence in [0,1].

---

## 2. The Four Primitives

Everything in any system reduces to four primitives. This is the core claim, and it is testable: GitHub, Slack, an ERP, a hospital, and a factory all decompose into exactly these.

### 2.1 Object — *everything that exists*

An Object is an entity with identity and state.

```
Object {
  id:      string        // stable, globally unique within a workspace
  type:    string        // person | goal | project | task | customer | code | document | …(open)
  status:  string        // active | blocked | done | cancelled | …(open)
  props:   map<string,any> // arbitrary typed attributes (name, deadline, role, …)
}
```

Object **type is open** — `task` and `room` and `invoice` are all just types. Implementations MUST NOT hardcode a closed list of types; verticals are expressed as type vocabularies, not as separate code paths.

### 2.2 Event — *everything that happens*

An Event is an immutable, timestamped, attributed record that something occurred. **Events are the sole source of truth.** Objects and Relationships are projections of events.

```
Event {
  id:       string
  type:     string     // dotted: <noun>.<verb>  e.g. task.blocked, invoice.paid, pr.merged
  subject:  string     // the Object id the event is about
  payload:  map         // event-specific data (e.g. {reason})
  at:       timestamp   // when it happened (ms epoch)
  source:   string      // origin (manual | adapter:github | simulation | …)
}
```

The event log is **append-only**. State is mutated only by appending events; there is no in-place update of objects. (Implementations MAY offer an `object.updated` event carrying a patch as a convenience, but it remains an appended event.)

### 2.3 Relationship — *the connections*

Objects never exist alone. A Relationship is a typed, directed, temporally-valid edge.

```
Relationship {
  id:        string
  from:      objectId
  rtype:     string    // depends_on | blocks | advances | belongs_to | owns | committed_to | implements | …(open)
  to:        objectId
  validFrom: timestamp
  validTo:   timestamp | null   // null = currently active
}
```

Relationships are created and ended by events (`rel.created`, `rel.ended`), so the graph itself is time-travelable: the graph "as of *t*" includes only relationships valid at *t*.

### 2.4 Time — *the dimension*

Every event and relationship carries timestamps. Time enables:
- **Reconstruction** of any past state (`materialize(t)`).
- **Velocity** measurement (events per unit time).
- **Prediction** (projecting trajectories forward).
- **Audit** (what did we believe, and when).

A system without time cannot reason about change, and change is most of what matters.

---

## 3. Rules of the System (invariants)

A conforming implementation MUST uphold:

1. **Event immutability.** Events are never modified or deleted. Corrections are new events.
2. **Derivation purity.** `O(t)` and `R(t)` are pure functions of `E≤t`. Given the same log, two implementations MUST produce the same materialized state.
3. **Temporal correctness.** `materialize(t)` MUST ignore all events with `at > t`.
4. **Confidence everywhere.** Every reasoning output (context, risk, prediction, recommendation) MUST carry a confidence or probability.
5. **Provenance everywhere.** Every derived claim MUST be traceable to the events that support it.
6. **Type openness.** No closed enumeration of object/relationship types in core logic.
7. **Permission at retrieval.** Access control is applied when reality is *read* for a principal, not bolted on per feature (see §7).

---

## 4. The Reasoning Layers

The substrate (§2) is Layer 1. Layers 2–8 are reasoning built on it. Each maps to a concrete engine operation.

| Layer | Name | Question it answers | Engine operation |
|------:|------|---------------------|------------------|
| 1 | Substrate | What exists / happened / connects / when | `materialize(t)`, `neighbors`, `byType` |
| 2 | **Context** | *Why* is this in this state? | `context(id,t)` → reasons + supporting events |
| 3 | **Understanding** | What does it *mean* across the whole? | `understand(t)` → risks, bottlenecks, cycles |
| 4 | **Prediction** | What is *about to* happen? | `predict(goalId,t)` → probability + drivers + projected date |
| 5 | **Simulation** | What if X happened? | `simulate(hypos)` → re-derive on a cloned log, diff |
| 6 | **Decision** | What should we *do*? | `decide(t)` → ranked actions w/ reason, evidence, confidence, expected result |
| 7 | **Learning** | What worked before? | `remember/recall` → organizational memory |
| 8 | **Coordination** | Who does what, when? | `coordinate(goalId)` → owner/task/sequence |

### 4.1 Context (Layer 2)
Assemble the subgraph around an object and the events producing its state. For a blocked object, walk `blocked_by`/unfinished `depends_on` to the blocker; surface downstream dependents and goal/deadline pressure. Output: ordered reasons + supporting event ids + confidence.

### 4.2 Understanding (Layer 3)
Derive higher-order facts with deterministic graph algorithms where possible (critical-path membership, degree/centrality for bottlenecks, DFS for dependency cycles), reserving model judgment for genuinely fuzzy calls. Output: risks (each tied to a goal, with probability and evidence), bottlenecks, cycles.

### 4.3 Prediction (Layer 4)
For a goal, compute on-time probability from: remaining vs total tasks, blocked tasks on the critical path, days to deadline, and **velocity measured from real completion-event timestamps**. Output: probability, drivers, projected date. The model is explicit and inspectable — no opaque score.

### 4.4 Simulation (Layer 5)
Clone the event log, append hypothetical events, re-derive, and **diff predictions and states** against the unmodified world. Because simulation re-runs the same pure derivation, results are real consequences of the hypothetical, not estimates. Output: before/after predictions with deltas and date shifts.

### 4.5 Decision (Layer 6)
For each risk, simulate the candidate remedy (e.g., unblock+complete a blocker), rank actions by impact × resulting-improvement, and attach reason, evidence (event ids), confidence, and an **expected result drawn from the simulation**. The system becomes an advisor, not a dashboard.

### 4.6 Learning (Layer 7)
Persist resolved patterns keyed by a situation signature; recall them when a matching situation recurs. This captures organizational memory that is otherwise lost to staff turnover.

### 4.7 Coordination (Layer 8)
For a goal, resolve the set of (who, what, when, priority) needed to align it — owners of remaining/blocking tasks in dependency order.

---

## 5. The Public API (capabilities, not CRUD)

External systems integrate by asking RealityOS to *reason*, not to fetch rows. Every response carries `confidence`/`probability` and provenance.

```
ingest(event)                         // universal write — the ONLY ingestion primitive
AskReality(question, asPrincipal)     // natural-language → context/understanding/prediction
Understand(objectId?)                 // risks, bottlenecks, cycles
Predict(subjectId, horizon)           // forecast + drivers + projected date
Simulate(hypotheticalEvents)          // what-if → before/after deltas
Decide(scope?)                        // ranked actions w/ evidence + expected result
Explain(claimId)                      // provenance + reasoning chain
Coordinate(goalId)                    // who/what/when
Remember(pattern) / Recall(signature) // organizational memory
SearchReality(query, asPrincipal)     // permission-aware retrieval
```

There is exactly **one ingestion primitive** (`ingest`). Tool-specific adapters (GitHub, Slack, ERP) are thin translators that map external payloads to RealityOS events — they live outside core and add no new core concepts. This is the difference between "write a connector per tool" and "everything is Objects/Events/Relationships/Time."

---

## 6. Storage Model

- **Event store (source of truth):** append-only, ordered by `at`. Start with a single relational store (e.g., Postgres append-only table); introduce a log/stream (Kafka/Redpanda) only at scale.
- **Materialized projections:** object-state and the active relationship graph, rebuilt from events; cacheable and fully reconstructable. Lost projections are never a data-loss event.
- **Graph index:** for traversal-heavy queries (adjacency). Postgres + a graph extension early; a dedicated graph store later.
- **Vector index:** for semantic retrieval over object/event text (optional until natural-language retrieval is needed).
- **Memory store:** learned patterns (Layer 7).

Because state is derived, **improving the extraction/derivation logic and replaying the log upgrades all historical insight** — a property conventional CRUD systems lack.

---

## 7. Security Model

Security is the product's license to exist; it is specified as core, not optional.

- **Permission-aware retrieval.** Reality is read *as a principal*. Any answer MUST be filtered to what that principal is permitted to see in the underlying sources. Permission is evaluated at read time, per query, per principal — never reconstructed ad hoc per feature.
- **Tenant isolation by construction.** Workspace/tenant id propagates through every store access; cross-tenant access is impossible by design.
- **Provenance & audit.** The append-only log yields a complete, immutable audit trail for free: every event, query, and action is attributable.
- **Encryption.** TLS in transit; encryption at rest with per-tenant key separation; customer-managed keys for the enterprise tier.
- **Right to deletion under event sourcing.** Support crypto-shredding/tombstoning from day one so immutability and deletion obligations coexist.
- **Keys never in clients.** Ingestion/API credentials live server-side only. A key shipped in a front-end or mobile app is a compromised key.

---

## 8. Reference Implementation & Conformance

The accompanying `reality-engine.js` is the normative reference. It is pure and dependency-free, runs identically in the browser and on a server, and implements §2–§4 and the engine operations in §5.

An implementation is **conforming** if it:
1. Treats events as the sole, immutable source of truth (§3.1–3.2).
2. Implements `materialize(t)` with temporal correctness (§3.3) producing state identical to the reference for the same log.
3. Implements Context, Understanding, Prediction, Simulation, Decision, Coordination with confidence and provenance (§3.4–3.5, §4).
4. Exposes the single `ingest` primitive and the capability API (§5).
5. Enforces permission-aware retrieval and tenant isolation (§7).

The reference engine is validated by a test harness exercising event-sourcing, time-travel, context, understanding, prediction, a real what-if simulation, decision, and coordination over a seed reality — all outputs derived, none hardcoded.

---

## 9. The First Wedge (implementation sequencing)

A specification is not a company. The disciplined first product is the **smallest slice of this substrate that is valuable alone**:

> **Foresight for software/product teams (10–200 people).** Ingest events from GitHub, an issue tracker, chat, and calendar; build the reality graph; ship Layers 2–6 (context, understanding, prediction, simulation, decision) as a "what's about to go wrong, and what to do" product. It is valuable on its own and is the seed crystal from which APIs, additional verticals, and the broader platform grow — consistently, because they all reduce to the same primitives.

Everything else in the broader vision (marketplace, SDK suite, additional industry vocabularies, enterprise deployment) is earned by, and grown from, this wedge.

---

## Appendix A — Worked decomposition (the core claim, demonstrated)

| System | Objects | Events | Relationships |
|--------|---------|--------|---------------|
| GitHub | repo, branch, PR, issue, developer | commit, push, merge, review | developer **owns** PR; issue **blocks** PR; commit **fixes** issue |
| Slack | user, channel, thread, message | message, reaction, mention, join | user **belongs_to** channel; thread **belongs_to** message |
| ERP | invoice, supplier, warehouse, customer | payment, shipment, purchase, sale | invoice **belongs_to** customer; shipment **fulfills** order |
| Hospital | patient, order, lab, bed, clinician | admit, order, result, handoff, discharge | order **belongs_to** patient; clinician **owns** handoff |
| Factory | line, machine, order, shift | start, stop, fault, complete | order **runs_on** line; fault **threatens** order |

Every row is the same four primitives. That identity is what makes RealityOS one system instead of *n* connectors — and what makes Organizational Computing a field rather than a product.

— End of Specification v1.0 —
