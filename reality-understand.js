/* =====================================================================
   RealityOS — Understanding Engine (reality-understand.js)
   "A graph can tell you: payment blocks deployment.
    UNDERSTANDING means recognising: this organisation is becoming
    fragile; knowledge is concentrating in one engineer; these recurring
    delays all stem from a single process weakness."
   Discovers higher-level ABSTRACTIONS (not individual facts), each with
   evidence, a magnitude, and a confidence. Pure mathematics.
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const G = req ? require('./reality-graph.js') : root.RealityGraph;

  const abstraction = (kind, statement, severity, confidence, evidence, metric) =>
    ({ kind, statement, severity: +severity.toFixed(2), confidence: +confidence.toFixed(2), evidence, metric });

  function understand(R, t = Infinity) {
    const snap = R.materialize(t);
    const objects = [...snap.objects.values()];
    const work = objects.filter(o => ['task', 'code', 'project'].includes(o.type));
    const people = objects.filter(o => o.type === 'person');
    const out = [];

    /* ---- 1. KNOWLEDGE CONCENTRATION (bus factor) — Herfindahl + Gini over ownership ---- */
    if (people.length && work.length) {
      const ownedBy = {}; people.forEach(p => ownedBy[p.id] = 0);
      snap.rels.filter(r => r.rtype === 'owns').forEach(r => { if (ownedBy[r.from] !== undefined) ownedBy[r.from]++; });
      const counts = Object.values(ownedBy);
      const hhi = G.herfindahl(counts), gi = G.gini(counts);
      const total = counts.reduce((a, b) => a + b, 0);
      const sorted = Object.entries(ownedBy).sort((a, b) => b[1] - a[1]);
      const topShare = total ? sorted[0][1] / total : 0;
      // bus factor: min people covering >50% of work
      let acc = 0, bus = 0; for (const [, c] of sorted) { acc += c; bus++; if (acc > total / 2) break; }
      if (hhi > 0.30 || bus <= 1) {
        const who = snap.objects.get(sorted[0][0]);
        out.push(abstraction('knowledge_concentration',
          `Knowledge is concentrating in ${who ? who.name : sorted[0][0]} — bus factor ${bus}. Losing them stalls ${Math.round(topShare * 100)}% of active work.`,
          Math.min(1, hhi * 1.6), 0.8,
          { owner: sorted[0][0], ownedItems: sorted[0][1], totalItems: total },
          { herfindahl: hhi, gini: gi, busFactor: bus }));
      }
    }

    /* ---- 2. STRUCTURAL FRAGILITY — articulation points in the dependency graph ---- */
    /* dependencies hold between work ITEMS, not their container project */
    const nodes = work.filter(w => w.type !== 'project').map(w => w.id);
    const edges = snap.rels.filter(r => r.rtype === 'depends_on' && nodes.includes(r.from) && nodes.includes(r.to)).map(r => ({ from: r.from, to: r.to }));
    if (nodes.length >= 3 && edges.length) {
      const aps = G.articulationPoints(nodes, edges);
      const chainLike = edges.length / Math.max(1, nodes.length);          // ~1 = a chain, higher = a mesh
      if (aps.length) {
        const names = aps.map(id => (snap.objects.get(id) || {}).name || id);
        out.push(abstraction('structural_fragility',
          `The plan is fragile: ${aps.length} single point(s) of failure (${names.join(', ')}). Any one stalling severs the delivery path.`,
          Math.min(1, aps.length / Math.max(2, nodes.length) + 0.3), 0.78,
          { articulationPoints: aps, names },
          { pointsOfFailure: aps.length, edgeDensity: +chainLike.toFixed(2) }));
      }
      // EXACT test for a serial chain: no node has in-degree or out-degree > 1
      // (a diamond — two tasks feeding one — has in-degree 2 and is NOT a chain)
      const indeg = {}, outdeg = {};
      nodes.forEach(n => { indeg[n] = 0; outdeg[n] = 0; });
      edges.forEach(e => { outdeg[e.from]++; indeg[e.to]++; });
      const hasParallelism = nodes.some(n => indeg[n] > 1 || outdeg[n] > 1);
      const spansMost = edges.length >= nodes.length - 1;
      if (!hasParallelism && spansMost && nodes.length >= 4) {
        out.push(abstraction('over_optimised_for_speed',
          `Work is a serial chain with no parallel redundancy — optimised for speed, under-invested in resilience. One slip propagates end-to-end.`,
          0.6, 0.7, { nodes: nodes.length, edges: edges.length }, { edgesPerNode: +chainLike.toFixed(2) }));
      }
    }

    /* ---- 3. SYSTEMIC RECURRING ROOT CAUSE — cluster block reasons across history ---- */
    const blocks = R.events.filter(e => /\.blocked$/.test(e.type) && e.payload && e.payload.reason);
    if (blocks.length >= 2) {
      const norm = s => String(s).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 3);
      const groups = {};
      blocks.forEach(b => norm(b.payload.reason).forEach(w => (groups[w] = groups[w] || []).push(b)));
      const [word, hits] = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)[0] || [];
      if (hits && hits.length >= 2 && hits.length / blocks.length >= 0.5) {
        out.push(abstraction('systemic_process_weakness',
          `These delays are not independent: ${hits.length} of ${blocks.length} blockers trace to the same weakness ("${word}"). Fixing the process removes a class of failures, not one incident.`,
          Math.min(1, hits.length / blocks.length), 0.72,
          { recurringTerm: word, incidents: hits.map(h => h.subject) },
          { recurrence: +(hits.length / blocks.length).toFixed(2), totalBlockers: blocks.length }));
      }
    }

    /* ---- 4. OVERLOAD — one person owning several blocked items ---- */
    const load = {};
    snap.rels.filter(r => r.rtype === 'owns').forEach(r => { const w = snap.objects.get(r.to); if (w && w.status === 'blocked') (load[r.from] = load[r.from] || []).push(w); });
    Object.entries(load).filter(([, ws]) => ws.length >= 2).forEach(([pid, ws]) => {
      const p = snap.objects.get(pid);
      out.push(abstraction('overload',
        `${p ? p.name : pid} is carrying ${ws.length} blocked items — productivity degrades non-linearly beyond one blocked context.`,
        Math.min(1, ws.length / 3), 0.65, { person: pid, items: ws.map(w => w.id) }, { blockedOwned: ws.length }));
    });

    out.sort((a, b) => b.severity * b.confidence - a.severity * a.confidence);
    return { abstractions: out, scanned: { objects: objects.length, relationships: snap.rels.length, events: R.events.length } };
  }

  const API = { understand, abstraction };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityUnderstand = API;
})(typeof window !== 'undefined' ? window : this);
