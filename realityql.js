/* =====================================================================
   RealityQL — a query language for reality (not SQL, not REST).
   Verbs: OBSERVE · UNDERSTAND · EXPLAIN/WHY · PREDICT · SIMULATE ·
          DECIDE · COORDINATE · ATTENTION · ECONOMICS · CAUSE · MEMORY
   Modifiers: "AS OF <n>" (time-travel n days back), "LIMIT <n>"
   Pure; runs in browser + Node. Operates on a Reality instance.
   ===================================================================== */
(function (root) {
  const DAY = 86400000;
  function safeReq(p) { try { return (typeof require !== 'undefined') ? require(p) : null; } catch (e) { return null; } }
  const T = safeReq('./reality-types.js') || (root && root.RealityTypes);
  const INF = safeReq('./reality-inference.js') || (root && root.RealityInference);
  const UND = safeReq('./reality-understand.js') || (root && root.RealityUnderstand);
  const PROB = safeReq('./reality-probability.js') || (root && root.RealityProbability);

  /* --- tokenizer: whitespace split, but keep "quoted phrases" together --- */
  function tokenize(src) {
    const out = []; const re = /"([^"]*)"|(\S+)/g; let m;
    while ((m = re.exec(src))) out.push(m[1] !== undefined ? m[1] : m[2]);
    return out;
  }

  /* --- parser: VERB arg* [AS OF n] [LIMIT n] --- */
  function parse(src) {
    const toks = tokenize(src.trim());
    if (!toks.length) return { error: 'empty query' };
    const verb = toks[0].toUpperCase();
    const opts = {}; const args = [];
    for (let i = 1; i < toks.length; i++) {
      const T = toks[i].toUpperCase();
      if (T === 'AS' && (toks[i + 1] || '').toUpperCase() === 'OF') { opts.asOfDays = parseInt(toks[i + 2], 10) || 0; i += 2; }
      else if (T === 'LIMIT') { opts.limit = parseInt(toks[i + 1], 10) || 10; i += 1; }
      else if (T === 'CAUSED' && (toks[i + 1] || '').toUpperCase() === 'BY') { opts.causedBy = toks[i + 2]; i += 2; }
      else if (T === 'AFFECTING') { opts.affecting = toks[i + 1]; i += 1; }
      else if (T === 'NEXT') { opts.nextDays = parseInt(toks[i + 1], 10) || 0; i += ((toks[i + 2] || '').toUpperCase().startsWith('DAY') ? 2 : 1); }
      else if (T === 'FOR') { opts.forN = parseInt(toks[i + 1], 10) || 0; opts.forUnit = (toks[i + 2] || 'days').toLowerCase(); i += 2; }
      else if (T === 'FROM') { opts.from = toks[i + 1]; i += 1; }
      else args.push(toks[i]);
    }
    return { verb, args, opts };
  }

  /* resolve an arg to an object id: exact id, or case-insensitive name match */
  function resolveId(R, snap, arg) {
    if (!arg) return null;
    if (snap.objects.has(arg)) return arg;
    const a = arg.toLowerCase();
    for (const o of snap.objects.values()) {
      if ((o.id || '').toLowerCase() === a) return o.id;
      if (o.name && o.name.toLowerCase().includes(a)) return o.id;
    }
    return arg; // leave as-is (may be a partial id)
  }
  function firstGoal(R, snap) { const g = R.byType(snap, 'goal').find(x => x.deadline) || R.byType(snap, 'goal')[0]; return g ? g.id : null; }

  /* --- executor --- */
  function execute(R, src) {
    const q = parse(src);
    if (q.error) return { ok: false, text: q.error };
    const t = q.opts.asOfDays ? Date.now() - q.opts.asOfDays * DAY : Infinity;
    const snap = R.materialize(t);
    const lim = q.opts.limit || 10;
    const A = q.args.map(a => a);

    switch (q.verb) {
      case 'OBSERVE': {
        let list = [...snap.objects.values()];
        const sel = (A[0] || '').toLowerCase();
        if (sel && sel !== 'all' && sel !== '*') list = list.filter(o => o.type === sel || R.isA?.(o.type, sel) || (o.name || '').toLowerCase().includes(sel));
        list = list.slice(0, lim);
        return { ok: true, verb: 'OBSERVE', result: list.map(o => ({ id: o.id, type: o.type, name: o.name, status: o.status })),
          text: list.length ? list.map(o => `• ${o.name || o.id} [${o.type}] — ${o.status}`).join('\n') : 'nothing matches.' };
      }
      case 'UNDERSTAND': {
        const u = R.understand(t);
        const txt = [u.risks.length ? 'Risks:\n' + u.risks.map(r => `  • ${Math.round(r.probability * 100)}% ${r.title.replace(/"/g, '')}`).join('\n') : 'No risks.',
          u.bottlenecks.length ? 'Bottlenecks: ' + u.bottlenecks.map(b => b.name).join(', ') : '',
          u.cycles.length ? 'Dependency cycles: ' + u.cycles.length : ''].filter(Boolean).join('\n');
        return { ok: true, verb: 'UNDERSTAND', result: u, text: txt };
      }
      case 'EXPLAIN': case 'WHY': {
        const id = resolveId(R, snap, A[0]); const c = R.context(id, t);
        if (!c) return { ok: false, text: `unknown object: ${A[0]}` };
        return { ok: true, verb: 'EXPLAIN', result: c, confidence: c.confidence,
          text: `${c.object.name || id} is ${c.object.status}.\n` + (c.why.length ? c.why.map(w => '  • ' + w).join('\n') : '  (no notable context)') + `\n[confidence ${Math.round(c.confidence * 100)}%]` };
      }
      case 'CAUSE': case 'CAUSALITY': {
        const id = resolveId(R, snap, A[0]) || firstGoal(R, snap); const cc = R.causalChain(id, t);
        if (!cc || !cc.chains.length) return { ok: true, verb: 'CAUSE', result: cc, text: 'no causal chain found.' };
        return { ok: true, verb: 'CAUSE', result: cc, confidence: cc.confidence,
          text: cc.chains.map(c => c.chain.map(n => n.label).join('  →  ')).join('\n') + `\n[confidence ${Math.round(cc.confidence * 100)}%]` };
      }
      case 'PREDICT': {
        const id = resolveId(R, snap, A[0]) || firstGoal(R, snap); const p = R.predict(id, t);
        if (!p) return { ok: false, text: `no goal: ${A[0] || ''}` };
        return { ok: true, verb: 'PREDICT', result: p, confidence: p.confidence,
          text: `${snap.objects.get(id)?.name || id}: on-time ${Math.round(p.probability * 100)}%\n  drivers: ${p.drivers.join(' | ')}\n[confidence ${Math.round(p.confidence * 100)}%]` };
      }
      case 'SIMULATE': {
        // grammar: SIMULATE <action> <id>   action ∈ unblock|complete|start|block
        const action = (A[0] || '').toLowerCase(); const id = resolveId(R, snap, A.slice(1).join(' '));
        const map = { unblock: ['task.unblocked'], complete: ['task.completed'], finish: ['task.unblocked', 'task.completed'], start: ['task.started'], block: ['task.blocked'] };
        const types = map[action]; if (!types || !snap.objects.has(id)) return { ok: false, text: 'usage: SIMULATE <unblock|finish|complete|start|block> <object>' };
        const sim = R.simulate(types.map(ty => ({ type: ty, subject: id })));
        return { ok: true, verb: 'SIMULATE', result: sim,
          text: sim.deltas.length ? sim.deltas.map(d => `${d.name}: ${d.before}% → ${d.after}% (${d.delta >= 0 ? '+' : ''}${d.delta} pts${d.dateShift ? ', ' + (-d.dateShift) + 'd earlier' : ''})`).join('\n') : 'no goal affected.' };
      }
      case 'DECIDE': {
        const acts = R.decide(t).slice(0, lim);
        return { ok: true, verb: 'DECIDE', result: acts,
          text: acts.length ? acts.map((a, i) => `${i + 1}. ${a.action}\n   → ${a.expectedResult}`).join('\n') : 'no decisions needed.' };
      }
      case 'COORDINATE': {
        const id = resolveId(R, snap, A[0]) || firstGoal(R, snap); const c = R.coordinate(id, t);
        return { ok: true, verb: 'COORDINATE', result: c,
          text: c.length ? c.map(x => `${x.priority.toUpperCase()}  ${x.who} → ${x.what} (${x.state})`).join('\n') : 'nothing to coordinate.' };
      }
      case 'ATTENTION': {
        const at = R.attention(lim, t);
        return { ok: true, verb: 'ATTENTION', result: at, text: at.map(a => `[${a.score}] ${a.name} — ${a.reasons.join(', ')}`).join('\n') };
      }
      case 'ECONOMICS': case 'EXPOSURE': {
        const ec = R.economics(t);
        return { ok: true, verb: 'ECONOMICS', result: ec, confidence: ec.confidence,
          text: `exposure: $${ec.exposure.toLocaleString()}\n` + ec.lines.map(l => `  ${l.goal}: $${l.valueAtRisk.toLocaleString()} at risk`).join('\n') };
      }
      case 'MEMORY': case 'TIMELINE': {
        const m = R.memory(t);
        return { ok: true, verb: 'MEMORY', result: m, text: `working: ${m.working.join('; ') || '—'}\nrecent events: ${m.short.length}\norganizational patterns: ${m.organizational.length}\ntypes: ${JSON.stringify(m.semantic)}` };
      }
      case 'GOALS': {
        const g = R.goalGraph(t);
        return { ok: true, verb: 'GOALS', result: g, text: g.map(x => x.name + (x.parents.length ? ' → ' + x.parents.join(',') : ' (top)')).join('\n') };
      }
      case 'VERIFY': {
        const Tx = T || (root && root.RealityTypes); const violations = Tx ? Tx.checkConstraints(R, t) : [];
        // light contradiction scan: same subject, differing status from different sources
        const contradictions = [];
        for (const o of snap.objects.values()) {
          const bySource = {}; (o._events || []).forEach(e => { const s = /\.blocked$/.test(e.type) ? 'blocked' : /\.(completed|done|merged|paid)$/.test(e.type) ? 'done' : /\.(started|opened|unblocked)$/.test(e.type) ? 'active' : null; if (s) bySource[e.source] = s; });
          const vals = new Set(Object.values(bySource)); if (Object.keys(bySource).length >= 2 && vals.size >= 2) contradictions.push({ subject: o.id, claims: bySource });
        }
        const ok = violations.filter(v => v.severity === 'error').length === 0 && contradictions.length === 0;
        const txt = [ok ? '✓ reality is consistent.' : '✗ inconsistencies found:',
          ...violations.map(v => `  [${v.severity}] ${v.message}`),
          ...contradictions.map(c => `  [conflict] ${c.subject}: ${Object.entries(c.claims).map(([s, val]) => s + '=' + val).join(' vs ')}`)].join('\n');
        return { ok: true, verb: 'VERIFY', result: { consistent: ok, violations, contradictions }, text: txt };
      }
      case 'INFER': {
        const Ix = INF || (root && root.RealityInference); if (!Ix) return { ok: false, text: 'inference engine not loaded.' };
        const { facts } = Ix.infer(R, t);
        return { ok: true, verb: 'INFER', result: facts, text: facts.length ? facts.map(f => `• ${f.label} (${Math.round(f.confidence * 100)}%)`).join('\n') : 'no facts inferred.' };
      }
      case 'REMEMBER': {
        const what = A.join(' '); if (!what) return { ok: false, text: 'usage: REMEMBER "<pattern note>"' };
        R.remember('note', what, what); return { ok: true, verb: 'REMEMBER', result: { stored: what }, text: 'remembered: ' + what };
      }
      case 'CAPABILITIES': {
        const Tx = T || (root && root.RealityTypes); const id = resolveId(R, snap, A[0]); const o = snap.objects.get(id);
        const ty = o ? o.type : (A[0] || '').toLowerCase(); const caps = Tx ? Tx.capabilities(ty) : [];
        return { ok: true, verb: 'CAPABILITIES', result: caps, text: `${ty} can: ${caps.join(', ') || '(none)'}` };
      }
      case 'LIFECYCLE': {
        const Tx = T || (root && root.RealityTypes); const ty = (A[0] || '').toLowerCase(); const lc = Tx ? Tx.lifecycleOf(ty) : null;
        return { ok: true, verb: 'LIFECYCLE', result: lc, text: lc ? `${ty}: ${Object.keys(lc.states).join(' → ')}` : `${ty} has no lifecycle.` };
      }
      case 'SHOW': {
        /* SHOW delayed projects CAUSED BY payment AFFECTING revenue NEXT 14 DAYS */
        const horizon = q.opts.nextDays ? Date.now() + q.opts.nextDays * DAY : null;
        let goals = R.byType(snap, 'goal').filter(g => g.status !== 'done');
        if (horizon) goals = goals.filter(g => !g.deadline || g.deadline <= horizon);
        const rows = [];
        for (const g of goals) {
          const p = R.predict(g.id, t); if (!p) continue;
          const atRisk = p.probability < 0.6;
          if (!atRisk) continue;
          const cc = R.causalChain(g.id, t);
          const chains = (cc && cc.chains) || [];
          let match = true;
          if (q.opts.causedBy) match = chains.some(c => c.chain.some(n => (n.label || '').toLowerCase().includes(String(q.opts.causedBy).toLowerCase())));
          if (match && q.opts.affecting) {
            const ec = R.economics(t);
            match = /revenue|value|money|cash/i.test(q.opts.affecting) ? ec.exposure > 0
              : ec.lines.some(l => l.goal.toLowerCase().includes(String(q.opts.affecting).toLowerCase()));
          }
          if (match) rows.push({ goal: g.name, onTime: Math.round(p.probability * 100), deadlineInDays: g.deadline ? Math.round((g.deadline - (t === Infinity ? Date.now() : t)) / DAY) : null,
            cause: chains[0] ? chains[0].chain.map(n => n.label).join(' → ') : '(no causal chain)' });
        }
        const clauses = [q.opts.causedBy ? 'CAUSED BY ' + q.opts.causedBy : null, q.opts.affecting ? 'AFFECTING ' + q.opts.affecting : null, q.opts.nextDays ? 'NEXT ' + q.opts.nextDays + ' DAYS' : null].filter(Boolean).join(' · ');
        return { ok: true, verb: 'SHOW', result: rows,
          text: (clauses ? '[' + clauses + ']\n' : '') + (rows.length ? rows.map(r => `• ${r.goal}: on-time ${r.onTime}%${r.deadlineInDays != null ? ', due in ' + r.deadlineInDays + 'd' : ''}\n    cause: ${r.cause}`).join('\n') : 'nothing matches those clauses.') };
      }
      case 'DEEP': case 'INSIGHT': {
        const Ux = UND || (root && root.RealityUnderstanding); if (!Ux) return { ok: false, text: 'understanding engine not loaded.' };
        const u = Ux.understand(R, t);
        return { ok: true, verb: 'DEEP', result: u, text: u.findings.map(f => `[${f.severity}] ${f.abstraction}: ${f.finding}`).join('\n') };
      }
      case 'HIRE': {
        /* SIMULATE-style: HIRE 3 engineers FOR 6 months  → uncertainty propagation */
        const Px = PROB || (root && root.RealityProbability); if (!Px) return { ok: false, text: 'probability layer not loaded.' };
        const n = parseInt(A[0], 10) || 1;
        const months = q.opts.forUnit && q.opts.forUnit.startsWith('month') ? (q.opts.forN || 6) : null;
        const goal = firstGoal(R, snap); const p = R.predict(goal, t);
        if (!p) return { ok: false, text: 'no goal to simulate against.' };
        const before = Px.propagate(({ d }) => d, { d: (r) => Px.pert(r, p.remaining * 0.6, p.remaining / Math.max(0.2, p.velocity), p.remaining * 2.2) }, 8000);
        const after = Px.propagate(({ d, boost }) => d / boost, { d: (r) => Px.pert(r, p.remaining * 0.6, p.remaining / Math.max(0.2, p.velocity), p.remaining * 2.2), boost: (r) => Px.normal(r, 1 + 0.28 * n, 0.10) }, 8000);
        const rampMonths = months ? ` (over ${months} month(s), ramp-up included)` : '';
        return { ok: true, verb: 'HIRE', result: { n, before, after },
          text: `hire ${n} engineer(s)${rampMonths}\n  days-to-finish p50 ${before.p50} → ${after.p50}  (p90 ${before.p90} → ${after.p90})\n  expected saving: ${(before.p50 - after.p50).toFixed(1)} days\n  [uncertainty propagated; ramp-up modelled as a noisy productivity boost]` };
      }
      case 'ABSTRACTIONS': case 'UNDERSTANDING': {
        const Ux = UND || (root && root.RealityUnderstand); if (!Ux) return { ok: false, text: 'understanding engine not loaded.' };
        const u = Ux.understand(R, t);
        return { ok: true, verb: 'ABSTRACTIONS', result: u.abstractions,
          text: u.abstractions.length ? u.abstractions.slice(0, lim).map(a => `[${a.kind}] sev ${a.severity} conf ${a.confidence}\n  ${a.statement}`).join('\n') : 'no higher-level structures detected.' };
      }
      case 'SHOW': {
        /* SHOW <selector> [CAUSED BY <term>] [AFFECTING <term>] [NEXT <n> DAYS] */
        const raw = q.args.join(' ');
        const causedBy = (/caused by ([^]*?)(?= affecting | next |$)/i.exec(raw) || [])[1];
        const affecting = (/affecting ([^]*?)(?= caused by | next |$)/i.exec(raw) || [])[1];
        const nextDays = (/next (\d+)/i.exec(raw) || [])[1];
        const selector = raw.replace(/caused by [^]*?(?= affecting | next |$)/i, '').replace(/affecting [^]*?(?= caused by | next |$)/i, '').replace(/next \d+ days?/i, '').trim().toLowerCase();

        let items = [...snap.objects.values()];
        if (/delayed|at risk|blocked/.test(selector)) {
          const risks = new Set(R.understand(t).risks.flatMap(rk => rk.evidence.objects));
          items = items.filter(o => o.status === 'blocked' || risks.has(o.id));
        } else if (selector && selector !== 'all' && selector !== '*') {
          items = items.filter(o => o.type === selector.replace(/s$/, '') || (o.name || '').toLowerCase().includes(selector.split(' ')[0]));
        }
        if (causedBy) { const term = causedBy.trim().toLowerCase();
          items = items.filter(o => (o.blockReason || '').toLowerCase().includes(term) || (o.name || '').toLowerCase().includes(term)
            || snap.rels.some(rr => rr.to === o.id && (snap.objects.get(rr.from)?.name || '').toLowerCase().includes(term))); }
        if (affecting) { const term = affecting.trim().toLowerCase();
          items = items.filter(o => { const g = R.intentOf(o.id, snap); return g && ((g.name || '').toLowerCase().includes(term) || (term === 'revenue' && (g.businessValue || 0) > 0)); }); }
        if (nextDays) { const horizon = (t === Infinity ? Date.now() : t) + (+nextDays) * DAY;
          items = items.filter(o => { const g = R.intentOf(o.id, snap); return g && g.deadline && g.deadline <= horizon; }); }
        items = items.slice(0, lim);
        return { ok: true, verb: 'SHOW', result: items.map(o => ({ id: o.id, name: o.name, status: o.status })),
          text: items.length ? items.map(o => `• ${o.name || o.id} [${o.type}] — ${o.status}${o.blockReason ? ' (' + o.blockReason + ')' : ''}`).join('\n') : 'nothing matches that query.' };
      }
      default:
        return { ok: false, text: `unknown verb "${q.verb}". Try: OBSERVE, UNDERSTAND, EXPLAIN, PREDICT, SIMULATE, DECIDE, COORDINATE, CAUSE, ATTENTION, ECONOMICS, MEMORY, GOALS.` };
    }
  }

  const API = { tokenize, parse, execute,
    VERBS: ['OBSERVE', 'UNDERSTAND', 'EXPLAIN', 'WHY', 'PREDICT', 'SIMULATE', 'DECIDE', 'COORDINATE', 'CAUSE', 'ATTENTION', 'ECONOMICS', 'MEMORY', 'GOALS', 'VERIFY', 'INFER', 'REMEMBER', 'CAPABILITIES', 'LIFECYCLE', 'SHOW', 'DEEP', 'INSIGHT', 'HIRE'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityQL = API;
})(typeof window !== 'undefined' ? window : this);
