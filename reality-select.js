/* =====================================================================
   RealityOS — Adaptive Algorithm Selection (reality-select.js)
   Reasoning ABOUT the reasoning. The engine does not merely answer; it
   reports WHY this algorithm, WHY NOT the alternatives, under WHICH
   assumptions the choice is valid, and what it cost.
     - exact optimization when feasible, approximate when not
     - Monte Carlo when uncertainty dominates, deterministic when negligible
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const O = req ? require('./reality-optimize.js') : root.RealityOptimize;
  const P = req ? require('./reality-probability.js') : root.RealityProbability;
  const G = req ? require('./reality-graph.js') : root.RealityGraph;

  const rationale = (chosen, why, rejected, assumptions, cost) => ({ algorithm: chosen, why, rejected, assumptions, cost });

  /* ---- 1. assignment: exact (Hungarian) vs approximate (annealing) ----
     Cost model calibrated by cold-start measurement on this runtime:
       Hungarian ≲ n³ / 6.0e5  ms   (cold: n=200→13ms, 300→50ms, 400→108ms)
     It is a CONSERVATIVE UPPER BOUND — after JIT warm-up the real cost is
     lower, so the engine may decline exactness it could have afforded. It
     never claims exactness it cannot deliver. Choice is budget-driven.     */
  const HUNGARIAN_OPS_PER_MS = 6.0e5;
  function selectAssignment(cost, { budgetMs = 250, hardCap = 5000 } = {}) {
    const n = cost.length, m = cost[0].length, size = Math.max(n, m);
    const estMs = Math.pow(size, 3) / HUNGARIAN_OPS_PER_MS;
    const feasible = estMs <= budgetMs && size <= hardCap;
    const t0 = Date.now();
    const result = feasible ? O.hungarian(cost) : O.assign(cost, { exactLimit: 0 });
    const ms = Date.now() - t0;
    return {
      result,
      reasoning: rationale(
        feasible ? 'Hungarian (exact, O(n³))' : 'greedy + simulated annealing (approximate)',
        feasible ? `n=${size} ⇒ estimated exact cost ${estMs.toFixed(0)}ms ≤ budget ${budgetMs}ms, so the provably optimal algorithm is affordable.`
                 : `n=${size} ⇒ estimated exact cost ${estMs.toFixed(0)}ms exceeds budget ${budgetMs}ms; optimality is traded for tractability.`,
        feasible ? [{ alt: 'simulated annealing', reason: 'unnecessary — the exact solution fits the budget, and approximating would forfeit the optimality guarantee' },
                    { alt: 'greedy', reason: 'no optimality guarantee; arbitrarily bad on adversarial cost matrices' }]
                 : [{ alt: 'Hungarian (exact)', reason: `estimated ${estMs.toFixed(0)}ms exceeds the ${budgetMs}ms interactive budget` },
                    { alt: 'brute force', reason: 'n! is intractable beyond n≈10' }],
        feasible ? ['cost matrix is complete and static', 'one task per agent (bipartite matching)', `cost model is a conservative upper bound (n³/${HUNGARIAN_OPS_PER_MS.toExponential(1)} ms, cold-start calibrated)`]
                 : ['approximate solution acceptable', 'cost matrix is complete', 'annealing schedule has converged'],
        { estimatedMs: +estMs.toFixed(1), measuredMs: ms, optimal: feasible })
    };
  }

  /* ---- 2. forecasting: deterministic CPM vs Monte Carlo ---- */
  /* Decision rule: if uncertainty is negligible (coefficient of variation below θ),
     a deterministic critical path is sufficient AND cheaper. Otherwise sample.   */
  function selectForecast(tasks, { deadline, cvThreshold = 0.10, samples = 8000 } = {}) {
    // coefficient of variation of each task's PERT distribution: σ/μ, σ ≈ (hi-lo)/6
    const cvs = tasks.map(t => { const mu = (t.lo + 4 * t.mode + t.hi) / 6, sd = (t.hi - t.lo) / 6; return mu > 0 ? sd / mu : 0; });
    const cv = cvs.reduce((a, b) => a + b, 0) / (cvs.length || 1);
    const uncertaintyDominates = cv > cvThreshold;
    const t0 = Date.now();
    let result;
    if (!uncertaintyDominates) {
      const cp = G.criticalPath(tasks.map(t => ({ id: t.id, duration: t.mode, deps: t.deps || [] })));
      result = { method: 'deterministic', p50: cp.projectEnd, p90: cp.projectEnd, pOnTime: deadline != null ? (cp.projectEnd <= deadline ? 1 : 0) : null, criticalChain: cp.chain };
    } else {
      const model = r => { const dur = {}; tasks.forEach(t => dur[t.id] = P.pert(r, t.lo, t.mode, t.hi));
        const order = G.topoSort(tasks.map(t => t.id), tasks.flatMap(t => (t.deps || []).map(d => ({ from: d, to: t.id }))));
        const fin = {}; for (const id of order) { const t = tasks.find(x => x.id === id); fin[id] = Math.max(0, ...(t.deps || []).map(d => fin[d])) + dur[id]; }
        return Math.max(...Object.values(fin)); };
      const mc = P.monteCarlo(model, samples, 42);
      result = { method: 'monte_carlo', p50: mc.p50, p90: mc.p90, pOnTime: deadline != null ? +(1 - P.probability(model, d => d > deadline, samples, 42)).toFixed(3) : null };
    }
    const ms = Date.now() - t0;
    return {
      result,
      reasoning: rationale(
        uncertaintyDominates ? `Monte Carlo (${samples} samples)` : 'deterministic critical path (CPM)',
        uncertaintyDominates ? `mean coefficient of variation ${cv.toFixed(3)} > θ=${cvThreshold}: uncertainty dominates, so a single date would be misleading — a distribution is required.`
                             : `mean coefficient of variation ${cv.toFixed(3)} ≤ θ=${cvThreshold}: uncertainty is negligible, so sampling would add cost without changing the answer.`,
        uncertaintyDominates ? [{ alt: 'deterministic CPM', reason: 'would report a point estimate whose realised probability may be near zero (the classic 50%-plan fallacy)' }]
                             : [{ alt: 'Monte Carlo', reason: `${samples} samples cost ~50× more and would return the same p50 within noise` }],
        uncertaintyDominates ? ['durations are independent PERT variables', 'dependency graph is acyclic and complete']
                             : ['durations are effectively point values', 'dependency graph is acyclic and complete'],
        { measuredMs: ms, cv: +cv.toFixed(3) })
    };
  }

  /* ---- 3. a meta-trace: the reasoning about reasoning, as a citable record ---- */
  function metaTrace(steps) {
    return { question: 'Why did the engine reason this way?',
      steps: steps.map((s, i) => ({ n: i + 1, layer: s.layer, chose: s.reasoning.algorithm, because: s.reasoning.why,
        insteadOf: s.reasoning.rejected.map(r => `${r.alt} (${r.reason})`), validIf: s.reasoning.assumptions, cost: s.reasoning.cost })) };
  }

  const API = { selectAssignment, selectForecast, metaTrace };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealitySelect = API;
})(typeof window !== 'undefined' ? window : this);
