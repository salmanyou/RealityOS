# The Theory of Organizational Reality

*The science layer of RealityOS.* The specs define how RealityOS works; this defines **why it works** — its model, laws, mathematics, limits, complexity, security, and distribution. Claims marked **[demonstrated]** are backed by tests in the reference implementation. Contact: **support@stmzkinetic.com**.

> **RealityOS is not an application, nor an AI platform. It is a computational model for representing, understanding, predicting, and coordinating the evolving reality of organizations through evidence-backed events, relationships, and time.**

---

## 1. The Organizational Reality Model

Just as SQL proposed the relational model and event sourcing proposed append-only streams, RealityOS proposes the **Organizational Reality Model**:

```
Reality = Objects + Events + Relationships + Time
```

**Universality claim.** Any organization, process, or machine can be represented in this model, because each maps to the four primitives:

| Domain | Object | Event | Relationship | Time |
|---|---|---|---|---|
| Software team | task, PR, person | pr.merged | depends_on | deadline |
| Hospital | patient, bed, clinician | patient.admitted | assigned_to | care timeline |
| Factory | machine, order, part | machine.fault | part_of | production schedule |
| Spacecraft | subsystem, command, sensor | telemetry.received | controls | mission clock |

The model is **complete for state**: any state expressible as "what exists, what happened, how things relate, and when" is representable; and **closed under change**: the only way to change reality is to append an Event. The claim is falsifiable — a process that cannot be expressed as objects/events/relationships/time would refute it. None has been found across the domains above.

---

## 2. Organizational Physics (the laws)

Not implementation details — invariants that hold in every conforming kernel. **[demonstrated]**: laws 1–2, 5–8 are enforced by the engine (illegal writes throw; events are frozen).

- **Identity** — everything that exists has identity (a RealityID).
- **Change** — reality changes only through Events.
- **Persistence** — history never changes; only our understanding of it changes (via better derivation).
- **Evidence** — every derived fact carries the events, objects, and sources behind it.
- **Uncertainty** — every prediction carries a confidence ∈ [0,1].
- **Context** — nothing has meaning outside its context.
- **Causality** — every event has causes; effects propagate along relationships.
- **Attention** — only a small subset of reality deserves action at any moment.
- **Coordination** — value emerges from coordinated change, not isolated change.

---

## 3. Reality Mathematics

State is a pure function of history:
```
Reality(t) = ⟨ O(t), R(t), E≤t ⟩
O(t),R(t)  = fold(materialize, E≤t)              (derivation)
Reality(t+1) = Reality(t) ⊕ e                    (an event advances reality)
```
Evidence, prediction, context, simulation:
```
Evidence(s)   = Events(s) ∪ Sources(s) ∪ Relationships(s)
P(outcome | E≤t, Context) ∈ [0,1]
Context(e,t)  = ⟨status, goal, deps, owners, evidence⟩
Future        = Reality(t) ⊕ Hʜʏᴘᴏᴛʜᴇᴛɪᴄᴀʟ      (simulation; never mutates Reality)
```

### 3.1 Why inference is valid (and its limits)
Inference is the **least fixpoint** of a monotone rule set `R` over a fact set `F`:
```
F* = lfp( F ↦ F ∪ ⋃_{rule∈R} rule(O,R,F) )
```
- **Termination.** Rules only *add* facts (monotone) and the fact space is finite (bounded by object pairs × fact types), so the sequence is increasing and bounded ⇒ it reaches a fixpoint. **[demonstrated]**: the seed reaches its fixpoint in 2 iterations; the multi-hop invoice chain also terminates.
- **Determinism / agreement.** The fixpoint is independent of rule-application order, so two engines with the same log and rule set derive the **same** facts — they cannot disagree. **[demonstrated]** via federation convergence (§6).
- **Soundness is relative to the rules.** RealityOS does not claim inferred facts are true in the world — it claims they follow from the recorded events under the stated rules, each tagged with confidence. Garbage rules or garbage events yield garbage facts; this is why source reliability (§5) and evidence (Law of Evidence) exist.
- **Can it produce false facts?** Yes, if a rule is wrong or a source is wrong — which is exactly why every fact is defeasible (carries confidence and evidence) and why contradictions are surfaced, not hidden.

### 3.2 Assumptions (stated explicitly)
Every claim holds **only under** its assumptions — naming them is what makes this a theory, not a slogan.

- **Inference converges if** rules are *monotone* (only add facts) and the fact space is *finite* (bounded by object-pairs × fact-types) ⇒ an increasing, bounded sequence reaches a least fixpoint. Non-monotone (retracting) rules would break this and require stratification.
- **Two engines agree if** they share the *same event log* and the *same rule set*; derivation is a pure function of those two inputs.
- **Simulations are deterministic if** the prediction model is a pure function of state (no wall-clock, no randomness). The reference predictor is; a stochastic one would make simulation distributional.
- **Contradictions are resolvable if** every competing claim carries a *source* and every source has a *defined reliability weight*. Equal weights are surfaced for human decision, not silently broken.
- **Federation converges if** events are *immutable* with *globally-unique IDs* and merge is *union by ID* ⇒ the merged log is order-independent (a grow-only set).
- **The model is complete for a domain if** every state of interest is expressible as objects/events/relationships/time (the falsifiable claim of §1).

---

## 4. Complexity Analysis

