/* =====================================================================
   RealityOS — Reality Engine v2 (reference implementation)
   The universal substrate: Objects · Events · Relationships · Time.
   v2 adds the FOUNDATIONS: Ontology, Laws (enforced), Identity, Evidence,
   Confidence, Causality, Intent/Goal graph, Memory tiers, Attention,
   Economics, Permissions. Pure, dependency-free, browser + Node.
   Backward compatible with v1 (same public methods + return shapes).
   ===================================================================== */
(function (root) {
  const DAY = 86400000;
  const now = () => Date.now();
  const uid = (p = '') => p + Math.random().toString(36).slice(2, 10);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const daysBetween = (a, b) => Math.round((b - a) / DAY);

  /* ONTOLOGY — every object type belongs somewhere (open; unknown -> entity) */
  const ONTOLOGY = {
    entity: null,
    human: 'entity', person: 'human', ai_agent: 'entity', organization: 'entity',
    team: 'organization', customer: 'organization',
    machine: 'entity', robot: 'machine', sensor: 'machine', vehicle: 'machine',
    asset: 'entity', repo: 'asset', resource: 'entity', location: 'entity', building: 'location',
    document: 'entity', code: 'document', note: 'document', product: 'entity', service: 'entity',
    intent: 'entity', goal: 'intent', process: 'entity', project: 'process', task: 'process',
    meeting: 'process', invoice: 'document', event_note: 'note',
  };
  function ancestors(type) { const out = []; let t = ONTOLOGY[type] !== undefined ? type : 'entity'; while (t) { out.push(t); t = ONTOLOGY[t]; } return out; }
  function isA(type, anc) { return ancestors(type).includes(anc); }
  function normalizeType(type) { return ONTOLOGY[type] !== undefined ? type : 'entity'; }

  const REL_TYPES = {
    depends_on: { inverse: 'enables', cat: 'sequence' }, blocks: { inverse: 'blocked_by', cat: 'sequence' },
    blocked_by: { inverse: 'blocks', cat: 'sequence' }, advances: { inverse: 'advanced_by', cat: 'intent' },
    belongs_to: { inverse: 'contains', cat: 'structure' }, part_of: { inverse: 'has_part', cat: 'structure' },
    owns: { inverse: 'owned_by', cat: 'responsibility' }, committed_to: { inverse: 'commits', cat: 'intent' },
    implements: { inverse: 'implemented_by', cat: 'work' }, fixes: { inverse: 'fixed_by', cat: 'work' },
    causes: { inverse: 'caused_by', cat: 'causality' }, serves: { inverse: 'served_by', cat: 'intent' },
    located_at: { inverse: 'location_of', cat: 'space' }, contributes_to: { inverse: 'contributed_by', cat: 'work' },
    relates_to: { inverse: 'relates_to', cat: 'generic' },
  };
  const isCanonicalRel = (r) => Object.prototype.hasOwnProperty.call(REL_TYPES, r);

  const LAWS = [
    { id: 1, text: 'Reality only changes through Events.', enforced: true },
    { id: 2, text: 'Events are immutable and never disappear.', enforced: true },
    { id: 3, text: 'History cannot be edited (deletion is tombstoning).', enforced: true },
    { id: 4, text: 'State is always derived from Events.', enforced: true },
    { id: 5, text: 'Everything has identity (a RealityID).', enforced: true },
    { id: 6, text: 'Every Event has provenance (a source).', enforced: true },
    { id: 7, text: 'Every Prediction carries a confidence in [0,1].', enforced: true },
    { id: 8, text: 'Everything exists on a timeline (every Event has a timestamp).', enforced: true },
    { id: 9, text: 'Predictions never modify reality; Simulation creates virtual timelines.', enforced: true },
  ];

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  function mintId(type, hint) { return 'rid:' + normalizeType(type) + ':' + ((hint && slug(hint)) || uid()); }
  function evidence(claim, opts) { const o = opts || {}; return { claim, events: o.events || [], objects: o.objects || [], sources: o.sources || [] }; }

  function statusPatch(type, ev) {
    if (/\.blocked$/.test(type)) return { status: 'blocked', blockedAt: ev.at, blockReason: (ev.payload && ev.payload.reason) || null };
    if (/\.unblocked$/.test(type)) return { status: 'active', blockedAt: null, blockReason: null };
    if (/\.(completed|done|merged|paid|resolved|closed)$/.test(type)) return { status: 'done', doneAt: ev.at };
    if (/\.(started|opened|reopened)$/.test(type)) return { status: 'active' };
    if (/\.(cancelled|canceled)$/.test(type)) return { status: 'cancelled' };
    if (/\.tombstoned$/.test(type)) return { status: 'redacted', redacted: true };
    return null;
  }

  class Principal {
    constructor(id, opts) { const o = opts || {}; this.id = id; this._can = o.can || {}; this.scopeTypes = o.scopeTypes || '*'; this.scopeIds = o.scopeIds || '*'; }
    can(action) { return this._can === '*' || this._can[action] === true || this._can['*'] === true; }
    sees(obj) { if (this.scopeTypes !== '*' && !this.scopeTypes.includes(obj.type)) return false; if (this.scopeIds !== '*' && !this.scopeIds.includes(obj.id)) return false; return true; }
  }
  const ROOT = new Principal('root', { can: '*' });

  class Reality {
    constructor() { this.events = []; this.patterns = []; }

    emit(type, subject, payload = {}, at = now(), source = 'manual') {
      if (!type || !subject) throw new Error('LAW1/5: event needs a type and a subject (identity)');
      const ev = Object.freeze({ id: uid('ev_'), type, subject, payload, at, source: source || 'manual' });
      this.events.push(ev); this.events.sort((a, b) => a.at - b.at); return ev;
    }
    object(id, type, props = {}, at = now()) {
      if (!type) throw new Error('LAW5: object needs a type');
      if (!id) id = mintId(type, props.name);
      this.emit('object.created', id, Object.assign({ type: type, ontology: normalizeType(type) }, props), at, 'def');
      return id;
    }
    update(id, patch, at = now()) { return this.emit('object.updated', id, { patch }, at); }
    relate(from, rtype, to, props = {}, at = now()) {
      const rid = uid('rel_');
      this.emit('rel.created', from, Object.assign({ rid, from, rtype, to, canonical: isCanonicalRel(rtype) }, props), at);
      return rid;
    }
    unrelate(rid, at = now()) { return this.emit('rel.ended', rid, { rid }, at); }
    forget(id, at = now()) { return this.emit('object.tombstoned', id, {}, at, 'redaction'); }

    materialize(t = Infinity) {
      const objects = new Map(); const rels = [];
      for (const e of this.events) {
        if (e.at > t) continue;
        if (e.type === 'object.created') objects.set(e.subject, Object.assign({ id: e.subject, status: 'active' }, e.payload, { _events: [] }));
        else if (e.type === 'object.updated') { const o = objects.get(e.subject); if (o) Object.assign(o, e.payload.patch || {}); }
        else if (e.type === 'rel.created') rels.push({ id: e.payload.rid, from: e.payload.from, rtype: e.payload.rtype, to: e.payload.to, props: e.payload, active: true, since: e.at });
        else if (e.type === 'rel.ended') { const r = rels.find(r => r.id === e.payload.rid); if (r) { r.active = false; r.until = e.at; } }
        else { const o = objects.get(e.subject); if (o) { const p = statusPatch(e.type, e); if (p) Object.assign(o, p); } }
        const o = objects.get(e.subject); if (o) o._events.push(e);
      }
      return { objects, rels: rels.filter(r => r.active), t };
    }
    view(principal = ROOT, t = Infinity) {
      if (!principal.can('see')) return { objects: new Map(), rels: [], t };
      const snap = this.materialize(t);
      const objects = new Map([...snap.objects].filter(([, o]) => principal.sees(o)));
      const rels = snap.rels.filter(r => objects.has(r.from) && objects.has(r.to));
      return { objects, rels, t };
    }

    neighbors(snap, id, rtype = null, dir = 'out') {
      return snap.rels.filter(r => (dir === 'out' ? r.from === id : r.to === id) && (!rtype || r.rtype === rtype))
        .map(r => ({ rel: r, node: snap.objects.get(dir === 'out' ? r.to : r.from) })).filter(x => x.node);
    }
    byType(snap, type) { return [...snap.objects.values()].filter(o => o.type === type); }
    byKind(snap, ancestor) { return [...snap.objects.values()].filter(o => isA(o.type, ancestor)); }

    context(id, t = Infinity) {
      const snap = this.materialize(t); const o = snap.objects.get(id); if (!o) return null;
      const why = [], related = [], evEvents = [];
      if (o.status === 'blocked') {
        if (o.blockReason) why.push('Blocked: ' + o.blockReason + '.');
        o._events.filter(e => /\.blocked$/.test(e.type)).forEach(e => evEvents.push(e.id));
        this.neighbors(snap, id, 'depends_on', 'out').filter(n => n.node.status !== 'done').forEach(b => why.push('Waiting on ' + (b.node.name || b.node.id) + ' (' + b.node.status + ').'));
      }
      const dependents = this.neighbors(snap, id, 'depends_on', 'in');
      if (dependents.length) why.push(dependents.length + ' item(s) depend on this finishing.');
      const goal = this.intentOf(id, snap);
      if (goal && goal.deadline) why.push('Serves "' + goal.name + '" — ' + daysBetween(t === Infinity ? now() : t, goal.deadline) + ' day(s) to deadline.');
      this.neighbors(snap, id, 'owns', 'in').forEach(ow => related.push(ow.node));
      return {
        object: o, why, related, history: o._events, confidence: 0.86,
        contextObject: {
          time: t === Infinity ? now() : t, status: o.status, goal: goal ? goal.id : null,
          dependencies: this.neighbors(snap, id, 'depends_on', 'out').map(n => n.node.id),
          dependents: dependents.map(n => n.node.id), owners: related.map(r => r.id),
          evidence: evidence((o.name || id) + ' is ' + o.status, { events: evEvents, objects: [id] }),
        },
      };
    }

    understand(t = Infinity) {
      const snap = this.materialize(t); const risks = [], bottlenecks = [], cycles = this._cycles(snap);
      for (const goal of this.byType(snap, 'goal')) {
        if (goal.status === 'done') continue;
        const tasks = this._tasksForGoal(snap, goal.id); const blocked = tasks.filter(x => x.status === 'blocked'); const pred = this._predict(snap, goal, tasks);
        if (pred.probability < 0.6 || blocked.length) {
          risks.push({
            subject: goal.id, title: '"' + goal.name + '" is at risk', probability: 1 - pred.probability, confidence: 0.8,
            why: blocked.length ? blocked.map(b => b.name).join(', ') + ' blocked on the path; ' + pred.drivers.join('; ') + '.' : pred.drivers.join('; ') + '.',
            evidence: evidence('"' + goal.name + '" may miss its deadline', { events: blocked.flatMap(b => b._events.filter(e => /\.blocked$/.test(e.type)).map(e => e.id)), objects: [goal.id].concat(blocked.map(b => b.id)) }),
          });
        }
      }
      const degree = new Map(); snap.rels.forEach(r => degree.set(r.to, (degree.get(r.to) || 0) + 1));
      [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([id, deg]) => { const o = snap.objects.get(id); if (o && deg >= 2 && o.status !== 'done') bottlenecks.push({ id, name: o.name || id, degree: deg, type: o.type, confidence: clamp(deg / 6, 0.4, 0.95) }); });
      risks.sort((a, b) => b.probability - a.probability);
      return { risks, bottlenecks, cycles, snapshot: { objects: snap.objects.size, rels: snap.rels.length } };
    }
    _tasksForGoal(snap, goalId) {
      const isWork = o => o.type === 'task' || o.type === 'code';
      const projs = this.neighbors(snap, goalId, 'advances', 'in').map(n => n.node).filter(o => o.type === 'project');
      let tasks = []; projs.forEach(p => { tasks = tasks.concat(this.neighbors(snap, p.id, 'belongs_to', 'in').map(n => n.node).filter(isWork)); });
      tasks = tasks.concat(this.neighbors(snap, goalId, 'advances', 'in').map(n => n.node).filter(isWork));
      return [...new Map(tasks.map(x => [x.id, x])).values()];
    }
    _cycles(snap) {
      const adj = {}; snap.rels.filter(r => r.rtype === 'depends_on').forEach(r => (adj[r.from] = adj[r.from] || []).push(r.to));
      const seen = new Set(), stack = new Set(), found = [];
      const dfs = (n, path) => { seen.add(n); stack.add(n); for (const m of adj[n] || []) { if (stack.has(m)) found.push([...path, n, m].map(id => (snap.objects.get(id) || {}).name || id)); else if (!seen.has(m)) dfs(m, [...path, n]); } stack.delete(n); };
      Object.keys(adj).forEach(n => { if (!seen.has(n)) dfs(n, []); });
      return found;
    }

    predict(goalId, t = Infinity) { const snap = this.materialize(t); const goal = snap.objects.get(goalId); if (!goal) return null; return this._predict(snap, goal, this._tasksForGoal(snap, goalId), t); }
    _predict(snap, goal, tasks, t = Infinity) {
      const ref = t === Infinity ? now() : t;
      const total = tasks.length || 1, done = tasks.filter(x => x.status === 'done').length, remaining = total - done;
      const blockedCritical = tasks.filter(x => x.status === 'blocked' && this.neighbors(snap, x.id, 'depends_on', 'in').length > 0).length;
      const daysLeft = goal.deadline ? Math.max(0, daysBetween(ref, goal.deadline)) : 30;
      const doneEvents = tasks.flatMap(x => x._events.filter(e => /\.(completed|done|merged)$/.test(e.type)));
      let velocity = 0.4; if (doneEvents.length >= 2) { const span = Math.max(1, daysBetween(Math.min(...doneEvents.map(e => e.at)), Math.max(...doneEvents.map(e => e.at)))); velocity = doneEvents.length / span; }
      const feasible = velocity * daysLeft; let p = clamp(feasible / remaining, 0, 1.1); p -= blockedCritical * 0.42; if (daysLeft === 0 && remaining > 0) p = 0.05;
      const probability = clamp(p, 0.03, 0.97); const slipDays = Math.ceil(remaining / Math.max(0.2, velocity)) + blockedCritical * 3;
      const drivers = [remaining + '/' + total + ' tasks remaining', daysLeft + ' day(s) to deadline'];
      if (blockedCritical) drivers.push(blockedCritical + ' blocked task(s) on the critical path');
      drivers.push('team velocity ~' + velocity.toFixed(2) + ' tasks/day');
      return { goal: goal.id, probability, confidence: 0.78, drivers, projectedDate: ref + slipDays * DAY, remaining, total, blockedCritical, daysLeft, velocity, evidence: evidence('on-time probability ' + Math.round(probability * 100) + '%', { objects: [goal.id].concat(tasks.map(t => t.id)) }) };
    }

    simulate(hypos, focusGoalId = null) {
      const before = this._worldState(focusGoalId);
      const ghost = new Reality(); ghost.events = this.events.map(e => ({ ...e })); ghost.patterns = this.patterns;
      hypos.forEach(h => ghost.emit(h.type, h.subject, h.payload || {}, h.at || now(), 'simulation'));
      const after = ghost._worldState(focusGoalId); const deltas = [];
      after.predictions.forEach(ap => { const bp = before.predictions.find(x => x.goal === ap.goal); if (bp) deltas.push({ goal: ap.goal, name: ap.name, before: Math.round(bp.probability * 100), after: Math.round(ap.probability * 100), delta: Math.round((ap.probability - bp.probability) * 100), dateShift: daysBetween(bp.projectedDate, ap.projectedDate) }); });
      return { before, after, deltas, applied: hypos };
    }
    _worldState(focusGoalId) {
      const snap = this.materialize(); const goals = focusGoalId ? [snap.objects.get(focusGoalId)].filter(Boolean) : this.byType(snap, 'goal');
      const predictions = goals.filter(g => g.status !== 'done').map(g => { const p = this._predict(snap, g, this._tasksForGoal(snap, g.id)); p.name = g.name; return p; });
      return { predictions, objectCount: snap.objects.size };
    }

    decide(t = Infinity) {
      const { risks } = this.understand(t); const snap = this.materialize(t); const actions = [];
      for (const risk of risks) {
        const goal = snap.objects.get(risk.subject); const tasks = this._tasksForGoal(snap, risk.subject); const blocked = tasks.filter(x => x.status === 'blocked');
        for (const b of blocked) {
          const sim = this.simulate([{ type: 'task.unblocked', subject: b.id }, { type: 'task.completed', subject: b.id }], risk.subject);
          const dd = sim.deltas.find(x => x.goal === risk.subject); const owner = this.neighbors(snap, b.id, 'owns', 'in')[0] ? this.neighbors(snap, b.id, 'owns', 'in')[0].node : null;
          actions.push({ action: 'Unblock "' + b.name + '"' + (owner ? ' (owner ' + owner.name + ')' : ''), reason: b.blockReason ? "It's blocked: " + b.blockReason + '. ' + risk.why : risk.why, evidence: risk.evidence, confidence: 0.8, expectedResult: dd ? 'On-time odds for "' + goal.name + '" ' + dd.before + '% → ' + dd.after + '% (' + (dd.delta >= 0 ? '+' : '') + dd.delta + ' pts)' + (dd.dateShift ? ', date moves ' + (-dd.dateShift) + ' day(s) earlier' : '') + '.' : 'Removes a critical blocker.', impact: Math.round(risk.probability * 100), _score: (dd ? Math.max(0, dd.delta) : 10) * risk.probability });
        }
        if (!blocked.length) actions.push({ action: 'Accelerate "' + goal.name + '"', reason: risk.why, evidence: risk.evidence, confidence: 0.6, expectedResult: 'Add capacity or de-scope to raise on-time odds.', impact: Math.round(risk.probability * 100), _score: risk.probability * 5 });
      }
      actions.sort((a, b) => b._score - a._score); return actions;
    }

    effects(id, snap) {
      snap = snap || this.materialize(); const out = new Set(), order = [];
      const walk = (n) => { for (const x of this.neighbors(snap, n, 'depends_on', 'in')) { if (!out.has(x.node.id)) { out.add(x.node.id); order.push(x.node); walk(x.node.id); } } for (const x of this.neighbors(snap, n, 'causes', 'out')) { if (!out.has(x.node.id)) { out.add(x.node.id); order.push(x.node); walk(x.node.id); } } };
      walk(id); return order;
    }
    causalChain(goalId, t = Infinity) {
      const snap = this.materialize(t); const goal = snap.objects.get(goalId); if (!goal) return null;
      const tasks = this._tasksForGoal(snap, goalId); const chains = [];
      for (const b of tasks.filter(x => x.status === 'blocked')) {
        const chain = []; if (b.blockReason) chain.push({ kind: 'root_cause', label: b.blockReason });
        chain.push({ kind: 'blocked', id: b.id, label: b.name });
        this.effects(b.id, snap).filter(o => tasks.some(t => t.id === o.id)).forEach(o => chain.push({ kind: 'effect', id: o.id, label: o.name }));
        chain.push({ kind: 'at_risk', id: goal.id, label: goal.name }); chains.push({ chain, confidence: 0.74 });
      }
      return { goal: goalId, chains, confidence: 0.74, evidence: evidence('causal chain to goal risk', { objects: [goalId] }) };
    }

    intentOf(id, snap) {
      snap = snap || this.materialize(); let cur = id, guard = 0;
      while (guard++ < 20) { const o = snap.objects.get(cur); if (!o) return null; if (o.type === 'goal') return o; const up = this.neighbors(snap, cur, 'advances', 'out')[0] || this.neighbors(snap, cur, 'belongs_to', 'out')[0] || this.neighbors(snap, cur, 'part_of', 'out')[0] || this.neighbors(snap, cur, 'serves', 'out')[0]; if (!up) return null; cur = up.node.id; }
      return null;
    }
    goalGraph(t = Infinity) {
      const snap = this.materialize(t);
      return this.byType(snap, 'goal').map(g => ({ id: g.id, name: g.name, status: g.status, deadline: g.deadline || null, businessValue: g.businessValue || 0, parents: this.neighbors(snap, g.id, 'advances', 'out').concat(this.neighbors(snap, g.id, 'part_of', 'out')).map(n => n.node.id).filter(pid => (snap.objects.get(pid) || {}).type === 'goal'), feeders: this.neighbors(snap, g.id, 'advances', 'in').map(n => n.node.id) }));
    }

    memory(t = Infinity) {
      const snap = this.materialize(t); const u = this.understand(t);
      const ref = t === Infinity ? now() : t; const recent = [...this.events].filter(e => e.at <= ref).sort((a, b) => b.at - a.at);
      const typeCounts = {}; [...snap.objects.values()].forEach(o => typeCounts[o.type] = (typeCounts[o.type] || 0) + 1);
      return { working: u.risks.map(r => r.title), short: recent.slice(0, 20).map(e => ({ type: e.type, subject: e.subject, at: e.at })), long: this.patterns, organizational: this.patterns, semantic: typeCounts, historical: { events: this.events.length, since: this.events[0] ? this.events[0].at : null } };
    }

    attention(limit = 8, t = Infinity) {
      const snap = this.materialize(t); const u = this.understand(t); const riskIds = new Set(u.risks.flatMap(r => r.evidence.objects));
      const degree = new Map(); snap.rels.forEach(r => degree.set(r.to, (degree.get(r.to) || 0) + 1)); const ref = t === Infinity ? now() : t;
      return [...snap.objects.values()].filter(o => o.status !== 'done').map(o => {
        let s = 0; const reasons = [];
        if (o.status === 'blocked') { s += 5; reasons.push('blocked'); }
        if (riskIds.has(o.id)) { s += 4; reasons.push('on a risk path'); }
        const deg = degree.get(o.id) || 0; if (deg >= 2) { s += deg; reasons.push(deg + ' dependencies'); }
        const last = o._events[o._events.length - 1]; if (last && daysBetween(last.at, ref) <= 2) { s += 1.5; reasons.push('recent activity'); }
        if (o.value || o.businessValue) { s += 2; reasons.push('business value'); }
        return { id: o.id, name: o.name || o.id, type: o.type, score: +s.toFixed(1), reasons };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    }

    economics(t = Infinity) {
      const snap = this.materialize(t); const u = this.understand(t); let exposure = 0; const lines = [];
      for (const risk of u.risks) {
        const goal = snap.objects.get(risk.subject); if (!goal) continue;
        const customers = this.neighbors(snap, risk.subject, 'committed_to', 'in').map(n => n.node);
        const custVal = customers.reduce((a, c) => a + (+c.value || 0), 0); const gVal = +goal.businessValue || 0;
        const atRisk = Math.round((custVal + gVal) * risk.probability); exposure += atRisk;
        lines.push({ goal: goal.name, valueAtRisk: atRisk, probability: +risk.probability.toFixed(2), customers: customers.map(c => c.name) });
      }
      return { exposure, lines, confidence: 0.7 };
    }

    remember(signature, situation, resolution) { this.patterns.push({ signature, situation, resolution, at: now() }); }
    recall(signature) { return this.patterns.filter(p => p.signature === signature); }

    coordinate(goalId, t = Infinity) {
      const snap = this.materialize(t); const goal = snap.objects.get(goalId); if (!goal) return [];
      return this._tasksForGoal(snap, goalId).filter(x => x.status !== 'done').map(x => { const own = this.neighbors(snap, x.id, 'owns', 'in')[0]; const owner = own ? own.node : null; const blocked = x.status === 'blocked'; return { who: owner ? owner.name : 'unassigned', what: x.name, state: x.status, when: blocked ? 'unblock first' : 'in sequence', priority: blocked ? 'now' : 'next' }; });
    }

    toJSON() { return { events: this.events, patterns: this.patterns }; }
    static fromJSON(d) { const r = new Reality(); if (d) { r.events = (d.events || []).map(e => Object.freeze({ ...e })); r.patterns = d.patterns || []; } return r; }
  }

  function seed() {
    const r = new Reality(); const d = (n) => now() - n * DAY;
    ['Sara Khan', 'Omar Riaz', 'Maya Lopez', 'Dev Patel', 'Priya Nair'].forEach((n, i) => r.object('person:' + n.split(' ')[0].toLowerCase(), 'person', { name: n, role: ['Lead', 'Backend', 'Frontend', 'QA', 'PM'][i] }, d(30)));
    r.object('goal:q3', 'goal', { name: 'Grow Q3 revenue', businessValue: 250000 }, d(40));
    r.object('goal:checkout', 'goal', { name: 'Ship Checkout v2', deadline: now() + 9 * DAY, businessValue: 80000 }, d(20));
    r.relate('goal:checkout', 'advances', 'goal:q3', {}, d(20));
    r.object('cust:acme', 'customer', { name: 'Acme Corp', value: 60000 }, d(20));
    r.object('proj:checkout', 'project', { name: 'Checkout v2' }, d(20));
    r.object('task:pay', 'task', { name: 'Payment integration' }, d(14));
    r.object('task:ui', 'task', { name: 'Checkout UI' }, d(14));
    r.object('task:qa', 'task', { name: 'QA pass' }, d(14));
    r.object('task:sec', 'task', { name: 'Security review' }, d(14));
    r.object('vendor:stripe', 'service', { name: 'Vendor API' }, d(20));
    r.relate('proj:checkout', 'advances', 'goal:checkout', {}, d(20));
    ['pay', 'ui', 'qa', 'sec'].forEach(t => r.relate('task:' + t, 'belongs_to', 'proj:checkout', {}, d(14)));
    r.relate('task:qa', 'depends_on', 'task:pay', {}, d(14));
    r.relate('task:qa', 'depends_on', 'task:ui', {}, d(14));
    r.relate('task:sec', 'depends_on', 'task:qa', {}, d(14));
    r.relate('person:omar', 'owns', 'task:pay', {}, d(14));
    r.relate('person:maya', 'owns', 'task:ui', {}, d(14));
    r.relate('person:dev', 'owns', 'task:qa', {}, d(14));
    r.relate('person:sara', 'owns', 'task:sec', {}, d(14));
    r.relate('cust:acme', 'committed_to', 'goal:checkout', {}, d(20));
    r.relate('vendor:stripe', 'causes', 'task:pay', {}, d(2));
    r.emit('task.started', 'task:ui', {}, d(6));
    r.emit('task.blocked', 'task:pay', { reason: 'waiting on vendor API keys' }, d(2));
    r.remember('task.blocked:vendor', 'payment task blocked by vendor delay', 'escalated to vendor + added card guarantee; resolved in 2 days');
    return r;
  }

  const API = { Reality, seed, ONTOLOGY, REL_TYPES, LAWS, Principal, evidence, isA, ancestors, mintId, normalizeType };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityEngine = API;
})(typeof window !== 'undefined' ? window : this);
