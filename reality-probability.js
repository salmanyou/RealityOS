/* =====================================================================
   RealityOS — Probability Layer (reality-probability.js)
   Reality is probabilistic. Nothing is asserted; everything is distributed.
     Distributions (normal, lognormal, triangular, PERT/beta) ·
     Monte Carlo (project completion distributions, P(miss)) ·
     Bayesian updating (evidence changes belief) ·
     Kalman filter (estimate true velocity from noisy signals) ·
     Uncertainty propagation · Calibration (Brier)
   Deterministic when seeded — simulations are reproducible.
   ===================================================================== */
(function (root) {
  /* seeded RNG (mulberry32) so every simulation is reproducible */
  function rng(seed = 42) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const normal = (r, mu = 0, sd = 1) => { const u = Math.max(1e-12, r()), v = r(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const lognormal = (r, mu = 0, sd = 1) => Math.exp(normal(r, mu, sd));
  const triangular = (r, lo, mode, hi) => { const u = r(), c = (mode - lo) / (hi - lo); return u < c ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode)); };
  /* PERT (three-point estimate) — the standard for task duration under uncertainty */
  const pert = (r, lo, mode, hi, lambda = 4) => triangular(r, lo, (lo + lambda * mode + hi) / (lambda + 2), hi);

  /* percentile of a sorted-able sample */
  function pct(samples, p) { const s = [...samples].sort((a, b) => a - b); const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1)))); return s[i]; }

  /* ---------- Monte Carlo: run a stochastic model N times ---------- */
  function monteCarlo(model, n = 10000, seed = 42) {
    const r = rng(seed); const samples = [];
    for (let i = 0; i < n; i++) samples.push(model(r));
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return { n, mean: +mean.toFixed(3), sd: +sd.toFixed(3), p10: +pct(samples, 10).toFixed(2), p50: +pct(samples, 50).toFixed(2), p90: +pct(samples, 90).toFixed(2), samples };
  }
  /* probability that a sampled outcome satisfies a predicate */
  function probability(model, predicate, n = 10000, seed = 42) { const r = rng(seed); let hit = 0; for (let i = 0; i < n; i++) if (predicate(model(r))) hit++; return +(hit / n).toFixed(4); }

  /* ---------- Bayesian updating: evidence changes belief ---------- */
  /* P(H|E) = P(E|H)P(H) / [P(E|H)P(H) + P(E|¬H)P(¬H)] */
  function bayes(prior, pEgivenH, pEgivenNotH) {
    const num = pEgivenH * prior, den = num + pEgivenNotH * (1 - prior);
    return den === 0 ? prior : +(num / den).toFixed(4);
  }
  /* sequential updating over a list of evidence items */
  function bayesChain(prior, evidence) { let p = prior; const trace = [{ step: 'prior', belief: p }]; for (const e of evidence) { p = bayes(p, e.pIfTrue, e.pIfFalse); trace.push({ step: e.name, belief: p }); } return { posterior: p, trace }; }

  /* ---------- Kalman filter (1-D): true velocity from noisy observations ---------- */
  function kalman1D(observations, { q = 0.01, r = 0.5, x0 = 0, p0 = 1 } = {}) {
    let x = x0, p = p0; const out = [];
    for (const z of observations) {
      p = p + q;                      // predict
      const k = p / (p + r);          // Kalman gain
      x = x + k * (z - x);            // update with observation
      p = (1 - k) * p;
      out.push(+x.toFixed(4));
    }
    return { estimate: +x.toFixed(4), variance: +p.toFixed(4), series: out };
  }

  /* ---------- Uncertainty propagation: f of uncertain inputs ---------- */
  function propagate(f, inputs, n = 10000, seed = 42) {
    return monteCarlo((r) => f(Object.fromEntries(Object.entries(inputs).map(([k, d]) => [k, d(r)]))), n, seed);
  }

  /* ---------- calibration ---------- */
  const brier = (p, actual) => +((p - actual) ** 2).toFixed(4);

  const API = { rng, normal, lognormal, triangular, pert, pct, monteCarlo, probability, bayes, bayesChain, kalman1D, propagate, brier };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityProbability = API;
})(typeof window !== 'undefined' ? window : this);
