/* =====================================================================
   RealityOS — Reality Kernel (reality-kernel.js)
   The precise execution core. Defines the kernel calls an independent
   implementer must provide, and runs the canonical pipeline:
     validate → store → derive → constraints → inference →
     contradictions → resolve(by source reliability) → attention →
     predictions → publish(subscribers)
   Adds: bitemporal time, timeline fork/merge, versioning, REF/ROF export.
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const Engine = req ? require('./reality-engine.js') : root.RealityEngine;
  const Types = req ? require('./reality-types.js') : root.RealityTypes;
  const Infer = req ? require('./reality-inference.js') : root.RealityInference;
  const Feedback = req ? require('./reality-feedback.js') : root.RealityFeedback;
  const now = () => Date.now();

  /* Source reliability: which truth to believe when sources disagree (RFC-0030) */
  const DEFAULT_RELIABILITY = { def: 1.0, sensor: 0.95, github: 0.9, erp: 0.85, manual: 0.8, ai: 0.74, inference: 0.7, email: 0.65, slack: 0.6, simulation: 0.0 };
  const RID_RE = /^rid:[a-z_]+:[a-z0-9-]+$/i;

  class Kernel {
    constructor(reality) { this.R = reality || new Engine.Reality(); this.subscribers = []; this.reliability = Object.assign({}, DEFAULT_RELIABILITY); this.versions = []; }

    /* ---- source reliability ---- */
    setSourceReliability(name, score) { this.reliability[name] = score; return this; }
    reliabilityOf(source) { return this.reliability[source] != null ? this.reliability[source] : 0.5; }

    /* ============ KERNEL CALL: Observe() ============ */
    observe(principal, t) { return principal ? this.R.view(principal, t) : this.R.materialize(t); }

    /* ---- convenience delegators (the friendly front door) ---- */
    understand(t) { return this.R.understand(t); }
    predict(goalId, t) { return this.R.predict(goalId, t); }
    simulate(hypos, focus) { return this.R.simulate(hypos, focus); }
    decide(t) { return this.R.decide(t); }
    attention(n, t) { return this.R.attention(n, t); }
    economics(t) { return this.R.economics(t); }
    causalChain(goalId, t) { return this.R.causalChain(goalId, t); }
    infer(t) { return Infer.infer(this.R, t); }
    /* ---- Evidence Loop (RFC-0039): prediction → outcome → learning ---- */
    recordPrediction(goalId, at) { return Feedback.recordPrediction(this.R, goalId, at); }
    scorePredictions(t) { return Feedback.scorePredictions(this.R, t); }
    accuracy(t) { return Feedback.accuracy(this.R, t); }
    learn(t) { return Feedback.learn(this.R, t); }
    ql(query) { this.R.isA = Engine.isA; return (req ? require('./realityql.js') : root.RealityQL).execute(this.R, query); }

    /* ============ KERNEL CALL: DeriveState() / Replay() ============ */
    deriveState(t) { return this.R.materialize(t); }
    replay(t) { return this.R.materialize(t); }

    /* ============ KERNEL CALL: Record() — the canonical pipeline ============ */
    record(ev) {
      const trace = { ok: true, stage: null };
      // bitemporal stamps (RFC-0028): event/valid/observed/processed
      const eventTime = ev.at || now();
      const _t = { event: eventTime, valid: ev.validAt || eventTime, observed: ev.observedAt || now(), processed: now() };

      // 1) VALIDATE — lifecycle transition legality (best-effort, non-fatal -> warn)
      trace.stage = 'validate'; trace.validation = this._validateTransition(ev);

      // 2) STORE
      trace.stage = 'store';
      const event = this.R.emit(ev.type, ev.subject, Object.assign({}, ev.payload, { _t }), eventTime, ev.source || 'manual');
      trace.event = { id: event.id, type: event.type, subject: event.subject, source: event.source, _t };

      // 3) DERIVE
      trace.stage = 'derive'; const snap = this.R.materialize();

      // 4) CONSTRAINTS (RFC-0026)
      trace.stage = 'constraints'; trace.violations = Types.checkConstraints(this.R);

      // 5) INFERENCE (RFC-0027)
      trace.stage = 'inference'; trace.inferred = Infer.infer(this.R).facts;

      // 6) CONTRADICTIONS (RFC-0029)
      trace.stage = 'contradictions'; trace.contradictions = this.detectContradictions();

      // 7) RESOLVE conflicts by source reliability (RFC-0030)
      trace.stage = 'resolve'; trace.resolutions = trace.contradictions.map(c => this.resolveConflict(c.claims));

      // 8) ATTENTION + 9) PREDICTIONS
      trace.stage = 'attention'; trace.attention = this.R.attention(5);
      trace.predictions = this.R.byType(snap, 'goal').filter(g => g.status !== 'done').map(g => ({ goal: g.id, name: g.name, probability: this.R.predict(g.id).probability }));

      // 10) PUBLISH
      trace.stage = 'publish'; this.subscribers.forEach(fn => { try { fn(trace); } catch (e) { } });
      trace.stage = 'done';
      return trace;
    }
    _validateTransition(ev) {
      const m = /^([a-z_]+)\.([a-z_]+)$/.exec(ev.type); if (!m) return { ok: true };
      const snap = this.R.materialize(); const o = snap.objects.get(ev.subject); if (!o) return { ok: true };
      const to = Types.statusToLifecycle(o.type, (Engine.normalizeType, this._statusFor(ev.type)));
      const from = Types.statusToLifecycle(o.type, o.status);
      if (to == null) return { ok: true };
      const ok = Types.validTransition(o.type, from, to);
      return { ok, from, to, message: ok ? null : `illegal lifecycle transition for ${o.type}: ${from} → ${to}` };
    }
    _statusFor(type) { if (/\.blocked$/.test(type)) return 'blocked'; if (/\.(completed|done|merged|paid)$/.test(type)) return 'done'; if (/\.(started|opened)$/.test(type)) return 'active'; if (/\.unblocked$/.test(type)) return 'active'; return null; }

    /* ============ KERNEL CALL: ResolveConflict(claims) ============ */
    resolveConflict(claims) {
      // claims: [{ source, value, eventId }]
      let best = null; for (const c of claims) { const w = this.reliabilityOf(c.source); if (!best || w > best.weight) best = { winner: c, weight: w }; }
      return best ? { chosen: best.winner.value, source: best.winner.source, weight: +best.weight.toFixed(2), among: claims.map(c => `${c.source}:${c.value}(${this.reliabilityOf(c.source)})`) } : null;
    }

    /* contradiction detection: same subject, conflicting status assertions from different sources */
    detectContradictions(t) {
      const snap = this.R.materialize(t); const out = [];
      for (const o of snap.objects.values()) {
        const asserts = (o._events || []).map(e => ({ source: e.source, value: this._statusFor(e.type), at: e.at, eventId: e.id })).filter(a => a.value);
        const bySource = {}; asserts.forEach(a => { bySource[a.source] = a; }); // latest per source (events sorted asc)
        const sources = Object.values(bySource); const values = new Set(sources.map(s => s.value));
        if (sources.length >= 2 && values.size >= 2) out.push({ subject: o.id, name: o.name || o.id, claims: sources.map(s => ({ source: s.source, value: s.value, eventId: s.eventId })) });
      }
      return out;
    }

    /* ============ KERNEL CALL: Verify() ============ */
    verify(t) { const violations = Types.checkConstraints(this.R, t); const contradictions = this.detectContradictions(t); return { consistent: violations.filter(v => v.severity === 'error').length === 0 && contradictions.length === 0, violations, contradictions }; }

    /* ============ KERNEL CALL: Explain(id) ============ */
    explain(id, t) { const ctx = this.R.context(id, t); const cause = this.R.causalChain(this.R.intentOf(id) ? this.R.intentOf(id).id : id, t); return { context: ctx, causal: cause, evidence: ctx && ctx.contextObject.evidence }; }

    /* ============ KERNEL CALLS: ForkTimeline() / MergeTimeline() ============ */
    forkTimeline() { const k = new Kernel(Engine.Reality.fromJSON(this.R.toJSON())); k.reliability = Object.assign({}, this.reliability); return k; }
    mergeTimeline(other, strategy) {
      const have = new Set(this.R.events.map(e => e.id)); let merged = 0;
      for (const e of other.R.events) if (!have.has(e.id)) { this.R.events.push(Object.freeze(Object.assign({}, e))); merged++; }
      this.R.events.sort((a, b) => a.at - b.at); return { merged, strategy: strategy || 'append-unique' };
    }

    /* ---- versioning (RFC-0031): a version is a point in the append-only log ---- */
    tagVersion(name) { const v = { name, at: now(), seq: this.R.events.length }; this.versions.push(v); return v; }
    versionState(name) { const v = this.versions.find(x => x.name === name); return v ? this.R.materialize(v.at) : null; }

    /* ---- subscribers ---- */
    subscribe(fn) { this.subscribers.push(fn); return () => { this.subscribers = this.subscribers.filter(f => f !== fn); }; }

    /* ---- standard formats (RFC-0034): REF / ROF / RID ---- */
    exportREF() { return { format: 'REF/1', events: this.R.events.map(e => ({ id: e.id, type: e.type, subject: e.subject, at: e.at, source: e.source, payload: e.payload })) }; }
    exportROF(t) { const snap = this.R.materialize(t); return { format: 'ROF/1', objects: [...snap.objects.values()].map(o => ({ id: o.id, type: o.type, status: o.status, name: o.name, props: o })), relationships: snap.rels.map(r => ({ from: r.from, rtype: r.rtype, to: r.to })) }; }
    static validRID(id) { return RID_RE.test(id); }

    /* ---- integrity (RFC-0036): tamper-evident hash chain over the event log ---- */
    _sha(s) { try { return require('crypto').createHash('sha256').update(s).digest('hex'); } catch (e) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return ('00000000' + h.toString(16)).slice(-8); } }
    _canon(e) { return JSON.stringify([e.type, e.subject, e.at, e.source, e.payload]); }
    sealChain() { let prev = 'genesis'; const seal = []; for (const e of this.R.events) { const h = this._sha(prev + '|' + this._canon(e)); seal.push({ id: e.id, hash: h }); prev = h; } return { head: prev, seal }; }
    verifyChain(sealed) {
      const fresh = this.sealChain(); if (!sealed) return { intact: true, head: fresh.head };
      for (let i = 0; i < fresh.seal.length; i++) { if (!sealed.seal[i] || sealed.seal[i].hash !== fresh.seal[i].hash) return { intact: false, brokenAt: i, id: fresh.seal[i].id }; }
      return { intact: fresh.head === sealed.head, head: fresh.head };
    }
    /* deterministic fingerprint of derived state — federation convergence check (RFC-0037) */
    stateHash(t) { const rof = this.exportROF(t); const norm = JSON.stringify({ o: rof.objects.map(o => [o.id, o.type, o.status]).sort(), r: rof.relationships.map(r => [r.from, r.rtype, r.to]).sort() }); return this._sha(norm); }

    /* ---- AI as a plugin, not the core (RFC-0038) ---- */
    static registerPlugin(kind, name, fn) { Kernel._plugins = Kernel._plugins || {}; (Kernel._plugins[kind] = Kernel._plugins[kind] || {})[name] = fn; }
    plugin(kind, name, input) { const fn = Kernel._plugins && Kernel._plugins[kind] && Kernel._plugins[kind][name]; if (!fn) throw new Error('no ' + kind + ' plugin: ' + name); return fn(this, input); }
  }

  const API = { Kernel, DEFAULT_RELIABILITY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityKernel = Kernel;
})(typeof window !== 'undefined' ? window : this);
