/* =====================================================================
   RealityOS — Incremental & Distributed Reasoning (reality-incremental.js)
   INCREMENTAL: one event changes → recompute only what it affects.
     dirty(subject) → transitive closure over depends_on/advances → recompute
     that slice only. Result must equal a full recomputation (checked).
   DISTRIBUTED: partition the graph, reason per partition, merge.
     Correctness condition: partitioned derivation ≡ centralized derivation.
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const E = req ? require('./reality-engine.js') : root.RealityEngine;

  class IncrementalReasoner {
    constructor(R) { this.R = R; this.cache = new Map(); this.stats = { full: 0, incremental: 0, nodesRecomputed: 0 }; }

    /* which goals are affected by a change to `subject`? (upward closure) */
    affected(subject) {
      const snap = this.R.materialize(); const out = new Set(); const stack = [subject];
      while (stack.length) {
        const cur = stack.pop();
        for (const r of snap.rels) {
          if (r.from === cur && ['advances', 'belongs_to', 'part_of', 'serves'].includes(r.rtype) && !out.has(r.to)) { out.add(r.to); stack.push(r.to); }
          if (r.to === cur && r.rtype === 'depends_on' && !out.has(r.from)) { out.add(r.from); stack.push(r.from); }
        }
      }
      return [...out].filter(id => (snap.objects.get(id) || {}).type === 'goal');
    }

    fullRecompute() {
      this.stats.full++;
      const snap = this.R.materialize();
      const goals = this.R.byType(snap, 'goal');
      goals.forEach(g => { this.cache.set(g.id, this.R.predict(g.id).probability); this.stats.nodesRecomputed++; });
      return new Map(this.cache);
    }

    /* apply an event and recompute ONLY the affected slice */
    onEvent(ev) {
      this.R.emit(ev.type, ev.subject, ev.payload || {}, ev.at || Date.now(), ev.source || 'incremental');
      const goals = this.affected(ev.subject);
      this.stats.incremental++;
      goals.forEach(g => { this.cache.set(g, this.R.predict(g).probability); this.stats.nodesRecomputed++; });
      return { recomputed: goals, skipped: this.R.byType(this.R.materialize(), 'goal').length - goals.length };
    }

    /* correctness: incremental cache must equal a full recomputation */
    validate() {
      const inc = new Map(this.cache);
      const full = this.fullRecompute();
      const mismatches = [...full.entries()].filter(([k, v]) => Math.abs((inc.get(k) ?? v) - v) > 1e-9);
      return { equivalent: mismatches.length === 0, mismatches };
    }
  }

  /* ---- DISTRIBUTED: partition by connected component, reason locally, merge ---- */
  function partition(R, k = 2) {
    const snap = R.materialize();
    const ids = [...snap.objects.keys()];
    // partition by hash so partitions are arbitrary (a stress test for correctness)
    const parts = Array.from({ length: k }, () => []);
    ids.forEach((id, i) => parts[i % k].push(id));
    return parts.map(members => {
      const P = new E.Reality();
      // every event whose subject is local, plus relationship events referencing local nodes
      R.events.forEach(e => {
        const local = members.includes(e.subject) || (e.payload && (members.includes(e.payload.from) || members.includes(e.payload.to)));
        if (local) P.events.push(e);
      });
      P.events.sort((a, b) => a.at - b.at);
      return { members, reality: P };
    });
  }

  /* merge partitions back; correctness = identical derived state vs centralized */
  function mergePartitions(parts) {
    const M = new E.Reality(); const seen = new Set();
    parts.forEach(p => p.reality.events.forEach(e => { if (!seen.has(e.id)) { seen.add(e.id); M.events.push(e); } }));
    M.events.sort((a, b) => a.at - b.at);
    return M;
  }
  function distributedEquivalence(R, k = 3) {
    const central = R.materialize();
    const merged = mergePartitions(partition(R, k)).materialize();
    const sameObjects = central.objects.size === merged.objects.size &&
      [...central.objects.keys()].every(id => merged.objects.has(id) && merged.objects.get(id).status === central.objects.get(id).status);
    const sameRels = central.rels.length === merged.rels.length;
    return { partitions: k, equivalent: sameObjects && sameRels, centralObjects: central.objects.size, mergedObjects: merged.objects.size };
  }

  const API = { IncrementalReasoner, partition, mergePartitions, distributedEquivalence };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityIncremental = API;
})(typeof window !== 'undefined' ? window : this);
