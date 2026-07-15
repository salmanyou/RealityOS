/* =====================================================================
   RealityOS — Causal Layer (reality-causal.js)
   Distinguishes CAUSE from CORRELATION. Pearl's ladder, implemented:
     Rung 1 Association  P(Y|X)          — what we see
     Rung 2 Intervention P(Y|do(X))      — what happens if we act
     Rung 3 Counterfactual              — what would have happened
   Includes: backdoor criterion + adjustment, do() by graph surgery,
   confounder detection, and root-cause ranking by counterfactual effect.
   ===================================================================== */
(function (root) {

  class CausalGraph {
    constructor(edges = []) { this.edges = edges.map(e => ({ from: e.from, to: e.to })); }
    nodes() { return [...new Set(this.edges.flatMap(e => [e.from, e.to]))]; }
    parents(x) { return this.edges.filter(e => e.to === x).map(e => e.from); }
    children(x) { return this.edges.filter(e => e.from === x).map(e => e.to); }
    /* do(X): graph surgery — sever all arrows INTO X (Rung 2) */
    do(x) { return new CausalGraph(this.edges.filter(e => e.to !== x)); }
    /* descendants of x (for backdoor: cannot condition on these) */
    descendants(x, seen = new Set()) { for (const c of this.children(x)) if (!seen.has(c)) { seen.add(c); this.descendants(c, seen); } return seen; }
    /* all directed+undirected paths X→Y for backdoor checks */
    _paths(x, y) {
      const undirected = new Map(); this.nodes().forEach(n => undirected.set(n, []));
      this.edges.forEach(e => { undirected.get(e.from).push({ n: e.to, dir: 'out' }); undirected.get(e.to).push({ n: e.from, dir: 'in' }); });
      const out = [];
      const walk = (cur, path) => {
        if (cur === y) { out.push([...path]); return; }
        for (const { n, dir } of undirected.get(cur) || []) {
          if (path.some(p => p.node === n)) continue;
          walk(n, [...path, { node: n, dir }]);
        }
      };
      walk(x, [{ node: x, dir: 'start' }]);
      return out;
    }
    /* backdoor paths: paths from X to Y that start with an arrow INTO X (confounded) */
    backdoorPaths(x, y) { return this._paths(x, y).filter(p => p[1] && p[1].dir === 'in'); }
    /* a valid adjustment set: blocks all backdoor paths, contains no descendant of X */
    backdoorSet(x, y) {
      const desc = this.descendants(x); const candidates = this.nodes().filter(n => n !== x && n !== y && !desc.has(n));
      const bd = this.backdoorPaths(x, y); if (!bd.length) return { set: [], sufficient: true, note: 'no backdoor paths — X is already unconfounded' };
      // greedy: pick the confounders that appear on backdoor paths (common causes)
      const onPaths = new Set(bd.flatMap(p => p.slice(1, -1).map(s => s.node)));
      const set = candidates.filter(c => onPaths.has(c));
      const blocked = bd.every(p => p.slice(1, -1).some(s => set.includes(s.node)));
      return { set, sufficient: blocked, backdoorPaths: bd.map(p => p.map(s => s.node).join(' — ')) };
    }
  }

  /* ---------- Backdoor adjustment on observational data (Rung 2 from Rung 1) ----------
     ATE = Σ_z [ E(Y | X=1, Z=z) − E(Y | X=0, Z=z) ] · P(Z=z)                        */
  function adjustedEffect(rows, x, y, adjustSet) {
    const key = r => adjustSet.map(z => r[z]).join('|');
    const strata = {}; rows.forEach(r => (strata[key(r)] = strata[key(r)] || []).push(r));
    let ate = 0, n = rows.length; const detail = [];
    for (const [z, group] of Object.entries(strata)) {
      const treated = group.filter(r => r[x] === 1), control = group.filter(r => r[x] === 0);
      if (!treated.length || !control.length) continue;                       // no overlap → skip stratum
      const eT = treated.reduce((a, r) => a + r[y], 0) / treated.length;
      const eC = control.reduce((a, r) => a + r[y], 0) / control.length;
      const w = group.length / n; ate += (eT - eC) * w;
      detail.push({ stratum: z, effect: +(eT - eC).toFixed(3), weight: +w.toFixed(3) });
    }
    return { ate: +ate.toFixed(4), detail };
  }
  /* naive (confounded) association for contrast */
  function naiveEffect(rows, x, y) {
    const t = rows.filter(r => r[x] === 1), c = rows.filter(r => r[x] === 0);
    if (!t.length || !c.length) return { assoc: NaN };
    return { assoc: +((t.reduce((a, r) => a + r[y], 0) / t.length) - (c.reduce((a, r) => a + r[y], 0) / c.length)).toFixed(4) };
  }

  /* ---------- Counterfactual (Rung 3): structural equations, abduction→action→prediction ---------- */
  /* sem: { node: (parents) => value } ; world: observed values                                    */
  function counterfactual(sem, order, world, intervention) {
    const factual = { ...world };
    const cf = { ...world, ...intervention };
    for (const node of order) {
      if (node in intervention) continue;                 // held fixed by do()
      if (sem[node]) cf[node] = sem[node](cf);            // recompute downstream
    }
    return { factual, counterfactual: cf, changed: Object.keys(cf).filter(k => cf[k] !== factual[k]) };
  }

  /* ---------- Root cause ranking: which fix removes the most delay? (counterfactual effect) ---------- */
  function rootCauses(candidates, evaluate, baseline) {
    return candidates.map(c => {
      const outcome = evaluate(c);                        // outcome if THIS cause were removed
      return { cause: c.name, outcomeIfFixed: +outcome.toFixed(2), delayRemoved: +(baseline - outcome).toFixed(2) };
    }).sort((a, b) => b.delayRemoved - a.delayRemoved);
  }

  const API = { CausalGraph, adjustedEffect, naiveEffect, counterfactual, rootCauses };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityCausal = API;
})(typeof window !== 'undefined' ? window : this);
