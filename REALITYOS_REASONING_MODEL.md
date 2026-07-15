# RealityOS — The Reasoning Model

*How RealityOS thinks.* The other specs define **what** RealityOS is (objects, events, types, laws). This document defines **how it reasons** — the brain of the platform. It is backed by working code: `reality-engine.js`, `reality-inference.js`, `reality-kernel.js`, `reality-types.js`. Contact: **support@stmzkinetic.com**.

---

## 0. The one idea

RealityOS maintains a continuously evolving, evidence-backed model of reality, and *derives* understanding from it. It never simply asserts; it observes, infers, checks, and explains — always with evidence and a confidence number.

---

## 1. How does it observe?
Through **events only** (Law 1). Every change — from a person, an AI agent, a sensor, or an adapter translating GitHub/Slack/ERP — enters as an immutable, timestamped, attributed Event (RFC-0002). The kernel never trusts a raw "current state"; state is always *derived* by folding the event log (`DeriveState`, RFC-0004). Observation is bitemporal (RFC-0028): the kernel records when something happened, when it became true, when it was observed, and when it was processed.

## 2. How does it decide what is relevant?
Through **Attention** (RFC-0018). Out of thousands of events, few matter now. The kernel scores every open object by: blocked-state, membership on a risk path, dependency centrality, recency, and business value — and surfaces the ranked few with reasons. Relevance is computed, not guessed.

## 3. How does it infer new facts?
Through **forward-chaining inference** (RFC-0027). Rules read the derived snapshot and the facts inferred so far, and assert new facts to a fixpoint. Facts trigger facts: *overdue invoice → cash-flow risk → hiring-delay risk → capacity-reduction risk.* No human recorded those; the kernel derived them, each with confidence and evidence.

## 4. How does it resolve conflicting evidence?
Through **contradiction detection** (RFC-0029) plus **source reliability** (RFC-0030). When GitHub says *done* and Slack says *waiting* for the same task, the kernel does not silently overwrite — it flags the contradiction and resolves it by trust weight (sensor > github > erp > manual > ai > slack …), recording which claim it believed and why. Truth is adjudicated, not assumed.

## 5. How does it explain conclusions?
Through **Evidence** (RFC-0009) attached to every derived claim: the specific events, objects, and sources behind it, plus a **causal chain** (RFC-0012) from root cause to outcome. `Explain(id)` returns context (why this is in the state it's in), the causal chain, and the evidence. RealityOS proves; it does not assert.

## 6. How does it estimate uncertainty?
Through **Confidence** (RFC-0010), mandatory on every output ∈ [0,1] (Law 7). Predictions derive probability from remaining work, blocked critical-path items, time-to-deadline, and **measured velocity** (from real completion-event timestamps). The model is explicit and inspectable — never a black box.

## 7. How does it choose actions?
Through **simulation-backed Decision** (RFC-0015, RFC-0016). For each risk the kernel forks a virtual timeline (`ForkTimeline`), applies the candidate action, re-derives, and measures the change. Actions are ranked by impact × simulated improvement, each carrying an expected result drawn from simulation ("48% → 97%, 5 days earlier") and its evidence.

## 8. How does it learn from outcomes?
Through **Memory** (RFC-0017). Resolved situations become organizational patterns (`remember`/`recall`) that survive staff turnover and inform future understanding. Working, short, long, organizational, semantic, and historical tiers give the system both immediate focus and durable experience.

---

## 9. The Execution Model (the loop)

Every event runs the same canonical pipeline (RFC-0035), and every stage is observable:

```
Event arrives
  → validate    (lifecycle transition legal? RFC-0025)
  → store       (append immutable event, bitemporal stamps)
  → derive      (fold log → objects + relationships)
  → constraints (does reality remain valid? RFC-0026)
  → inference   (derive new facts to fixpoint, RFC-0027)
  → contradictions (any source conflicts? RFC-0029)
  → resolve     (believe the most reliable source, RFC-0030)
  → attention   (what now matters? RFC-0018)
  → predictions (recompute on-time odds, RFC-0014)
  → publish     (notify subscribers → automations)
```

Subscribers receive the full trace, so downstream automations react to a *reasoned* world, not raw events.

---

## 10. The Mathematical Model

Reality at time *t*:
```
Reality(t) = ⟨ O(t), R(t), E≤t ⟩
```
where `O(t)` = objects, `R(t)` = relationships, `E≤t` = all events up to *t*.

Derivation (state is a pure function of history):
```
O(t), R(t) = fold(materialize, E≤t)
```

Context of an entity:
```
Context(e, t) = ⟨ status(e,t), goal(e), deps(e), owners(e), Evidence ⟩
```

Evidence for a claim:
```
Evidence(c) = Events(c) ∪ Objects(c) ∪ Sources(c)
```

Prediction (probability of an outcome given history and context):
```
P(outcome | E≤t, Context),   0 ≤ P ≤ 1
P(on_time) = clamp( velocity · daysLeft / remaining − 0.42·blockedCritical )
velocity   = |completionEvents| / span(completionEvents)
```

Confidence is mandatory on every derived value:
```
∀ derived value d :  confidence(d) ∈ [0, 1]
```

Simulation (a virtual future, never mutating reality — Law 9):
```
Future = Reality(t) ⊕ Hypothetical Events
Δ = P(outcome | Future) − P(outcome | Reality(t))
```

Conflict resolution by source reliability:
```
believe = argmax_{claim} reliability(source(claim))
```

Inference (least fixpoint of the rule set R over facts F):
```
F* = lfp( F ↦ F ∪ ⋃_{rule∈R} rule(O,R,F) )
```

---

## 11. Developer Experience

A developer joining tomorrow can do all of the following with the reference implementation.

**Create a custom object**
```js
const id = R.object('robot:arm-7', 'robot', { name: 'Arm 7' });   // RealityID minted if omitted
```

**Define a new relationship**
```js
R.relate('robot:arm-7', 'located_at', 'location:floor-2');
```

**Add an inference rule** (`reality-inference.js`) — assert facts nobody recorded:
```js
RULES.push((R, snap, facts) =>
  R.byKind(snap, 'machine').filter(m => m.status === 'offline')
   .map(m => fact('downtime_risk', m.id, `${m.name} offline`, 0.7, { objects:[m.id] })));
```

**Plug in a reasoning service** — register it as a source with a reliability weight; it records events like any other actor:
```js
kernel.setSourceReliability('my-llm', 0.74);
kernel.record({ type:'risk.flagged', subject:'goal:checkout', source:'my-llm' });
```

**Build a connector** (RFC-0022) — a pure translator, then ingest through one contract:
```js
RealitySDK.registerAdapter('jira', (eventType, payload) => [ /* ops */ ]);
sdk.ingestFrom('jira', 'issue_updated', payload);
```

**Build an application on top** — read with verbs, never CRUD:
```js
sdk.predict('goal:checkout');   // { data, evidence, confidence }
sdk.ql('CAUSE goal:checkout');  // RealityQL
kernel.verify();                // consistency
kernel.exportREF();             // hand reality to another system
```

**Run the kernel pipeline directly**
```js
const trace = kernel.record({ type:'task.completed', subject:'task:ui', source:'github' });
// trace.violations, trace.inferred, trace.contradictions, trace.predictions
```

---

*This is the brain. Everything else is substrate it reasons over.*
