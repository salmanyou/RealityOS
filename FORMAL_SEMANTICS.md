# Formal Semantics of the Reality Model

*The definition a second implementer could build from, and a verifier could check against.* Every axiom below is **machine-checked** by `reality-verify.js` against randomly generated realities (12/12 hold over 60 trials).

---

## 1. The object

A **Reality** is the five-tuple

```
𝓡 = ⟨ 𝒪, ℰ, ℛ, 𝒯, 𝒞 ⟩
```

| Symbol | Name | Definition |
|---|---|---|
| 𝒪 | Objects | entities with identity: `id ∈ RID`, `type ∈ Ω` (the ontology), derived `status` |
| ℰ | Events | an append-only, totally ordered sequence `e = ⟨id, type, subject, payload, at, source⟩` |
| ℛ | Relationships | typed, time-stamped edges `⟨from, rtype, to, since, until⟩` |
| 𝒯 | Time | a totally ordered domain; every event carries `at ∈ 𝒯` |
| 𝒞 | Constraints | predicates that define a *valid* reality, independent of history |

**Ontology.** `Ω` is a finite type hierarchy rooted at `entity`, with `isA : Ω × Ω → 𝔹` its reflexive-transitive closure. Unknown types normalise to `entity`, which is what makes the substrate open.

---

## 2. Derivation (the only way state exists)

State is not stored. It is a **left fold** of the log:

```
State(t) = ⟨𝒪(t), ℛ(t)⟩ = fold(δ, ∅, E≤t)      where  E≤t = { e ∈ ℰ : e.at ≤ t }
```

with `δ : State × Event → State` the transition function (object creation, patching, relationship birth/death, status reduction). Because `δ` is a pure function and `E≤t` is a sorted set, **derivation is deterministic and order-independent given the log**.

---

## 3. Belief, evidence, confidence

These are the semantics of *knowing*, not of *storing*.

**Evidence.** For a derived claim `c`:
```
Ev(c) = ⟨ events(c) ⊆ ℰ , objects(c) ⊆ 𝒪 , sources(c) ⟩
```
An explanation is **traceable** iff every `id ∈ events(c)` exists in ℰ (Axiom A10).

**Belief.** Following the ATMS: an assumption set (an *environment*) is `π ⊆ 𝒜`. Each proposition `p` carries a **label**
```
L(p) = { π₁, …, πₖ }          (minimal, pairwise ⊄, each consistent)
```
`p` is *believed* iff `∃ π ∈ L(p)` with `π` consistent, i.e. `¬∃ ν ∈ NoGood : ν ⊆ π`.

**Contradiction.** A set of mutually exclusive propositions induces
```
NoGood ← { πᵢ ∪ πⱼ : πᵢ ∈ L(pᵢ), πⱼ ∈ L(pⱼ), i ≠ j }
```
Contradictions are *represented*, never resolved by overwrite (Axiom A11).

**Belief revision.** Retracting an assumption `a` adds `{a}` to `NoGood` and re-propagates labels. Propositions supported only by `a` lose all consistent environments and cease to be believed — monotonically, without touching ℰ.

**Confidence.** Every derived value carries `conf ∈ [0,1]` (Axiom A7). Plausibility of an environment is `∏_{a∈π} rel(source(a))`.

---

## 4. Intervention and simulation

