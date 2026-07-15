/* =====================================================================
   RealityOS — Causal Discovery (reality-discover.js)
   PC-stable skeleton + v-structure orientation (Spirtes/Glymour; Colombo &
   Maathuis "stable" variant). Conditional independence by partial
   correlation + Fisher-z test.
   ⚠ Output is a set of PROPOSED causal structures REQUIRING REVIEW.
     Discovery is sound only under: causal sufficiency (no unobserved
     confounders), faithfulness, i.i.d. sampling, and linear-Gaussian
     dependence. Those assumptions are returned with every result.
   ===================================================================== */
(function (root) {
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  function corr(x, y) {
    const mx = mean(x), my = mean(y);
    const num = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0);
    const dx = Math.sqrt(x.reduce((a, v) => a + (v - mx) ** 2, 0)), dy = Math.sqrt(y.reduce((a, v) => a + (v - my) ** 2, 0));
    return (dx === 0 || dy === 0) ? 0 : num / (dx * dy);
  }
  /* recursive partial correlation r(x,y | S) */
  function pcorr(data, x, y, S) {
    if (!S.length) return corr(data.map(r => r[x]), data.map(r => r[y]));
    const z = S[0], rest = S.slice(1);
    const rxy = pcorr(data, x, y, rest), rxz = pcorr(data, x, z, rest), ryz = pcorr(data, y, z, rest);
    const den = Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
    return den === 0 ? 0 : (rxy - rxz * ryz) / den;
  }
  /* Fisher-z independence test: returns true if x ⫫ y | S at level alpha */
  function independent(data, x, y, S, alpha = 0.05) {
    const n = data.length, r = Math.max(-0.999999, Math.min(0.999999, pcorr(data, x, y, S)));
    const z = 0.5 * Math.log((1 + r) / (1 - r)) * Math.sqrt(Math.max(1, n - S.length - 3));
    const crit = alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : 1.645;
    return { indep: Math.abs(z) < crit, z: +z.toFixed(2), r: +r.toFixed(3) };
  }

  const combos = (arr, k) => k === 0 ? [[]] : arr.flatMap((v, i) => combos(arr.slice(i + 1), k - 1).map(c => [v, ...c]));

  /* PC-stable: adjacencies frozen per depth (order-independent skeleton) */
  function discover(data, vars, { alpha = 0.05, maxDepth = 3 } = {}) {
    const adj = new Map(vars.map(v => [v, new Set(vars.filter(u => u !== v))]));
    const sepset = new Map();
    const key = (a, b) => [a, b].sort().join('|');
    const tests = [];

    for (let d = 0; d <= maxDepth; d++) {
      const frozen = new Map([...adj].map(([k, s]) => [k, new Set(s)]));   // ← the "stable" part
      for (const x of vars) for (const y of [...adj.get(x)]) {
        if (!adj.get(x).has(y)) continue;
        const candidates = [...frozen.get(x)].filter(v => v !== y);
        if (candidates.length < d) continue;
        for (const S of combos(candidates, d)) {
          const t = independent(data, x, y, S, alpha);
          tests.push({ x, y, S, ...t });
          if (t.indep) { adj.get(x).delete(y); adj.get(y).delete(x); sepset.set(key(x, y), S); break; }
        }
      }
    }
    // v-structures: x — z — y with x,y non-adjacent and z ∉ sepset(x,y) ⇒ x → z ← y
    const oriented = [];
    for (const z of vars) for (const [x, y] of combos([...adj.get(z)], 2)) {
      if (adj.get(x).has(y)) continue;
      const S = sepset.get(key(x, y));
      if (S && !S.includes(z)) oriented.push({ from: x, to: z }, { from: y, to: z });
    }
    const skeleton = [];
    vars.forEach(x => adj.get(x).forEach(y => { if (x < y) skeleton.push([x, y]); }));

    return {
      proposal: true, status: 'PROPOSED — requires domain review before use',
      skeleton, orientedEdges: oriented,
      independencies: tests.filter(t => t.indep).map(t => `${t.x} ⫫ ${t.y}${t.S.length ? ' | ' + t.S.join(',') : ''}`),
      testsRun: tests.length,
      assumptions: ['causal sufficiency (no unobserved confounders)', 'faithfulness', 'i.i.d. samples', 'linear-Gaussian dependence (partial correlation is a valid CI test)'],
      caveat: 'PC recovers a Markov equivalence class, not a unique DAG. Undirected edges remain ambiguous. Never adopt without domain review.',
    };
  }
  const API = { discover, independent, pcorr, corr };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityDiscover = API;
})(typeof window !== 'undefined' ? window : this);
