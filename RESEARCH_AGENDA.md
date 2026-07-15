# Research Agenda

What is **proven**, what is **measured**, and what is **honestly open**. The discipline: no capability is claimed without an executable check.

## Proven (machine-checked)
| Claim | Where | Evidence |
|---|---|---|
| The 12 axioms of the Reality Model hold for arbitrary realities | `reality-verify.js` | 12/12 over 60 random realities (property-based) |
| Temporal specifications are decidable over event traces, with counterexamples | `reality-verify.js` | `payment ⊰ shipment` violation caught with the offending event |
| Incremental reasoning ≡ full recomputation | `reality-incremental.js` | `validate()` → equivalent |
| Distributed (partitioned) derivation ≡ centralized | `reality-incremental.js` | k ∈ {2,3,5} identical state |
| Federation converges order-independently | `reality-kernel.js` | identical `stateHash()` after bidirectional merge |
| The event log is tamper-evident | `reality-kernel.js` | forged historical event breaks the hash chain at its exact index |
| Hungarian assignment is optimal | `reality-optimize.js` | matches brute-force optimum |
| Backdoor adjustment recovers the true causal effect | `reality-causal.js` | naive 0.448 → adjusted 0.150 (truth 0.15) |
| Inference terminates (least fixpoint, monotone rules, finite fact space) | `reality-inference.js` | fixpoint in 2 passes |

## Measured (benchmarked against baselines)
`node bench/suite.js 200` — four question types, ground truth known.

| Question | RealityOS | Best baseline | Verdict |
|---|---|---|---|
| Q1 Which project slips? | **Brier 0.094**, acc 0.86 | rule engine 0.395 / 0.605 | RealityOS wins decisively |
| Q2 True bottleneck (top-1) | 0.525 | rule engine 0.555 | **statistically indistinguishable** (Δ=0.03, SE≈0.05) |
| Q3 Best intervention (regret vs oracle) | **0.001 days** | naive 0.373 days | RealityOS wins |
| Q4 Contradiction triage | 100% | — | ATMS + source reliability |
| Calibration | **ECE 0.049** (well calibrated) | — | when it says 80%, ≈80% happens |

**Honest note on Q2:** the oracle metric shrinks *realised* durations, which structurally favours duration-based rules — a model-only system cannot know which task realised long. The result is reported, not tuned away. It also produced a real improvement: the benchmark exposed that a centrality-weighted heuristic (0.335) was worse than **Monte-Carlo sensitivity analysis** (0.525), which is now the shipped method.

## Open problems (named, not hidden)

1. **Learning duration distributions from a team's history.** PERT triples are currently estimates. The Evidence Loop already scores predictions; closing the loop to *fit* durations from realised outcomes is the first thing a pilot should enable.
2. **Causal discovery under unobserved confounding.** `reality-discover.js` implements PC-stable, which is sound only under causal sufficiency, faithfulness, i.i.d. sampling, and linear-Gaussian dependence. FCI/latent-variable methods, and non-linear CI tests, remain open. All output is marked *proposed — requires review*.
3. **Ontology evolution.** `reality-ontology.js` proposes types and relation abstractions from structural signatures. Automatic adoption is unsafe; principled criteria for when a proposal becomes a type are open.
4. **Non-linear organizational physics.** `reality-physics.js` fits linear / exponential-decay / power-law and rejects poor fits. Arbitrary dynamics (delay-differential effects, feedback loops, hysteresis in team productivity) are unmodelled.
5. **Scaling derivation.** Materialisation is O(n) in the log. Snapshot + tail replay reduces it to O(tail); the snapshot policy and its interaction with incremental invalidation are unoptimised.
6. **Prediction beyond schedules.** The current predictor reasons about time. Quality, cost, morale, and churn are representable in the substrate but have no validated models.
7. **Human factors.** Whether teams *act* on early warnings — and whether acting changes outcomes — cannot be settled by mathematics. It requires the pilot.

## Deliberately excluded
Per review, and to keep the core small and defensible:
- category theory / homotopy type theory as *decoration*
- quantum-inspired anything
- Petri nets, process algebra, exotic formalisms without a use case
- LLMs anywhere in the kernel (they remain an optional plugin, RFC-0038)

The bar for any addition: **it must answer a question the current system cannot, and ship with a check that proves it does.**

## Paper outlines (drafts to write, not written)
1. *The Organizational Reality Model: a computational substrate for evidence-backed reasoning about work* — model, axioms, verification, universality across four domains.
2. *Reasoning about reasoning: budget-aware algorithm selection with justifications* — selection rules, conservative cost bounds, meta-traces.
3. *Truth maintenance for enterprise data conflicts* — ATMS over multi-source event logs; contradiction triage by source reliability; belief revision without rewriting history.
