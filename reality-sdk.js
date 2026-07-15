/* =====================================================================
   Reality SDK — developers program reality with verbs, not CRUD.
   Wraps a Reality instance; every read returns { data, evidence?, confidence? }.
   Also defines the Adapter contract: a pure translator
   (payload, eventType) -> ops[], applied uniformly by applyOps.
   ===================================================================== */
(function (root) {
  const Engine = (typeof require !== 'undefined') ? require('./reality-engine.js') : root.RealityEngine;
  const QL = (typeof require !== 'undefined') ? require('./realityql.js') : root.RealityQL;

  /* generic op applier — every adapter funnels through this */
  function applyOps(R, ops) {
    const snap = R.materialize();
    for (const op of ops) {
      if (op.kind === 'object') {
        if (!snap.objects.has(op.id)) { R.object(op.id, op.type, op.props || {}, op.at); snap.objects.set(op.id, { id: op.id, type: op.type, ...(op.props || {}) }); }
      } else if (op.kind === 'rel') {
        if (!snap.rels.some(r => r.from === op.from && r.rtype === op.rtype && r.to === op.to)) { R.relate(op.from, op.rtype, op.to, {}, op.at); snap.rels.push({ from: op.from, rtype: op.rtype, to: op.to, active: true }); }
      } else if (op.kind === 'event') {
        R.emit(op.type, op.subject, op.payload || {}, op.at, op.source || 'adapter');
      }
    }
  }

  class RealitySDK {
    constructor(reality) { this.R = reality || new Engine.Reality(); RealitySDK._adapters = RealitySDK._adapters || {}; }

    /* ---- ingestion (the only write primitive) ---- */
    ingest(ev) { return this.R.emit(ev.type, ev.subject, ev.payload || {}, ev.at || Date.now(), ev.source || 'sdk'); }
    object(id, type, props, at) { return this.R.object(id, type, props, at); }
    relate(from, rtype, to, at) { return this.R.relate(from, rtype, to, {}, at); }

    /* ---- verbs (each returns data + evidence + confidence where applicable) ---- */
    observe(sel, t) { const snap = this.R.materialize(t); let l = [...snap.objects.values()]; if (sel && sel !== '*') l = l.filter(o => o.type === sel || (o.name || '').toLowerCase().includes(String(sel).toLowerCase())); return { data: l.map(o => ({ id: o.id, type: o.type, name: o.name, status: o.status })) }; }
    understand(t) { return { data: this.R.understand(t) }; }
    explain(id, t) { const c = this.R.context(id, t); return { data: c, evidence: c && c.contextObject.evidence, confidence: c && c.confidence }; }
    why(id, t) { return this.explain(id, t); }
    cause(id, t) { const c = this.R.causalChain(id, t); return { data: c, evidence: c && c.evidence, confidence: c && c.confidence }; }
    predict(id, t) { const p = this.R.predict(id, t); return { data: p, evidence: p && p.evidence, confidence: p && p.confidence }; }
    simulate(hypos, focus) { return { data: this.R.simulate(hypos, focus) }; }
    decide(t) { return { data: this.R.decide(t) }; }
    coordinate(id, t) { return { data: this.R.coordinate(id, t) }; }
    attention(n, t) { return { data: this.R.attention(n, t) }; }
    economics(t) { const e = this.R.economics(t); return { data: e, confidence: e.confidence }; }
    memory(t) { return { data: this.R.memory(t) }; }
    goals(t) { return { data: this.R.goalGraph(t) }; }
    remember(sig, sit, res) { return this.R.remember(sig, sit, res); }
    recall(sig) { return this.R.recall(sig); }

    /* ---- run RealityQL ---- */
    ql(query) { if (this.R.isA === undefined) this.R.isA = Engine.isA; return QL.execute(this.R, query); }

    /* ---- plugin / adapter contract ---- */
    static registerAdapter(name, translate) { RealitySDK._adapters = RealitySDK._adapters || {}; RealitySDK._adapters[name] = translate; }
    ingestFrom(adapterName, eventType, payload) {
      const translate = RealitySDK._adapters[adapterName];
      if (!translate) throw new Error('no adapter: ' + adapterName);
      const ops = translate(eventType, payload); applyOps(this.R, ops); return ops.length;
    }

    /* persistence passthrough */
    toJSON() { return this.R.toJSON(); }
    static load(json) { return new RealitySDK(Engine.Reality.fromJSON(json)); }
  }

  const API = { RealitySDK, applyOps };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealitySDK = RealitySDK;
})(typeof window !== 'undefined' ? window : this);
