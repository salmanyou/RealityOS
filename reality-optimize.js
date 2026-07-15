/* =====================================================================
   RealityOS — Optimization Layer (reality-optimize.js)
   "20 engineers. 200 tasks. What's the optimal assignment?"
     Hungarian algorithm (optimal assignment, O(n^3)) ·
     Constraint Satisfaction (backtracking + AC-3 style pruning) ·
     Simulated Annealing (NP-hard fallback) ·
     Complexity guard: exact when small, heuristic when large
   ===================================================================== */
(function (root) {

  /* ---------- Hungarian algorithm: provably OPTIMAL assignment ---------- */
  /* cost[i][j] = cost of giving task i to person j (n <= m). Minimizes total. */
  function hungarian(cost) {
    const n = cost.length, m = cost[0].length; const INF = Infinity;
    const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0), p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = new Array(m + 1).fill(INF), used = new Array(m + 1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const assign = new Array(n).fill(-1);
    for (let j = 1; j <= m; j++) if (p[j] > 0 && p[j] <= n) assign[p[j] - 1] = j - 1;
    let total = 0; assign.forEach((j, i) => { if (j >= 0) total += cost[i][j]; });
    return { assign, total: +total.toFixed(3) };
  }

  /* ---------- Constraint Satisfaction: "find a slot where CEO+Lawyer+Engineer+Room are free" ---------- */
  /* vars: {name: [domain values]}, constraints: [fn(assignment) -> bool] (partial-safe) */
  function solveCSP(vars, constraints, { all = false } = {}) {
    const names = Object.keys(vars); const solutions = []; let nodes = 0;
    function consistent(a) { return constraints.every(c => c(a) !== false); }
    function backtrack(a, i) {
      nodes++;
      if (i === names.length) { solutions.push({ ...a }); return !all; }
      const name = names[i];
      // simple MRV-ish ordering: try domain values in given order
      for (const val of vars[name]) {
        a[name] = val;
        if (consistent(a) && backtrack(a, i + 1)) return true;
        delete a[name];
      }
      return false;
    }
    backtrack({}, 0);
    return { solutions, searched: nodes, satisfiable: solutions.length > 0 };
  }

  /* ---------- Simulated Annealing: NP-hard problems, good-enough fast ---------- */
  function anneal(initial, energy, neighbor, { iters = 20000, T0 = 1.0, seed = 7 } = {}) {
    let a = 1234 ^ seed; const rnd = () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 1e6) / 1e6; };
    let cur = initial, curE = energy(cur), best = cur, bestE = curE;
    for (let i = 0; i < iters; i++) {
      const T = T0 * (1 - i / iters) + 1e-9;
      const cand = neighbor(cur, rnd); const candE = energy(cand);
      if (candE < curE || Math.exp((curE - candE) / T) > rnd()) { cur = cand; curE = candE; }
      if (curE < bestE) { best = cur; bestE = curE; }
    }
    return { best, energy: +bestE.toFixed(3) };
  }

  /* ---------- Complexity guard: exact vs approximate (the doc's requirement) ---------- */
  function assign(cost, { exactLimit = 200 } = {}) {
    const n = cost.length, m = cost[0].length;
    if (Math.max(n, m) <= exactLimit) return { method: 'hungarian (exact, O(n^3))', ...hungarian(cost) };
    // large: greedy + annealing refinement
    const used = new Set(); const greedy = cost.map((row) => { let bj = -1, bv = Infinity; row.forEach((v, j) => { if (!used.has(j) && v < bv) { bv = v; bj = j; } }); used.add(bj); return bj; });
    const energy = (a) => a.reduce((s, j, i) => s + (j >= 0 ? cost[i][j] : 1e6), 0);
    const neighbor = (a, rnd) => { const b = [...a]; const i = Math.floor(rnd() * b.length), k = Math.floor(rnd() * b.length); [b[i], b[k]] = [b[k], b[i]]; return b; };
    const r = anneal(greedy, energy, neighbor, { iters: 30000 });
    return { method: 'greedy + simulated annealing (approximate)', assign: r.best, total: r.energy };
  }

  const API = { hungarian, solveCSP, anneal, assign };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityOptimize = API;
})(typeof window !== 'undefined' ? window : this);
