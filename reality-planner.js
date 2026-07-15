/* =====================================================================
   RealityOS — Autonomous Planner (reality-planner.js)
   Hierarchical Task Network planning (SHOP-style: Erol/Hendler/Nau; Nau et al. SHOP2).
   Not "recommend" — CONSTRUCT an executable plan.
     tasks    : compound (need decomposition) or primitive (executable)
     methods  : how to decompose a compound task, with preconditions
     operators: primitive actions with preconditions + effects on state
   Depth-first forward decomposition, state tracked in execution order,
   BACKTRACKING when a decomposition fails.
   Output: a plan → schedule (CPM) → budget → risk → monitoring points.
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const G = req ? require('./reality-graph.js') : root.RealityGraph;
  const P = req ? require('./reality-probability.js') : root.RealityProbability;

  const holds = (pre, state) => (pre || []).every(p => p.startsWith('!') ? !state.has(p.slice(1)) : state.has(p));

  /* domain = { methods: {compoundTask: [ {name, pre, subtasks} ]}, operators: {primitive: {pre, add, del, duration, cost, role}} } */
  function plan(domain, goalTask, initialState = [], depth = 0) {
    const state = new Set(initialState);
    const out = [];
    const ok = decompose(domain, [goalTask], state, out, 0);
    return ok ? { success: true, steps: out } : { success: false, steps: [], reason: 'no applicable decomposition' };
  }

  function decompose(domain, taskList, state, out, depth) {
    if (depth > 50) return false;
    if (!taskList.length) return true;
    const [task, ...rest] = taskList;

    // primitive?
    const op = domain.operators[task];
    if (op) {
      if (!holds(op.pre, state)) return false;
      const undoAdd = [], undoDel = [];
      (op.add || []).forEach(f => { if (!state.has(f)) { state.add(f); undoAdd.push(f); } });
      (op.del || []).forEach(f => { if (state.has(f)) { state.delete(f); undoDel.push(f); } });
      out.push({ action: task, duration: op.duration || 1, cost: op.cost || 0, role: op.role || 'team', lo: op.lo, mode: op.mode, hi: op.hi });
      if (decompose(domain, rest, state, out, depth + 1)) return true;
      out.pop(); undoAdd.forEach(f => state.delete(f)); undoDel.forEach(f => state.add(f));  // BACKTRACK
      return false;
    }

    // compound: try each applicable method in order
    const methods = domain.methods[task] || [];
    for (const m of methods) {
      if (!holds(m.pre, state)) continue;
      const snapshotLen = out.length; const snapshotState = new Set(state);
      if (decompose(domain, [...m.subtasks, ...rest], state, out, depth + 1)) return true;
      out.length = snapshotLen; state.clear(); snapshotState.forEach(f => state.add(f));   // BACKTRACK
    }
    return false;
  }

  /* turn a plan into an executable project: schedule, budget, risk, monitoring */
  function schedule(steps, { deadline, samples = 6000 } = {}) {
    // sequential dependencies by default; steps with the same role can't overlap
    const tasks = steps.map((s, i) => ({ id: 'step' + i, name: s.action, duration: s.duration, deps: i ? ['step' + (i - 1)] : [] }));
    const cp = G.criticalPath(tasks);
    const budget = steps.reduce((a, s) => a + (s.cost || 0), 0);
    // stochastic finish (PERT if provided, else ±40% around duration)
    const model = (r) => steps.reduce((a, s) => a + P.pert(r, s.lo ?? s.duration * 0.6, s.mode ?? s.duration, s.hi ?? s.duration * 1.8), 0);
    const mc = P.monteCarlo(model, samples, 42);
    const risk = deadline != null ? P.probability(model, d => d > deadline, samples, 42) : null;
    const byRole = {}; steps.forEach(s => (byRole[s.role] = byRole[s.role] || []).push(s.action));
    return {
      steps: steps.length, criticalChain: cp.chain.map(id => (tasks.find(t => t.id === id) || {}).name),
      deterministicEnd: cp.projectEnd, p50: mc.p50, p90: mc.p90,
      budget, riskOfMissing: risk, resources: byRole,
      monitoring: steps.filter(s => (s.cost || 0) > 0 || s.duration >= 3).map(s => `checkpoint after "${s.action}"`),
    };
  }

  const API = { plan, schedule };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityPlanner = API;
})(typeof window !== 'undefined' ? window : this);
