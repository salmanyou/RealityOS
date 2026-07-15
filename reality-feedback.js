/* =====================================================================
   RealityOS — The Evidence Loop (reality-feedback.js)
   Closes:  Prediction → Customer Action → Outcome → Learning.
   - recordPrediction(): snapshot a prediction as an event (persistent, replayable)
   - scorePredictions(): when the outcome is known, score it (correct? Brier error)
   - accuracy(): rolling hit-rate, Brier, calibration, accuracy-over-time
   - learn(): derive a calibration correction from past outcomes (real improvement)
   This is what lets you say "Week 1: 73% → Week 10: 91%" — and earn trust.
   Pure; browser + Node. Predictions & scores ARE events, so they live in reality.
   ===================================================================== */
(function (root) {
  const DAY = 86400000;
  const uid = (p = '') => p + Math.random().toString(36).slice(2, 9);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  /* snapshot the current prediction for a goal and record it as an event */
  function recordPrediction(R, goalId, at = Date.now()) {
    const p = R.predict(goalId, at); if (!p) return null;
    const snap = R.materialize(at); const g = snap.objects.get(goalId);
    const id = 'pred:' + uid();
    const rec = { predId: id, goalId, probability: p.probability, predictedOnTime: p.probability >= 0.5, deadline: g && g.deadline || null, drivers: p.drivers, madeAt: at };
    R.emit('prediction.made', id, rec, at, 'realityos');
    return rec;
  }

  /* determine the real outcome of a goal, if known by time `t` */
  function outcomeOf(R, goalId, deadline, t = Date.now()) {
    const snap = R.materialize(t); const g = snap.objects.get(goalId); if (!g) return null;
    if (g.status === 'done') return { resolved: true, onTime: deadline ? (g.doneAt || t) <= deadline : true, at: g.doneAt || t };
    if (deadline && t > deadline) return { resolved: true, onTime: false, at: deadline };       // deadline passed, not done = missed
    return { resolved: false };
  }

  /* score every recorded prediction whose outcome is now known */
  function scorePredictions(R, t = Date.now()) {
    const snap = R.materialize(t);
    const made = R.events.filter(e => e.type === 'prediction.made');
    const scored = new Set(R.events.filter(e => e.type === 'prediction.scored').map(e => e.subject));
    const results = [];
    for (const e of made) {
      const rec = e.payload; if (scored.has(rec.predId)) continue;
      const out = outcomeOf(R, rec.goalId, rec.deadline, t); if (!out || !out.resolved) continue;
      const actual = out.onTime ? 1 : 0;
      const brier = Math.pow(rec.probability - actual, 2);                 // 0 = perfect, 1 = worst
      const correct = rec.predictedOnTime === out.onTime;
      R.emit('prediction.scored', rec.predId, { goalId: rec.goalId, probability: rec.probability, actual, correct, brier, madeAt: rec.madeAt, resolvedAt: out.at }, t, 'realityos');
      results.push({ predId: rec.predId, correct, brier, probability: rec.probability, actual });
    }
    return results;
  }

  /* rolling accuracy + calibration + accuracy-over-time (weekly buckets) */
  function accuracy(R, t = Date.now()) {
    const sc = R.events.filter(e => e.type === 'prediction.scored').map(e => e.payload);
    if (!sc.length) return { n: 0, hitRate: null, brier: null, note: 'no resolved predictions yet' };
    const n = sc.length, hits = sc.filter(s => s.correct).length;
    const brier = sc.reduce((a, s) => a + s.brier, 0) / n;
    // calibration: among predictions ~p, what fraction actually happened?
    const bins = {}; sc.forEach(s => { const b = Math.round(s.probability * 4) / 4; (bins[b] = bins[b] || []).push(s.actual); });
    const calibration = Object.entries(bins).map(([p, arr]) => ({ predicted: +p, observed: +(arr.reduce((a, x) => a + x, 0) / arr.length).toFixed(2), n: arr.length }));
    // accuracy over time: bucket by ISO week of madeAt
    const weeks = {}; sc.forEach(s => { const wk = Math.floor(s.madeAt / (7 * DAY)); (weeks[wk] = weeks[wk] || []).push(s.correct ? 1 : 0); });
    const overTime = Object.keys(weeks).sort().map((wk, i) => ({ week: i + 1, accuracy: +(weeks[wk].reduce((a, x) => a + x, 0) / weeks[wk].length).toFixed(2), n: weeks[wk].length }));
    return { n, hitRate: +(hits / n).toFixed(2), brier: +brier.toFixed(3), calibration, overTime };
  }

  /* learn a calibration correction from scored history: if the model is mis-calibrated,
     shrink predictions toward the observed base rate. Returns a corrected predictor + the Brier improvement. */
  function learn(R, t = Date.now()) {
    const sc = R.events.filter(e => e.type === 'prediction.scored').map(e => e.payload);
    if (sc.length < 4) return { ready: false, note: 'need more outcomes to learn' };
    const baseRate = sc.reduce((a, s) => a + s.actual, 0) / sc.length;
    // fit a single shrinkage factor k that minimizes Brier on history: p' = p*k + baseRate*(1-k)
    let bestK = 1, best = Infinity;
    for (let k = 0; k <= 1.0001; k += 0.05) { const b = sc.reduce((a, s) => a + Math.pow((s.probability * k + baseRate * (1 - k)) - s.actual, 2), 0) / sc.length; if (b < best) { best = b; bestK = k; } }
    const before = sc.reduce((a, s) => a + s.brier, 0) / sc.length;
    const calibrate = (p) => clamp(p * bestK + baseRate * (1 - bestK), 0.02, 0.98);
    return { ready: true, baseRate: +baseRate.toFixed(2), shrinkage: +bestK.toFixed(2), brierBefore: +before.toFixed(3), brierAfter: +best.toFixed(3), improvement: +(before - best).toFixed(3), calibrate };
  }

  const API = { recordPrediction, scorePredictions, accuracy, learn, outcomeOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityFeedback = API;
})(typeof window !== 'undefined' ? window : this);
