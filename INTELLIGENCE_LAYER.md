# The Intelligence Layer

Everything **above** the Decision Engine. The reasoning core (Phase 1) answered *"what should we do?"* This layer answers *"what is true, what does it mean, and how do we act autonomously?"*

```
              Applications
                   │
                 Agents          reality-agents.js      (Contract Net Protocol)
                   │
                Planning         reality-planner.js     (HTN / SHOP-style)
                   │
                Decision         reality-decide.js
                   │
               Simulation        Monte Carlo, forked timelines
                   │
               Prediction        stochastic critical path
                   │
              Optimization       reality-optimize.js
                   │
                 Causal          reality-causal.js
                   │
               Knowledge         reality-understand.js  (abstractions)
                   │
                 Truth           reality-truth.js       (ATMS)
                   │
                 Graph           reality-graph.js
                   │
          Temporal Event Log     reality-engine.js
                   │
                Storage          db.js
```

**No LLM is used anywhere.** This is symbolic AI and mathematics: assumption-based truth maintenance, hierarchical task networks, contract-net auctions, regression, graph theory, Monte Carlo, causal inference.

---

## The 12 systems — status, honestly

| # | System | Status | Where |
|---|---|---|---|
| 1 | Reality Compiler | ✅ built (archetype library; generic fallback) | `reality-compiler.js` |
| 2 | Reality Language | ✅ built (`SHOW … CAUSED BY … AFFECTING … NEXT n DAYS`, `ABSTRACTIONS`, 18 verbs) | `realityql.js` |
| 3 | Digital Twin Engine | ✅ built (live sync, freshness, drift, reconcile) | `reality-twin.js` |
| 4 | Memory Engine | ✅ built (facts, evidence, beliefs, confidence, sources, contradictions, history, reasoning chains) | `reality-engine.js` + `reality-truth.js` |
| 5 | Truth Engine | ✅ built (ATMS: competing hypotheses, nogoods, belief revision, provenance) | `reality-truth.js` |
| 6 | Learning Engine | ✅ built (prediction → outcome → Brier → calibration) | `reality-feedback.js` |
| 7 | Multi-Agent Society | ✅ built (Contract Net: announce → bid → award; coalitions) | `reality-agents.js` |
| 8 | World Model | ⚠️ **partial** — universal substrate proven across 4 domains; *not* a general world model | `demo/universal.js` |
| 9 | Explanation Engine | ✅ built (claim · evidence · reasoning · confidence · alternatives · trade-offs · unknowns · future risks) | `reality-explain.js` |
| 10 | Self-Evolving Ontology | ⚠️ **proposes only** — discovers candidate types/relations; never auto-adopts | `reality-ontology.js` |
| 11 | Autonomous Planner | ✅ built (HTN with backtracking → schedule, budget, risk, monitoring) | `reality-planner.js` |
| 12 | Reality Physics | ✅ built (learns laws from data; **rejects** poor fits) | `reality-physics.js` |
| ★ | **Understanding** (the biggest gap) | ✅ built — abstractions, not facts | `reality-understand.js` |

---

## ★ Understanding — "not reasoning, understanding"

The review's central point: *a graph can tell you payment blocks deployment; understanding means recognising the organisation is becoming fragile.* `reality-understand.js` discovers **higher-level structures**, each with a metric, evidence, and confidence:

- **Knowledge concentration / bus factor** — Herfindahl index + Gini over ownership.
  *"Knowledge is concentrating in Omar Riaz — bus factor 1. Losing them stalls 57% of active work."* (HHI 0.388, Gini 0.457)
- **Structural fragility** — articulation points (Tarjan) in the dependency graph.
  *"The plan is fragile: 1 single point of failure (QA pass). Any one stalling severs the delivery path."*
- **Over-optimised for speed** — exact serial-chain test (no node with in/out-degree > 1).
  *"A serial chain with no parallel redundancy — optimised for speed, under-invested in resilience."*
- **Systemic process weakness** — clusters recurring blocker reasons.
  *"3 of 3 blockers trace to the same weakness ('vendor'). Fixing the process removes a class of failures, not one incident."*
- **Overload** — one person carrying several blocked contexts.

## 5. Truth Engine — maintain competing hypotheses, don't choose

An **Assumption-based Truth Maintenance System** (de Kleer, 1986). Each proposition carries a *label*: the minimal sets of assumptions ("environments") under which it holds. Inconsistent assumption sets become **nogoods**. Unlike a justification-based TMS (single context), an ATMS keeps **multiple contexts of belief alive simultaneously**.

