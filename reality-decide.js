/* =====================================================================
   RealityOS — Decision Engine (reality-decide.js)
   "Eventually RealityOS should stop recommending. It should EXPLAIN."
   Fuses the whole stack:
     graph (critical path) → probability (Monte Carlo) → causal (root cause)
     → optimization (assignment) → information (what's unknown)
   Returns OPTIONS, not an answer:
     Option A fastest · Option B cheapest · Option C lowest risk
   Each with: evidence · reasoning path · confidence · assumptions · unknowns
   Pareto-optimal options are marked; dominated options are labelled.
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const G = req ? require('./reality-graph.js') : root.RealityGraph;
  const P = req ? require('./reality-probability.js') : root.RealityProbability;
  const C = req ? require('./reality-causal.js') : root.RealityCausal;
  const I = req ? require('./reality-information.js') : root.RealityInformation;

  /* An intervention: { name, cost, apply(world) -> world', assumptions:[], evidence:[] } */
  /* world: { tasks:[{id,lo,mode,hi,deps}], deadline, seed } */

  function simulateWorld(world, n = 10000) {
    const tasks = world.tasks;
    // Monte Carlo over the DAG: sample durations, compute longest path (stochastic critical path)
    const model = (r) => {
      const dur = {}; tasks.forEach(t => dur[t.id] = P.pert(r, t.lo, t.mode, t.hi));
      const finish = {};
      const order = G.topoSort(tasks.map(t => t.id), tasks.flatMap(t => (t.deps || []).map(d => ({ from: d, to: t.id }))));
      for (const id of order) { const t = tasks.find(x => x.id === id); const start = Math.max(0, ...(t.deps || []).map(d => finish[d])); finish[id] = start + dur[id]; }
      return Math.max(...Object.values(finish));
    };
    const mc = P.monteCarlo(model, n, world.seed || 42);
    const pMiss = P.probability(model, d => d > world.deadline, n, world.seed || 42);
    return { p50: mc.p50, p90: mc.p90, mean: mc.mean, pMiss, pOnTime: +(1 - pMiss).toFixed(4) };
  }

  /* deterministic critical path (which chain drives the delay) */
  function criticalChain(world) {
    return G.criticalPath(world.tasks.map(t => ({ id: t.id, duration: t.mode, deps: t.deps || [] })));
  }

  /* Pareto front over (days, cost, risk) — lower is better on all three */
  function paretoFront(options) {
    return options.map(o => {
      const dominated = options.some(p => p !== o &&
        p.days <= o.days && p.cost <= o.cost && p.risk <= o.risk &&
        (p.days < o.days || p.cost < o.cost || p.risk < o.risk));
      return { ...o, pareto: !dominated };
    });
  }

  /* ---------- the main call ---------- */
  function decide(world, interventions, opts = {}) {
    const n = opts.samples || 10000;
    const base = simulateWorld(world, n);
    const chain = criticalChain(world);

    // evaluate each intervention on a FORKED world (reality is never mutated)
    const evaluated = interventions.map(iv => {
      const w2 = iv.apply(JSON.parse(JSON.stringify(world)));
      const sim = simulateWorld(w2, n);
      return {
        name: iv.name, days: sim.p50, p90: sim.p90, cost: iv.cost, risk: +(sim.pMiss).toFixed(3),
        onTime: sim.pOnTime, daysSaved: +(base.p50 - sim.p50).toFixed(2),
        assumptions: iv.assumptions || [], evidence: iv.evidence || [],
      };
    });

    // root causes: which single fix removes the most delay? (counterfactual on the same model)
    const causes = C.rootCauses(
      interventions.map(iv => ({ name: iv.name, iv })),
      (c) => simulateWorld(c.iv.apply(JSON.parse(JSON.stringify(world))), Math.min(n, 4000)).p50,
      base.p50
    );

    // label the trade-offs
    const front = paretoFront(evaluated);
    const byDays = [...front].sort((a, b) => a.days - b.days)[0];
    const byCost = [...front].sort((a, b) => a.cost - b.cost)[0];
    const byRisk = [...front].sort((a, b) => a.risk - b.risk)[0];
    const label = (o) => [o === byDays ? 'FASTEST' : null, o === byCost ? 'CHEAPEST' : null, o === byRisk ? 'LOWEST RISK' : null].filter(Boolean);

    // confidence: how separated are the options? (bigger gap = more confident recommendation)
    const spread = Math.abs(byDays.days - (front.filter(o => o !== byDays).sort((a, b) => a.days - b.days)[0] || byDays).days);
    const confidence = +Math.max(0.4, Math.min(0.95, 0.5 + spread / 10)).toFixed(2);

    // unknowns: what evidence would most reduce uncertainty about the outcome?
    const unknowns = I.nextBestQuestion(base.pMiss, opts.questions || [
      { name: 'Confirm CI failure root cause', pIfTrue: 0.85, pIfFalse: 0.2, cost: 1 },
      { name: 'Confirm engineer availability', pIfTrue: 0.7, pIfFalse: 0.3, cost: 1 },
    ]);

    return {
      baseline: { p50Days: base.p50, p90Days: base.p90, pOnTime: base.pOnTime, deadline: world.deadline },
      criticalChain: chain.chain,
      options: front.map(o => ({ ...o, labels: label(o) })),
      rootCauses: causes,
      reasoningPath: [
        'topological sort + critical path → the chain that drives maximum delay',
        'Monte Carlo (PERT durations) → completion distribution, not a single date',
        'fork reality per intervention → re-simulate (never mutates the real timeline)',
        'counterfactual per cause → delay removed if that cause were fixed',
        'Pareto front over (days, cost, risk) → trade-offs, not a single answer',
      ],
      confidence,
      assumptions: ['task durations follow PERT(lo,mode,hi)', 'dependencies are correct and complete', 'interventions take effect immediately', 'no unmodelled outside events'],
      unknowns: unknowns.slice(0, 3),
    };
  }

  const API = { decide, simulateWorld, criticalChain, paretoFront };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityDecide = API;
})(typeof window !== 'undefined' ? window : this);
