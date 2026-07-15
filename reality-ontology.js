/* =====================================================================
   RealityOS — Self-Evolving Ontology (reality-ontology.js)
   Discovers CANDIDATE new object types and relationship abstractions by
   clustering objects on their structural signature (which relationships
   they participate in, which events happen to them).
   It PROPOSES; a human (or policy) adopts. Automatic ontology discovery
   is an open research problem — silent auto-adoption would be reckless.
   ===================================================================== */
(function (root) {
  const sig = o => o.rels.slice().sort().join(',') + '|' + o.evts.slice().sort().join(',');

  function signatures(R, t = Infinity) {
    const snap = R.materialize(t); const out = new Map();
    for (const o of snap.objects.values()) {
      const rels = [...new Set(snap.rels.filter(r => r.from === o.id).map(r => 'out:' + r.rtype)
        .concat(snap.rels.filter(r => r.to === o.id).map(r => 'in:' + r.rtype)))];
      const evts = [...new Set((o._events || []).map(e => e.type).filter(x => !/^object\.|^rel\./.test(x)))];
      out.set(o.id, { id: o.id, type: o.type, name: o.name, rels, evts });
    }
    return out;
  }

  /* propose new types: groups of same-signature objects whose declared type is vague ('entity'),
     or subtypes: same declared type but two clearly distinct signatures                        */
  function discover(R, { minCluster = 2, t } = {}) {
    const sigs = signatures(R, t);
    const byType = {};
    for (const o of sigs.values()) (byType[o.type] = byType[o.type] || []).push(o);
    const proposals = [];

    // (a) vague 'entity' objects that share a structure → propose a real type
    const vague = (byType['entity'] || []);
    const clusters = {};
    vague.forEach(o => (clusters[sig(o)] = clusters[sig(o)] || []).push(o));
    Object.entries(clusters).filter(([, g]) => g.length >= minCluster).forEach(([s, g]) => {
      proposals.push({ kind: 'new_type', evidence: g.map(o => o.id), signature: s, size: g.length,
        proposal: `${g.length} untyped objects share the structure [${g[0].rels.join(', ') || 'no relations'}] + events [${g[0].evts.join(', ') || 'none'}] — propose a new ontology type.`,
        confidence: +Math.min(0.85, 0.4 + g.length * 0.12).toFixed(2), status: 'proposed (requires review)' });
    });

    // (b) an existing type splitting into subtypes (two distinct signatures, each recurring)
    Object.entries(byType).forEach(([type, group]) => {
      if (type === 'entity' || group.length < 4) return;
      const c = {}; group.forEach(o => (c[sig(o)] = c[sig(o)] || []).push(o));
      const big = Object.entries(c).filter(([, g]) => g.length >= minCluster);
      if (big.length >= 2) proposals.push({ kind: 'subtype_split', baseType: type, clusters: big.map(([s, g]) => ({ size: g.length, members: g.map(x => x.id) })),
        proposal: `Type "${type}" contains ${big.length} structurally distinct groups — propose subtypes.`,
        confidence: 0.6, status: 'proposed (requires review)' });
    });

    // (c) relationship abstraction: a relation always co-occurring with another
    const snap = R.materialize(t); const pairs = {};
    snap.rels.forEach(a => snap.rels.filter(b => b.from === a.from && b !== a).forEach(b => { const k = [a.rtype, b.rtype].sort().join('+'); pairs[k] = (pairs[k] || 0) + 1; }));
    Object.entries(pairs).filter(([, n]) => n >= 3).slice(0, 2).forEach(([k, n]) =>
      proposals.push({ kind: 'relation_abstraction', pattern: k, occurrences: n,
        proposal: `Relations "${k.replace('+', '" and "')}" co-occur ${n}× — they may express one higher-level relation.`,
        confidence: +Math.min(0.7, 0.3 + n * 0.08).toFixed(2), status: 'proposed (requires review)' }));

    return { proposals, scanned: sigs.size, note: 'Proposals are never auto-adopted. Ontology evolution is an open research problem; a human or policy must accept.' };
  }
  const API = { discover, signatures };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityOntology = API;
})(typeof window !== 'undefined' ? window : this);
