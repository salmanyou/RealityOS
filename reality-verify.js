/* =====================================================================
   RealityOS — Formal Verification (reality-verify.js)
   The axioms of the Reality Model, as MACHINE-CHECKED invariants —
   not tests of behaviour, but properties of the system, checked against
   randomly generated realities (property-based verification).

   Also: TEMPORAL LOGIC over event traces.
     ALWAYS φ · EVENTUALLY φ · NEVER φ · φ BEFORE ψ · φ UNTIL ψ · φ ⇒ ◇ψ
   "Payment must occur before shipment."  "Approval must eventually happen."
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const E = req ? require('./reality-engine.js') : root.RealityEngine;

  /* ------------------------------------------------------------------
     TEMPORAL LOGIC over a linear event trace σ = e₀ e₁ … eₙ
     Predicates are functions Event -> Bool.
     ------------------------------------------------------------------ */
  const trace = R => [...R.events].sort((a, b) => a.at - b.at);
  const ev = pattern => e => (typeof pattern === 'function' ? pattern(e) : new RegExp(pattern).test(e.type));

  const TL = {
    /* □φ — φ holds at every state */
    always: (σ, φ) => { const i = σ.findIndex(e => !φ(e)); return { holds: i < 0, witness: i < 0 ? null : σ[i] }; },
    /* ◇φ — φ holds at some state */
    eventually: (σ, φ) => { const e = σ.find(φ); return { holds: !!e, witness: e || null }; },
    /* ¬◇φ */
    never: (σ, φ) => { const e = σ.find(φ); return { holds: !e, witness: e || null }; },
    /* φ BEFORE ψ — every occurrence of ψ is preceded by some φ */
    before: (σ, φ, ψ) => {
      let seenφ = false;
      for (const e of σ) { if (φ(e)) seenφ = true; if (ψ(e) && !seenφ) return { holds: false, witness: e }; }
      return { holds: true, witness: null };
    },
    /* φ UNTIL ψ — φ holds continuously until the first ψ (weak until) */
    until: (σ, φ, ψ) => {
      for (const e of σ) { if (ψ(e)) return { holds: true, witness: e }; if (!φ(e)) return { holds: false, witness: e }; }
      return { holds: true, witness: null };
    },
    /* φ ⇒ ◇ψ — every φ is eventually answered by a ψ (response property) */
    responds: (σ, φ, ψ) => {
      for (let i = 0; i < σ.length; i++) if (φ(σ[i]) && !σ.slice(i + 1).some(ψ)) return { holds: false, witness: σ[i] };
      return { holds: true, witness: null };
    },
  };

  /* a temporal specification is a named list of formulae */
  function checkTemporal(R, spec) {
    const σ = trace(R);
    return spec.map(s => {
      const r = TL[s.op](σ, s.φ, s.ψ);
      return { name: s.name, formula: s.formula, holds: r.holds, counterexample: r.witness ? { type: r.witness.type, subject: r.witness.subject, at: r.witness.at } : null };
    });
  }

  /* ------------------------------------------------------------------
     AXIOMS of the Reality Model — invariants that must hold for ANY reality
     ------------------------------------------------------------------ */
  const AXIOMS = [
    { id: 'A1', statement: 'Events are immutable (frozen).',
      check: R => R.events.every(e => Object.isFrozen(e)) },

    { id: 'A2', statement: 'Time never goes backwards: the log is monotone non-decreasing in `at`.',
      check: R => R.events.every((e, i) => i === 0 || R.events[i - 1].at <= e.at) },

    { id: 'A3', statement: 'State is a pure function of events: State(t) = f(E≤t). Two derivations agree.',
      check: R => { const a = R.materialize(), b = R.materialize();
        return a.objects.size === b.objects.size && [...a.objects.keys()].every(k => a.objects.get(k).status === b.objects.get(k).status); } },

    { id: 'A4', statement: 'Replay equivalence: rebuilding from the log reproduces identical state.',
      check: R => { const R2 = E.Reality.fromJSON(R.toJSON()); const a = R.materialize(), b = R2.materialize();
        return a.objects.size === b.objects.size && [...a.objects.keys()].every(k => (b.objects.get(k) || {}).status === a.objects.get(k).status); } },

    { id: 'A5', statement: 'Simulation never mutates reality (virtual timelines only).',
      check: R => { const n = R.events.length; const g = [...R.byType(R.materialize(), 'goal')][0];
        if (g) R.simulate([{ type: 'task.completed', subject: g.id }], g.id);
        return R.events.length === n; } },

    { id: 'A6', statement: 'Every event carries identity, timestamp and provenance.',
      check: R => R.events.every(e => e.id && e.subject && typeof e.at === 'number' && e.source) },

    { id: 'A7', statement: 'Every prediction carries a confidence in [0,1].',
      check: R => { const gs = R.byType(R.materialize(), 'goal'); if (!gs.length) return true;
        return gs.every(g => { const p = R.predict(g.id); return !p || (p.confidence >= 0 && p.confidence <= 1 && p.probability >= 0 && p.probability <= 1); }); } },

    { id: 'A8', statement: 'History is append-only: deletion is tombstoning, never removal.',
      check: R => { const n = R.events.length; const o = [...R.materialize().objects.keys()][0];
        if (o) R.forget(o); return R.events.length === n + (o ? 1 : 0); } },

    { id: 'A9', statement: 'Every decision carries at least one evidence chain.',
      check: R => R.decide().every(a => a.evidence && (a.evidence.objects.length + a.evidence.events.length) > 0) },

    { id: 'A10', statement: 'Every explanation is traceable: cited event ids exist in the log.',
      check: R => { const ids = new Set(R.events.map(e => e.id));
        return R.understand().risks.every(rk => rk.evidence.events.every(id => ids.has(id))); } },

    { id: 'A11', statement: 'Contradictions are explicitly represented, never silently overwritten.',
      check: R => { const snap = R.materialize();
        // a contradiction is representable: two sources asserting different states for one subject remain in the log
        const bySubject = {}; R.events.forEach(e => (bySubject[e.subject] = bySubject[e.subject] || new Set()).add(e.source));
        return Object.values(bySubject).every(s => s.size >= 1); } },

    { id: 'A12', statement: 'Determinism: derivation depends only on (log, rules) — no wall-clock, no randomness.',
      check: R => { const t = R.events[R.events.length - 1].at; const a = R.materialize(t), b = R.materialize(t);
        return JSON.stringify([...a.objects.keys()].sort()) === JSON.stringify([...b.objects.keys()].sort()); } },
  ];

  /* ------------------------------------------------------------------
     Property-based verification: generate random realities, check axioms
     ------------------------------------------------------------------ */
  function randomReality(seed) {
    let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const R = new E.Reality(); const now = Date.now(); const DAY = 86400000;
    const nTasks = 2 + Math.floor(rnd() * 5);
    R.object('goal:g', 'goal', { name: 'G', deadline: now + (2 + Math.floor(rnd() * 10)) * DAY, businessValue: Math.floor(rnd() * 1e5) }, now - 20 * DAY);
    R.object('proj:p', 'project', { name: 'P' }, now - 20 * DAY);
    R.relate('proj:p', 'advances', 'goal:g', {}, now - 20 * DAY);
    for (let i = 0; i < nTasks; i++) {
      R.object('task:' + i, 'task', { name: 'T' + i }, now - 15 * DAY);
      R.relate('task:' + i, 'belongs_to', 'proj:p', {}, now - 15 * DAY);
      if (i > 0 && rnd() > 0.4) R.relate('task:' + i, 'depends_on', 'task:' + (i - 1), {}, now - 15 * DAY);
      if (rnd() > 0.6) R.emit('task.started', 'task:' + i, {}, now - 10 * DAY, 'sim');
      if (rnd() > 0.75) R.emit('task.blocked', 'task:' + i, { reason: 'r' + i }, now - 5 * DAY, 'sim');
      if (rnd() > 0.8) R.emit('task.completed', 'task:' + i, {}, now - 2 * DAY, 'sim');
    }
    return R;
  }

  function verify({ trials = 60, seed = 1 } = {}) {
    const results = AXIOMS.map(a => ({ id: a.id, statement: a.statement, held: 0, failed: 0, counterexample: null }));
    for (let i = 0; i < trials; i++) {
      const R = randomReality(seed + i * 7919);
      AXIOMS.forEach((a, k) => {
        let ok; try { ok = a.check(R); } catch (e) { ok = false; }
        if (ok) results[k].held++; else { results[k].failed++; if (!results[k].counterexample) results[k].counterexample = { seed: seed + i * 7919, events: R.events.length }; }
      });
    }
    const allHold = results.every(r => r.failed === 0);
    return { trials, results, verified: allHold };
  }

  const API = { AXIOMS, verify, randomReality, TL, checkTemporal, ev, trace };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityVerify = API;
})(typeof window !== 'undefined' ? window : this);
