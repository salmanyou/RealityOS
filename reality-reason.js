/* =====================================================================
   RealityOS — The Reasoning Stack (reality-reason.js)
   Bridges the substrate (Objects · Events · Relationships · Time)
   to the mathematics. Domain-agnostic: software, hospital, factory,
   spacecraft — the same primitives, so the same code.

       Humans / AI Agents
              │
        Decision Engine      reality-decide.js
              │
       Simulation Engine     Monte Carlo (probability)
              │
       Prediction Engine     stochastic critical path
              │
      Optimization Engine    reality-optimize.js
              │
       Causal Reasoning      reality-causal.js
              │
        Knowledge Graph      reality-graph.js
              │
           Event Log         reality-engine.js  (append-only)
              │
            Storage          db.js
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const E = req ? require('./reality-engine.js') : root.RealityEngine;
  const G = req ? require('./reality-graph.js') : root.RealityGraph;
  const P = req ? require('./reality-probability.js') : root.RealityProbability;
  const C = req ? require('./reality-causal.js') : root.RealityCausal;
  const I = req ? require('./reality-information.js') : root.RealityInformation;
  const O = req ? require('./reality-optimize.js') : root.RealityOptimize;
  const D = req ? require('./reality-decide.js') : root.RealityDecide;

  /* ---- extract a task DAG from ANY Reality instance (domain-agnostic) ----
     work items = anything that IS-A `process` in the ontology (task, project,
     operation, deployment, shipment, …) plus `code`. Using the hierarchy —
     not a hard-coded list — means DOMAIN PACKAGES that add new process types
     are reasoned over automatically, without touching the kernel.          */
  function toTaskDAG(R, { workTypes = null, t } = {}) {
    const snap = R.materialize(t);
    const CONTAINERS = ['project'];                       // containers hold work; they are not work
    const isWork = o => workTypes ? workTypes.includes(o.type)
      : (!CONTAINERS.includes(o.type) && (E.isA(o.type, 'process') || o.type === 'code'));
    const work = [...snap.objects.values()].filter(isWork);
    const ids = new Set(work.map(w => w.id));
    return work.map(w => {
      const deps = snap.rels.filter(r => r.from === w.id && r.rtype === 'depends_on' && ids.has(r.to)).map(r => r.to);
      // duration uncertainty: explicit estimate, else derived from state (blocked = slower, wider)
      const lo = w.lo != null ? w.lo : (w.status === 'blocked' ? 1.5 : 0.5);
      const mode = w.mode != null ? w.mode : (w.status === 'blocked' ? 3.0 : 1.0);
      const hi = w.hi != null ? w.hi : (w.status === 'blocked' ? 7.0 : 2.5);
      return { id: w.id, name: w.name || w.id, status: w.status, lo, mode, hi, deps };
    });
  }

  /* ---- the full stack, in one call ---- */
  function reason(R, { deadline, interventions = [], samples = 8000, t, seed = 42 } = {}) {
    const tasks = toTaskDAG(R, { t });
    if (!tasks.length) return { error: 'no work items found in this reality' };
    const world = { tasks, deadline, seed };

    const nodes = tasks.map(x => x.id);
    const edges = tasks.flatMap(x => x.deps.map(d => ({ from: d, to: x.id })));

    // graph layer
    const cycles = G.findCycles(nodes, edges);
    const cp = G.criticalPath(tasks.map(x => ({ id: x.id, duration: x.mode, deps: x.deps })));
    const central = G.betweenness(nodes, edges).slice(0, 3);

    // prediction / simulation layer
    const forecast = D.simulateWorld(world, samples);

    // decision layer (only if interventions supplied)
    const decision = interventions.length ? D.decide(world, interventions, { samples }) : null;

    return {
      tasks: tasks.length,
      cycles,
      criticalChain: cp.error ? [] : cp.chain.map(id => (tasks.find(x => x.id === id) || {}).name || id),
      bottlenecks: central.map(c => ({ name: (tasks.find(x => x.id === c.id) || {}).name || c.id, centrality: c.score })),
      forecast: { p50Days: forecast.p50, p90Days: forecast.p90, pOnTime: forecast.pOnTime, deadline },
      decision,
      layers: ['event log', 'knowledge graph', 'causal reasoning', 'optimization', 'prediction', 'simulation', 'decision'],
    };
  }

  /* ---- optimal assignment of work to people, straight from the graph ---- */
  function optimalAssignment(R, { people, costFn, t } = {}) {
    const tasks = toTaskDAG(R, { t }).filter(x => x.status !== 'done');
    if (!tasks.length || !people || !people.length) return null;
    const cost = tasks.map(task => people.map(p => costFn(task, p)));
    const r = O.assign(cost);
    return { method: r.method, total: r.total, plan: r.assign.map((j, i) => ({ task: tasks[i].name, person: people[j] })) };
  }

  const API = { reason, toTaskDAG, optimalAssignment, graph: G, probability: P, causal: C, information: I, optimize: O, decide: D };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityReason = API;
})(typeof window !== 'undefined' ? window : this);
