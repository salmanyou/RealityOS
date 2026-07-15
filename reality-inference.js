/* =====================================================================
   RealityOS — Reality Inference Engine (reality-inference.js)
   Forward-chaining: derives facts NOBODY recorded, with evidence +
   confidence, iterating to a fixpoint. Inferred facts can themselves
   trigger further inference (multi-hop).
   Pure; browser + Node. Operates on a Reality instance.
   ===================================================================== */
(function (root) {
  /* A fact = { type, subject, label, confidence, because:{events,objects,facts}, inferred:true } */
  const fact = (type, subject, label, confidence, because) => ({ type, subject, label, confidence, because: because || {}, inferred: true });

  /* Rules read the snapshot + facts derived so far, and assert new facts.
     Each returns an array of new facts (engine de-dupes by type+subject).   */
  const RULES = [
    // blocked critical task -> goal at risk
    function goalAtRisk(R, snap, facts) {
      const out = [];
      for (const g of R.byType(snap, 'goal')) {
        if (g.status === 'done') continue;
        const tasks = R._tasksForGoal(snap, g.id); const blocked = tasks.filter(x => x.status === 'blocked' && R.neighbors(snap, x.id, 'depends_on', 'in').length);
        if (blocked.length) out.push(fact('goal_at_risk', g.id, `"${g.name}" at risk (critical task blocked)`, 0.8, { objects: [g.id, ...blocked.map(b => b.id)] }));
      }
      return out;
    },
    // customer committed to an at-risk goal -> revenue at risk
    function revenueAtRisk(R, snap, facts) {
      const out = [];
      for (const f of facts.filter(f => f.type === 'goal_at_risk')) {
        for (const c of R.neighbors(snap, f.subject, 'committed_to', 'in').map(n => n.node)) {
          out.push(fact('revenue_at_risk', c.id, `Revenue at risk: ${c.name} ($${(+c.value || 0).toLocaleString()}) is committed to an at-risk goal`, 0.72, { objects: [c.id, f.subject], facts: [f.type + ':' + f.subject] }));
        }
      }
      return out;
    },
    // overdue invoice -> cash-flow risk  (multi-hop chain start)
    function cashFlowRisk(R, snap, facts) {
      const out = [];
      for (const inv of R.byType(snap, 'invoice')) {
        const overdue = inv.status === 'overdue' || (inv.dueAt && inv.dueAt < snap.t && inv.status !== 'paid');
        if (overdue) out.push(fact('cash_flow_risk', 'org', `Cash-flow risk: invoice ${inv.name || inv.id} ($${(+inv.amount || 0).toLocaleString()}) overdue`, 0.7, { objects: [inv.id] }));
      }
      return out;
    },
    // cash-flow risk -> hiring delay risk
    function hiringDelayRisk(R, snap, facts) {
      return facts.some(f => f.type === 'cash_flow_risk')
        ? [fact('hiring_delay_risk', 'org', 'Hiring likely to slow (cash-flow constrained)', 0.55, { facts: ['cash_flow_risk:org'] })] : [];
    },
    // hiring delay -> engineering capacity reduction -> goals slip
    function capacityReduction(R, snap, facts) {
      return facts.some(f => f.type === 'hiring_delay_risk')
        ? [fact('capacity_reduction_risk', 'engineering', 'Reduced engineering capacity expected (hiring delayed)', 0.5, { facts: ['hiring_delay_risk:org'] })] : [];
    },
    // person owning >1 blocked task -> overloaded
    function overloaded(R, snap, facts) {
      const out = []; const byOwner = {};
      snap.rels.filter(r => r.rtype === 'owns').forEach(r => { const t = snap.objects.get(r.to); if (t && t.status === 'blocked') (byOwner[r.from] = byOwner[r.from] || []).push(t); });
      for (const [pid, tasks] of Object.entries(byOwner)) if (tasks.length >= 2) { const p = snap.objects.get(pid); out.push(fact('overloaded', pid, `${p ? p.name : pid} is overloaded (${tasks.length} blocked tasks)`, 0.6, { objects: [pid, ...tasks.map(t => t.id)] })); }
      return out;
    },
    // vendor causes a blocked task -> supply risk
    function supplyRisk(R, snap, facts) {
      const out = [];
      snap.rels.filter(r => r.rtype === 'causes').forEach(r => { const t = snap.objects.get(r.to); const v = snap.objects.get(r.from); if (t && t.status === 'blocked') out.push(fact('supply_risk', v.id, `Supply risk: ${v.name || v.id} is blocking ${t.name || t.id}`, 0.68, { objects: [v.id, t.id] })); });
      return out;
    },
  ];

  function infer(R, t = Infinity, maxIter = 6) {
    const snap = R.materialize(t); const facts = []; const key = f => f.type + ':' + f.subject; const seen = new Set();
    let iter = 0, added = true;
    while (added && iter < maxIter) {
      added = false; iter++;
      for (const rule of RULES) {
        let produced = []; try { produced = rule(R, snap, facts) || []; } catch (e) { produced = []; }
        for (const f of produced) if (!seen.has(key(f))) { seen.add(key(f)); facts.push(f); added = true; }
      }
    }
    return { facts, iterations: iter };
  }

  /* optionally write inferred facts back as events (source 'inference') so they persist + replay */
  function record(R, t = Infinity) {
    const { facts } = infer(R, t);
    facts.forEach(f => R.emit('fact.inferred', f.subject, { factType: f.type, label: f.label, confidence: f.confidence, because: f.because }, Date.now(), 'inference'));
    return facts;
  }

  const API = { RULES, infer, record, fact };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityInference = API;
})(typeof window !== 'undefined' ? window : this);
