/* =====================================================================
   RealityOS — Reality Physics (reality-physics.js)
   Learns DOMAIN LAWS from observations, the way physics learns gravity:
     "If engineer overloaded, productivity drops non-linearly."
     "If meeting count increases, focus time decreases."
   A law is only ACCEPTED if it fits (R² above threshold) and beats the
   constant baseline. Rejected candidates are reported, not hidden.
   Fits: linear · exponential-decay · power law. Cross-checked by R².
   ===================================================================== */
(function (root) {
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  function r2(y, yhat) { const m = mean(y); const ssRes = y.reduce((a, v, i) => a + (v - yhat[i]) ** 2, 0); const ssTot = y.reduce((a, v) => a + (v - m) ** 2, 0); return ssTot === 0 ? 0 : +(1 - ssRes / ssTot).toFixed(4); }

  function fitLinear(xs, ys) {
    const n = xs.length, mx = mean(xs), my = mean(ys);
    const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
    const a0 = my - b * mx; const f = x => a0 + b * x;
    return { form: 'linear', f, params: { a: +a0.toFixed(4), b: +b.toFixed(4) }, expr: `y = ${a0.toFixed(3)} + ${b.toFixed(3)}·x`, r2: r2(ys, xs.map(f)) };
  }
  function fitExpDecay(xs, ys) {              // y = A·e^(-k x), fit on log y (requires y>0)
    if (ys.some(v => v <= 0)) return null;
    const ly = ys.map(Math.log); const lin = fitLinear(xs, ly);
    const A = Math.exp(lin.params.a), k = -lin.params.b; const f = x => A * Math.exp(-k * x);
    return { form: 'exponential_decay', f, params: { A: +A.toFixed(4), k: +k.toFixed(4) }, expr: `y = ${A.toFixed(3)}·e^(-${k.toFixed(3)}·x)`, r2: r2(ys, xs.map(f)) };
  }
  function fitPower(xs, ys) {                 // y = A·x^b  (x>0, y>0)
    if (xs.some(v => v <= 0) || ys.some(v => v <= 0)) return null;
    const lin = fitLinear(xs.map(Math.log), ys.map(Math.log));
    const A = Math.exp(lin.params.a), b = lin.params.b; const f = x => A * Math.pow(x, b);
    return { form: 'power_law', f, params: { A: +A.toFixed(4), b: +b.toFixed(4) }, expr: `y = ${A.toFixed(3)}·x^${b.toFixed(3)}`, r2: r2(ys, xs.map(f)) };
  }

  /* learn(name, observations[{x,y}], threshold) -> accepted law or explicit rejection */
  function learnLaw(name, obs, { threshold = 0.75 } = {}) {
    const xs = obs.map(o => o.x), ys = obs.map(o => o.y);
    if (obs.length < 4) return { law: name, accepted: false, reason: 'insufficient observations (<4)' };
    const cands = [fitLinear(xs, ys), fitExpDecay(xs, ys), fitPower(xs, ys)].filter(Boolean).sort((a, b) => b.r2 - a.r2);
    const best = cands[0];
    const nonlinear = best.form !== 'linear' && best.r2 - (cands.find(c => c.form === 'linear')?.r2 ?? 0) > 0.02;
    if (best.r2 < threshold) return { law: name, accepted: false, reason: `best fit R²=${best.r2} below threshold ${threshold}`, candidates: cands.map(c => ({ form: c.form, r2: c.r2 })) };
    return {
      law: name, accepted: true, form: best.form, expression: best.expr, r2: best.r2, nonlinear,
      predict: best.f, n: obs.length,
      candidates: cands.map(c => ({ form: c.form, r2: c.r2 })),
      statement: nonlinear ? `${name}: relationship is NON-LINEAR (${best.form}, R²=${best.r2}).` : `${name}: relationship is approximately linear (R²=${best.r2}).`,
    };
  }

  /* a learned law library that simulations can consult */
  class Physics {
    constructor() { this.laws = new Map(); }
    learn(name, obs, opts) { const l = learnLaw(name, obs, opts); if (l.accepted) this.laws.set(name, l); return l; }
    apply(name, x) { const l = this.laws.get(name); return l ? +l.predict(x).toFixed(4) : null; }
    list() { return [...this.laws.values()].map(l => ({ law: l.law, expression: l.expression, r2: l.r2, nonlinear: l.nonlinear })); }
  }

  const API = { learnLaw, Physics, fitLinear, fitExpDecay, fitPower, r2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityPhysics = API;
})(typeof window !== 'undefined' ? window : this);