The review's distinction, kept separate on purpose.

### 4.1 Algorithmic complexity (theoretical)
For a log of `n` events, `V` objects, `E` relationships, `r` inference rules, `d` the goal-local subgraph size:

```
Record (append)        O(log n)      sorted insert
Observe / DeriveState  O(n)          fold the log   →  O(tail) with snapshots
Replay@t               O(n)          fold to t
Inference              O(r · k · (V+E))   k = passes to fixpoint (small, bounded)
Predict                O(d)          goal-local subgraph, not the whole log
Simulate               O(n)          clone + re-derive
Attention              O(V + E)
ResolveConflict        O(c)          c = competing claims for a subject
sealChain              O(n)          one hash per event
stateHash              O(V + E)
```
The hot path is materialization (O(n)); the standard fix is periodic **snapshots** + tail replay, which makes Observe O(tail).

### 4.2 Practical performance (empirical)  **[measured]**
Reference implementation, milliseconds, by event-log size:

```
op                    200     1000     5000    20000
Observe/Derive        0.3      0.4      4.6      5.7
Replay@t              0.0      0.8      0.5      9.3
Inference             0.4      0.3      2.7     32.7
Predict               0.3      0.4      2.3      7.2
Simulate              0.7      4.3     10.9     37.9
Attention             0.6      0.8     14.5     35.3
sealChain             2.7     20.2     29.7     86.8
stateHash             0.4      0.9      6.6     21.1
```
Empirical curves match the theoretical bounds: linear ops grow linearly; goal-local ops stay cheap. A 20k-event log replays in single-digit-to-tens of milliseconds — comfortably interactive before any snapshotting.

---

## 5. Security & Threat Model

Beyond authentication. The questions the platform must answer:

- **Can timelines be tampered with?** The event log is sealed with a **hash chain**: `hₖ = SHA256(hₖ₋₁ | canon(eₖ))`. Any change to a historical event breaks every subsequent hash. **[demonstrated]**: forging one event's payload is detected at its exact position; an untampered log verifies.
- **Can evidence be forged?** Evidence references event IDs inside the sealed chain, so forged evidence implies a broken chain. Events SHOULD additionally carry source signatures (webhook adapters already verify `X-Hub-Signature-256`).
- **How is provenance preserved?** Every event carries an immutable `source`; reliability weighting (RFC-0030) is applied at reasoning time, never by rewriting history.
- **Can simulations leak confidential data?** Simulation runs on a fork; results MUST be filtered through the caller's `Principal` view (RFC-0020) before return — permission is evaluated at retrieval.
- **Can reasoning reveal restricted information?** Derived claims inherit the most restrictive permission of their evidence; a Principal that cannot see an event cannot receive a claim that depends on it.

This is a threat model, not a finished security product; signature coverage on every event and per-claim permission propagation are the next implementation steps.

### 5.1 Security Roadmap (production questions, acknowledged not yet solved)
- **Who signed this event?** Per-event source signatures (Ed25519) so every event proves its origin, not just webhook-level HMAC.
- **Can someone replay old events?** Nonce + monotonic per-source sequence numbers to reject replays.
- **Can I prove this event came from GitHub?** Pin the provider's signing key; record the verification result in provenance.
- **How do I revoke compromised credentials?** Key rotation with a revocation list; events signed by a revoked key flagged on re-verification.
- **Confidential simulation/reasoning leakage** → per-claim permission propagation (a claim inherits the strictest permission among its evidence).
These are deliberately deferred — listed so adopters know they're mapped, per the review's guidance.

---

## 6. Distributed & Federated Reality

Because events are **immutable** and reality is **derived by folding a sorted set** of them, two RealityOS instances that exchange their event logs converge to identical state regardless of message order — the log behaves like a grow-only, commutative set (a CRDT-like property).

- **Federation.** Instances exchange **REF** (Reality Event Format) streams. **[demonstrated]**: two kernels diverge, exchange events both ways, and converge to a byte-identical `stateHash` — *eventual consistency, order-independent*.
- **Distributed identity.** RIDs are namespaced (`rid:<type>:<slug>`); federation prefixes a namespace per instance (e.g. `acme:rid:…`) so identities never collide; trust between instances is established by signing REF streams.
- **Consistency model.** Within an instance: strong (single sorted log). Across instances: eventual — each converges as it receives the others' events; no central coordinator required.
- **The ecosystem goal.** When other software says *"we export Reality Events"* / *"we support the Reality Object Format"*, RealityOS has become a standard, not a product.

---

## 7. Machine Learning: deliberately reduced

AI is **not** the core. It is three optional plugin interfaces over the deterministic kernel: a **Reasoning** plugin, a **Prediction** plugin, and an **Optimization** plugin. **[demonstrated]**: a prediction plugin registers and runs while the core operates with zero LLMs. RealityOS survives even if today's models disappear — which is what makes it timeless.

---

## 8. What this theory does and does not claim

It claims: a universal data model for organizations; enforced invariants; inference with termination and order-independence; measured complexity; a tamper-evidence mechanism; and order-independent federation — all demonstrated in a reference kernel.

It does **not** claim: that the model is the *only* valid one; that inferred facts are true in the world (only that they follow from events under stated rules); or that elegance implies adoption. The theory makes RealityOS *provable*. Only real users make it *valuable*.