**Intervention** (Pearl's `do`) is *graph surgery*: `do(X)` deletes all edges into `X`, then derivation proceeds normally.
```
P(Y | do(X)) = Σ_z P(Y | X, Z=z) · P(Z=z)      for a valid backdoor set Z
```

**Simulation** is a *virtual timeline*: `𝓡' = 𝓡 ⊕ H` where `H` are hypothetical events appended to a **fork**. The law:
```
∀ H :  ℰ(𝓡) after simulate(H)  =  ℰ(𝓡) before simulate(H)      (Axiom A5)
```
Prediction never mutates reality; simulation never mutates the real log.

---

## 5. Explanation

An explanation is a finite structure
```
X = ⟨ claim, Ev, reasoning*, conf, alternatives*, tradeoffs*, assumptions*, unknowns*, risks* ⟩
```
and is **complete** iff `claim ≠ ⊥ ∧ Ev ≠ ∅ ∧ reasoning ≠ ε ∧ conf ≠ ⊥`. The engine reports incompleteness rather than emitting a bare assertion.

---

## 6. The axioms (machine-checked)

| # | Axiom |
|---|---|
| A1 | Events are immutable (frozen). |
| A2 | Time never goes backwards: the log is monotone non-decreasing in `at`. |
| A3 | State is a pure function of events: `State(t) = f(E≤t)`. |
| A4 | Replay equivalence: rebuilding from the log reproduces identical state. |
| A5 | Simulation never mutates reality. |
| A6 | Every event carries identity, timestamp, and provenance. |
| A7 | Every prediction carries a confidence in `[0,1]`. |
| A8 | History is append-only: deletion is tombstoning, never removal. |
| A9 | Every decision carries at least one evidence chain. |
| A10 | Every explanation is traceable: cited event ids exist in the log. |
| A11 | Contradictions are explicitly represented, never silently overwritten. |
| A12 | Determinism: derivation depends only on `(log, rules)` — no wall-clock, no randomness. |

`node -e "console.log(require('./reality-verify.js').verify({trials:60}).verified)"` → `true`.

---

## 7. Temporal logic over event traces

For a trace `σ = e₀e₁…eₙ` and predicates `φ, ψ : Event → 𝔹`:

| Operator | Meaning |
|---|---|
| `□φ` (ALWAYS) | `∀i. φ(eᵢ)` |
| `◇φ` (EVENTUALLY) | `∃i. φ(eᵢ)` |
| `¬◇φ` (NEVER) | no `eᵢ` satisfies `φ` |
| `φ ⊰ ψ` (BEFORE) | every `ψ` is preceded by some `φ` |
| `φ 𝓤 ψ` (UNTIL) | `φ` holds continuously up to the first `ψ` |
| `□(φ → ◇ψ)` (RESPONDS) | every `φ` is eventually answered by a `ψ` |

Domain packages ship temporal specifications, e.g. *payment ⊰ shipment*, *□(deploy.failed → ◇rollback)*, *consent ⊰ operation*. Violations return a **counterexample event**, not merely `false`.

---

## 8. Reasoning about reasoning

Algorithm choice is itself derived and justified:

```
select(problem, budget) → ⟨ algorithm, why, rejected*, assumptions*, cost ⟩
```

- **Assignment.** Exact Hungarian iff `n³ / c ≤ budget`, with `c` calibrated by cold-start measurement (a *conservative upper bound*; the engine may decline exactness it could have afforded, but never claims exactness it cannot deliver). Otherwise greedy + simulated annealing, and it says so.
- **Forecasting.** Deterministic CPM iff the mean coefficient of variation `cv = σ/μ ≤ θ`; otherwise Monte Carlo, because a point estimate whose realised probability is near zero is worse than no estimate.

---

## 9. Incremental and distributed derivation

**Incremental.** For an event on subject `s`, the affected set is the upward closure of `s` under `{advances, belongs_to, part_of, serves}` and the reverse closure under `depends_on`. Only affected goals are recomputed. **Correctness condition:** the incremental cache equals a full recomputation (checked by `validate()`).

**Distributed.** For any partition `{P₁…Pₖ}` of 𝒪 with events routed to every partition that mentions them,
```
State( merge(P₁ … Pₖ) )  ≡  State(𝓡)
```
because ℰ is a grow-only set of immutable, uniquely-identified events and merge is union-by-id. Verified for k ∈ {2,3,5}.

---

## 10. What the semantics deliberately do not fix

- **Rules are parameters, not axioms.** Inference is the least fixpoint of a *given* monotone rule set. Different rule sets yield different facts; the semantics guarantee only that two engines with the same log **and** the same rules agree.
- **Causal graphs are inputs.** `do(X)` is defined relative to a supplied DAG. Discovery (`reality-discover.js`) returns a **Markov equivalence class** and is marked *proposed — requires review*.
- **Soundness is relative.** RealityOS does not claim inferred facts are true of the world; it claims they follow from the recorded events under the stated rules, with stated confidence. Garbage in, garbage out — which is exactly why evidence, provenance, source reliability, and contradiction are first-class.
