/* =====================================================================
   RealityOS — Reality Type System (reality-types.js)
   An ontology classifies; a TYPE SYSTEM defines behavior:
   properties · lifecycle (state machine) · capabilities · constraints.
   Pure; browser + Node. Works alongside reality-engine.js.
   ===================================================================== */
(function (root) {
  /* Each type declares behavior. `extends` aligns with the ontology. */
  const TYPE_SYSTEM = {
    entity: { extends: null, properties: ['id', 'name'], capabilities: ['exist'], lifecycle: null, constraints: [] },

    person: { extends: 'human', properties: ['name', 'role'],
      capabilities: ['decide', 'approve', 'communicate', 'learn', 'own'],
      lifecycle: null, constraints: ['no_self_approval'] },

    ai_agent: { extends: 'entity', properties: ['name', 'model'],
      capabilities: ['predict', 'recommend', 'simulate', 'observe', 'learn'],
      lifecycle: { initial: 'created', states: { created: ['configured'], configured: ['learning', 'running'], learning: ['running'], running: ['paused', 'stopped'], paused: ['running', 'stopped'], stopped: [] }, terminal: ['stopped'] },
      constraints: [] },

    robot: { extends: 'machine', properties: ['name'], capabilities: ['observe', 'move', 'report', 'act'],
      lifecycle: { initial: 'idle', states: { idle: ['running'], running: ['idle', 'fault'], fault: ['idle'] }, terminal: [] }, constraints: [] },

    sensor: { extends: 'machine', properties: ['name'], capabilities: ['observe', 'report'],
      lifecycle: { initial: 'online', states: { online: ['offline'], offline: ['online'] }, terminal: [] }, constraints: [] },

    task: { extends: 'process', properties: ['name'],
      capabilities: ['be_assigned', 'be_blocked', 'be_completed'],
      lifecycle: { initial: 'created', states: { created: ['assigned', 'active'], assigned: ['active'], active: ['blocked', 'done'], blocked: ['active', 'done'], done: ['archived'], archived: [] }, terminal: ['archived'] },
      constraints: ['finish_after_start', 'child_needs_parent', 'blocked_needs_reason'] },

    project: { extends: 'process', properties: ['name'],
      capabilities: ['contain_tasks', 'advance_goal'],
      lifecycle: { initial: 'planned', states: { planned: ['active'], active: ['blocked', 'done'], blocked: ['active', 'done'], done: ['archived'], archived: [] }, terminal: ['archived'] }, constraints: [] },

    goal: { extends: 'intent', properties: ['name', 'deadline', 'businessValue'],
      capabilities: ['be_advanced', 'be_predicted'],
      lifecycle: { initial: 'defined', states: { defined: ['active'], active: ['at_risk', 'achieved', 'missed'], at_risk: ['active', 'achieved', 'missed'], achieved: [], missed: [] }, terminal: ['achieved', 'missed'] }, constraints: [] },

    meeting: { extends: 'process', properties: ['name', 'time'], capabilities: ['be_scheduled'],
      lifecycle: { initial: 'scheduled', states: { scheduled: ['running', 'cancelled'], running: ['ended'], ended: ['archived'], cancelled: [], archived: [] }, terminal: ['archived', 'cancelled'] }, constraints: [] },

    invoice: { extends: 'document', properties: ['amount', 'dueAt'], capabilities: ['be_paid'],
      lifecycle: { initial: 'draft', states: { draft: ['issued'], issued: ['paid', 'overdue'], overdue: ['paid'], paid: ['archived'], archived: [] }, terminal: ['archived'] }, constraints: [] },

    payment: { extends: 'document', properties: ['amount'], capabilities: ['settle_invoice'],
      lifecycle: { initial: 'initiated', states: { initiated: ['authorized', 'failed'], authorized: ['captured', 'failed'], captured: [], failed: [] }, terminal: ['captured', 'failed'] },
      constraints: ['payment_needs_invoice'] },

    customer: { extends: 'organization', properties: ['name', 'value'], capabilities: ['commit', 'communicate'], lifecycle: null, constraints: [] },
    code: { extends: 'document', properties: ['name'], capabilities: ['be_reviewed', 'be_merged'], lifecycle: { initial: 'open', states: { open: ['blocked', 'merged', 'closed'], blocked: ['open', 'closed'], merged: [], closed: [] }, terminal: ['merged', 'closed'] }, constraints: [] },
    service: { extends: 'entity', properties: ['name'], capabilities: ['provide'], lifecycle: null, constraints: [] },
  };

  function typeDef(type) { return TYPE_SYSTEM[type] || TYPE_SYSTEM.entity; }
  function lifecycleOf(type) { return typeDef(type).lifecycle; }
  function capabilities(type) {
    const out = new Set(); let t = type;
    while (t) { const d = TYPE_SYSTEM[t]; if (!d) break; (d.capabilities || []).forEach(c => out.add(c)); t = d.extends; }
    return [...out];
  }
  function can(type, capability) { return capabilities(type).includes(capability); }
  function validTransition(type, from, to) { const lc = lifecycleOf(type); if (!lc) return true; if (!from) return to === lc.initial; const allowed = lc.states[from] || []; return allowed.includes(to); }
  function isTerminal(type, state) { const lc = lifecycleOf(type); return !!lc && (lc.terminal || []).includes(state); }

  /* map engine `status` to a lifecycle state (engine uses active/blocked/done/...) */
  function statusToLifecycle(type, status) {
    const lc = lifecycleOf(type); if (!lc) return status;
    const map = { active: lc.states.active ? 'active' : lc.initial, blocked: 'blocked', done: lc.states.done ? 'done' : (lc.terminal[0] || 'done'), cancelled: 'cancelled', redacted: 'archived' };
    return map[status] || status;
  }

  /* ---- CONSTRAINTS: rules that define VALID reality ---- */
  const CONSTRAINTS = {
    finish_after_start(snap, R) {
      const v = [];
      for (const o of snap.objects.values()) {
        if (o.type !== 'task') continue;
        const started = o._events.find(e => /\.(started|opened)$/.test(e.type));
        const done = o._events.find(e => /\.(completed|done|merged)$/.test(e.type));
        if (started && done && done.at < started.at) v.push({ constraint: 'finish_after_start', subject: o.id, message: `${o.name || o.id} completed before it started`, severity: 'error' });
      }
      return v;
    },
    child_needs_parent(snap, R) {
      const v = [];
      for (const o of snap.objects.values()) {
        if (o.type !== 'task') continue;
        const hasParent = snap.rels.some(r => r.from === o.id && r.rtype === 'belongs_to');
        if (!hasParent) v.push({ constraint: 'child_needs_parent', subject: o.id, message: `${o.name || o.id} has no parent project`, severity: 'warn' });
      }
      return v;
    },
    blocked_needs_reason(snap, R) {
      const v = [];
      for (const o of snap.objects.values()) if (o.status === 'blocked' && !o.blockReason) v.push({ constraint: 'blocked_needs_reason', subject: o.id, message: `${o.name || o.id} is blocked with no reason`, severity: 'warn' });
      return v;
    },
    payment_needs_invoice(snap, R) {
      const v = [];
      for (const o of snap.objects.values()) {
        if (o.type !== 'payment') continue;
        const hasInvoice = snap.rels.some(r => r.from === o.id && r.rtype === 'settles') || snap.rels.some(r => r.to === o.id && r.rtype === 'paid_by');
        if (!hasInvoice) v.push({ constraint: 'payment_needs_invoice', subject: o.id, message: `${o.name || o.id} exists without an invoice`, severity: 'error' });
      }
      return v;
    },
    no_self_approval(snap, R) {
      const v = [];
      for (const e of (R ? R.events : [])) {
        if (!/\.approved$/.test(e.type)) continue;
        const approver = e.payload && e.payload.by; const owner = snap.rels.find(r => r.to === e.subject && r.rtype === 'owns');
        if (approver && owner && owner.from === approver) v.push({ constraint: 'no_self_approval', subject: e.subject, message: `${approver} approved their own item`, severity: 'error' });
      }
      return v;
    },
    no_dependency_cycle(snap, R) { return (R && R._cycles ? R._cycles(snap) : []).map(c => ({ constraint: 'no_dependency_cycle', subject: c.join(' → '), message: `circular dependency: ${c.join(' → ')}`, severity: 'error' })); },
  };

  function checkConstraints(R, t) {
    const snap = R.materialize(t); const violations = [];
    for (const name of Object.keys(CONSTRAINTS)) { try { violations.push(...CONSTRAINTS[name](snap, R)); } catch (e) { /* skip */ } }
    return violations;
  }

  const API = { TYPE_SYSTEM, CONSTRAINTS, typeDef, lifecycleOf, capabilities, can, validTransition, isTerminal, statusToLifecycle, checkConstraints };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityTypes = API;
})(typeof window !== 'undefined' ? window : this);