CRM says *paid*, ERP says *not paid*, the bank says *pending*:
```
● pending   plausibility 0.95   (Bank)
● unpaid    plausibility 0.85   (ERP)
● paid      plausibility 0.80   (CRM)
nogoods: crm+erp, crm+bank, erp+bank
```
Nothing is forced. When evidence arrives (*"the CRM export was 3 days stale"*), `retract()` performs **belief revision**: `paid` collapses, the rest survive, and `why()` gives the provenance for whatever remains.

## 11. Autonomous Planner — HTN

Following SHOP/SHOP2 (Erol–Hendler–Nau; Nau et al. 2003): **methods** decompose compound tasks under preconditions; **operators** are primitive actions with effects; depth-first forward decomposition tracks state in execution order and **backtracks** when a branch fails. *"Launch Product"* → an 11-step executable plan with critical chain, p50/p90 schedule, $35,200 budget, risk of missing the deadline, resource roles, and monitoring checkpoints. Unfunded → it correctly reports **no feasible plan** rather than inventing one.

## 7. Multi-Agent Society — Contract Net

Smith's Contract Net Protocol (1980): a manager **announces** a task, capable agents **bid**, the manager **awards** to the best value (confidence per unit cost), with load-balancing across rounds. Coalitions form across capabilities. When no agent can do a task, it is reported **UNASSIGNED** — an honest gap, not a hallucinated assignment.

## 12. Reality Physics — laws, not vibes

Fits **linear / exponential-decay / power-law** models and accepts a law only if R² clears a threshold *and* beats the linear baseline:
```
engineer_overload → productivity:  y = 1.005·e^(-0.351·x)   R² = 0.9999   NON-LINEAR ✓
meetings → moon phase:             REJECTED (best R² = 0.25 < 0.75)
```
Ground truth was `e^(-0.35x)`. It recovered `k = 0.351`.

## 1. Reality Compiler

`compile('hospital', {goal})` emits objects, relationships, constraints, policies, capabilities, resources, goals, and a genesis event — a reality that is **immediately reasonable** (critical chain: Admission → Lab work → Operation → Recovery). Unknown domains compile through the **generic archetype**, which is exactly why the substrate is universal. The archetype library is *knowledge*, not magic — and it grows via `defineArchetype()`.

## 3. Digital Twin

Registers live sources with heartbeats, tracks **freshness**, detects **drift** (derived state hash vs expected), and **reconciles** by replaying authoritative events. Critically, it *admits when it is stale*: `trustworthy: false` when a source goes quiet. A mirror that lies about being live is worse than no mirror.

## 9. Explanation Engine

Every decision is published like a proof — **Claim → Evidence → Reasoning → Confidence → Alternatives → Trade-offs → Assumptions → Unknowns → Future risks** — and flags itself `[explanation complete: NO]` if any section is missing.

---

## Deliberately honest limits

- **World Model (#8)** — the substrate is proven universal across software / hospital / factory / spacecraft. That is *not* the same as modelling cities, climate, or economies. Those remain open problems.
- **Ontology evolution (#10)** — automatic ontology discovery is an active research problem. This module **proposes** candidate types and relation abstractions with confidence, and states `proposed (requires review)`. Silent auto-adoption would be reckless.
- **Reality Compiler (#1)** — driven by an archetype library plus a generic fallback. It does not derive an unknown domain's physics from a sentence; it composes known structure. Compiling a *novel* domain from natural language is where an LLM could legitimately serve as a **plugin** (RFC-0038) — proposing an archetype for human review, never bypassing the kernel.
- **Reality Physics (#12)** — fits three functional forms. It cannot discover arbitrary dynamics or causal structure; causal *discovery* (PC/FCI) is future work, and causal graphs remain human-supplied.
- **Agents (#7)** — roles over the reasoning stack with a real auction protocol. They are not learning agents and do not negotiate beyond bid/award.

Everything above is executed and verified: **24/24 regression** across substrate, mathematics, and intelligence layer. `node demo/intelligence.js` runs all nine systems end to end.

---

## Where this sits in the roadmap

- **Phase 1 — Mathematical Kernel:** ✅ complete
- **Phase 2 — Intelligence Layer:** ✅ built (compiler, language, twin, truth, learning, explanation)
- **Phase 3 — Autonomous Reasoning:** ✅ planner + agents + physics built · ⚠️ ontology evolution proposes only · ⚠️ world model partial
- **Phase 4 — Platform:** ✅ SDK, plugins, APIs, multi-tenancy, security (see `PRODUCTION.md`)

> The vision is a universal reasoning substrate. The engineering goal is reliable, measurable capabilities, one layer at a time. The product goal is unchanged: solve one real problem so well that a team keeps using it.
