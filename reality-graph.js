/* =====================================================================
   RealityOS — Graph Layer (reality-graph.js)
   "Reality is a graph evolving through time." Every query becomes graph
   traversal. Pure mathematics, no AI.
     BFS · DFS · Topological Sort · Shortest Path (Dijkstra) ·
     Cycle Detection · Tarjan SCC · Betweenness Centrality (Brandes) ·
     Critical Path (CPM: ES/EF/LS/LF, slack, float) ·
     Max-Flow / Min-Cut (Edmonds-Karp) · Community Detection (label prop)
   ===================================================================== */
(function (root) {

  /* ---------- adjacency helpers ---------- */
  function adjacency(nodes, edges, directed = true) {
    const adj = new Map(nodes.map(n => [n, []]));
    for (const e of edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      if (!adj.has(e.to)) adj.set(e.to, []);
      adj.get(e.from).push({ to: e.to, w: e.w == null ? 1 : e.w });
      if (!directed) adj.get(e.to).push({ to: e.from, w: e.w == null ? 1 : e.w });
    }
    return adj;
  }

  /* ---------- BFS / DFS ---------- */
  function bfs(nodes, edges, start) {
    const adj = adjacency(nodes, edges); const dist = new Map([[start, 0]]); const order = [start]; const q = [start];
    while (q.length) { const u = q.shift(); for (const { to } of adj.get(u) || []) if (!dist.has(to)) { dist.set(to, dist.get(u) + 1); order.push(to); q.push(to); } }
    return { order, dist };
  }
  function dfs(nodes, edges, start) {
    const adj = adjacency(nodes, edges); const seen = new Set(); const order = [];
    (function go(u) { if (seen.has(u)) return; seen.add(u); order.push(u); for (const { to } of adj.get(u) || []) go(to); })(start);
    return order;
  }

  /* ---------- Topological sort (Kahn) — returns null if cyclic ---------- */
  function topoSort(nodes, edges) {
    const adj = adjacency(nodes, edges); const indeg = new Map(nodes.map(n => [n, 0]));
    edges.forEach(e => indeg.set(e.to, (indeg.get(e.to) || 0) + 1));
    const q = nodes.filter(n => (indeg.get(n) || 0) === 0); const out = [];
    while (q.length) { const u = q.shift(); out.push(u); for (const { to } of adj.get(u) || []) { indeg.set(to, indeg.get(to) - 1); if (indeg.get(to) === 0) q.push(to); } }
    return out.length === nodes.length ? out : null;
  }

  /* ---------- Cycle detection ---------- */
  function findCycles(nodes, edges) {
    const adj = adjacency(nodes, edges); const color = new Map(nodes.map(n => [n, 0])); const cycles = []; const stack = [];
    function go(u) {
      color.set(u, 1); stack.push(u);
      for (const { to } of adj.get(u) || []) {
        if (color.get(to) === 1) { const i = stack.indexOf(to); cycles.push([...stack.slice(i), to]); }
        else if (color.get(to) === 0) go(to);
      }
      stack.pop(); color.set(u, 2);
    }
    nodes.forEach(n => { if (color.get(n) === 0) go(n); });
    return cycles;
  }

  /* ---------- Dijkstra shortest path ---------- */
  function shortestPath(nodes, edges, src, dst) {
    const adj = adjacency(nodes, edges); const dist = new Map(nodes.map(n => [n, Infinity])); const prev = new Map();
    dist.set(src, 0); const pq = [[0, src]];
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]); const [d, u] = pq.shift();
      if (d > dist.get(u)) continue;
      for (const { to, w } of adj.get(u) || []) { const nd = d + w; if (nd < dist.get(to)) { dist.set(to, nd); prev.set(to, u); pq.push([nd, to]); } }
    }
    if (!isFinite(dist.get(dst))) return { path: [], cost: Infinity };
    const path = [dst]; let c = dst; while (prev.has(c)) { c = prev.get(c); path.unshift(c); }
    return { path, cost: dist.get(dst) };
  }

  /* ---------- Tarjan Strongly Connected Components ---------- */
  function scc(nodes, edges) {
    const adj = adjacency(nodes, edges); let idx = 0; const index = new Map(), low = new Map(), onStack = new Set(), st = [], out = [];
    function go(u) {
      index.set(u, idx); low.set(u, idx); idx++; st.push(u); onStack.add(u);
      for (const { to } of adj.get(u) || []) {
        if (!index.has(to)) { go(to); low.set(u, Math.min(low.get(u), low.get(to))); }
        else if (onStack.has(to)) low.set(u, Math.min(low.get(u), index.get(to)));
      }
      if (low.get(u) === index.get(u)) { const comp = []; let w; do { w = st.pop(); onStack.delete(w); comp.push(w); } while (w !== u); out.push(comp); }
    }
    nodes.forEach(n => { if (!index.has(n)) go(n); });
    return out;
  }

  /* ---------- Betweenness centrality (Brandes) — who is the true bottleneck ---------- */
  function betweenness(nodes, edges, directed = true) {
    const adj = adjacency(nodes, edges, directed); const CB = new Map(nodes.map(n => [n, 0]));
    for (const s of nodes) {
      const S = [], P = new Map(nodes.map(n => [n, []])), sigma = new Map(nodes.map(n => [n, 0])), d = new Map(nodes.map(n => [n, -1]));
      sigma.set(s, 1); d.set(s, 0); const Q = [s];
      while (Q.length) { const v = Q.shift(); S.push(v);
        for (const { to: w } of adj.get(v) || []) {
          if (d.get(w) < 0) { d.set(w, d.get(v) + 1); Q.push(w); }
          if (d.get(w) === d.get(v) + 1) { sigma.set(w, sigma.get(w) + sigma.get(v)); P.get(w).push(v); }
        } }
      const delta = new Map(nodes.map(n => [n, 0]));
      while (S.length) { const w = S.pop(); for (const v of P.get(w)) delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
        if (w !== s) CB.set(w, CB.get(w) + delta.get(w)); }
    }
    const scale = directed ? 1 : 0.5;
    return [...CB.entries()].map(([id, score]) => ({ id, score: +(score * scale).toFixed(3) })).sort((a, b) => b.score - a.score);
  }

  /* ---------- Critical Path Method: the chain that causes maximum delay ---------- */
  /* tasks: [{id, duration, deps:[id]}] */
  function criticalPath(tasks) {
    const byId = new Map(tasks.map(t => [t.id, t]));
    const nodes = tasks.map(t => t.id);
    const edges = tasks.flatMap(t => (t.deps || []).map(d => ({ from: d, to: t.id })));
    const order = topoSort(nodes, edges);
    if (!order) return { error: 'cycle in dependencies', cycles: findCycles(nodes, edges) };
    const ES = new Map(), EF = new Map();
    for (const id of order) { const t = byId.get(id); const es = Math.max(0, ...(t.deps || []).map(d => EF.get(d) || 0)); ES.set(id, es); EF.set(id, es + t.duration); }
    const projectEnd = Math.max(...[...EF.values()]);
    const LF = new Map(), LS = new Map();
    const succ = new Map(nodes.map(n => [n, []])); edges.forEach(e => succ.get(e.from).push(e.to));
    for (const id of [...order].reverse()) { const t = byId.get(id); const s = succ.get(id); const lf = s.length ? Math.min(...s.map(x => LS.get(x))) : projectEnd; LF.set(id, lf); LS.set(id, lf - t.duration); }
    const EPS = 1e-9;
    const detail = nodes.map(id => ({ id, ES: +ES.get(id).toFixed(6), EF: +EF.get(id).toFixed(6), LS: +LS.get(id).toFixed(6), LF: +LF.get(id).toFixed(6), slack: +(LS.get(id) - ES.get(id)).toFixed(6) }));
    const critical = detail.filter(d => Math.abs(d.slack) < EPS).map(d => d.id);
    // order the critical chain topologically
    const chain = order.filter(id => critical.includes(id));
    return { projectEnd: +projectEnd.toFixed(6), chain, detail };
  }

  /* ---------- Max-Flow / Min-Cut (Edmonds-Karp) — where capacity truly binds ---------- */
  function maxFlow(nodes, edges, s, t) {
    const cap = new Map(); const adj = new Map(nodes.map(n => [n, new Set()]));
    const key = (a, b) => a + '\u0000' + b;
    for (const e of edges) { cap.set(key(e.from, e.to), (cap.get(key(e.from, e.to)) || 0) + (e.cap == null ? 1 : e.cap)); adj.get(e.from).add(e.to); adj.get(e.to).add(e.from); if (!cap.has(key(e.to, e.from))) cap.set(key(e.to, e.from), 0); }
    let flow = 0;
    while (true) {
      const prev = new Map([[s, null]]); const q = [s];
      while (q.length && !prev.has(t)) { const u = q.shift(); for (const v of adj.get(u) || []) if (!prev.has(v) && (cap.get(key(u, v)) || 0) > 0) { prev.set(v, u); q.push(v); } }
      if (!prev.has(t)) break;
      let bott = Infinity; for (let v = t; prev.get(v) != null; v = prev.get(v)) bott = Math.min(bott, cap.get(key(prev.get(v), v)));
      for (let v = t; prev.get(v) != null; v = prev.get(v)) { const u = prev.get(v); cap.set(key(u, v), cap.get(key(u, v)) - bott); cap.set(key(v, u), (cap.get(key(v, u)) || 0) + bott); }
      flow += bott;
    }
    // min cut = reachable set in residual graph
    const seen = new Set([s]); const q2 = [s];
    while (q2.length) { const u = q2.shift(); for (const v of adj.get(u) || []) if (!seen.has(v) && (cap.get(key(u, v)) || 0) > 0) { seen.add(v); q2.push(v); } }
    const cut = edges.filter(e => seen.has(e.from) && !seen.has(e.to));
    return { maxFlow: flow, minCut: cut.map(e => `${e.from} → ${e.to}`) };
  }

  /* ---------- Community detection (label propagation) ---------- */
  function communities(nodes, edges) {
    const adj = adjacency(nodes, edges, false); const label = new Map(nodes.map((n, i) => [n, i]));
    for (let it = 0; it < 20; it++) {
      let changed = false;
      for (const n of nodes) {
        const counts = {}; for (const { to } of adj.get(n) || []) counts[label.get(to)] = (counts[label.get(to)] || 0) + 1;
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (best && +best[0] !== label.get(n)) { label.set(n, +best[0]); changed = true; }
      }
      if (!changed) break;
    }
    const groups = {}; nodes.forEach(n => (groups[label.get(n)] = groups[label.get(n)] || []).push(n));
    return Object.values(groups);
  }


  /* ---------- Articulation points (single points of failure) ---------- */
  function articulationPoints(nodes, edges) {
    const adj = adjacency(nodes, edges, false);
    const disc = new Map(), low = new Map(), parent = new Map(), ap = new Set(); let timer = 0;
    function go(u) {
      disc.set(u, timer); low.set(u, timer); timer++; let children = 0;
      for (const { to: v } of adj.get(u) || []) {
        if (!disc.has(v)) { children++; parent.set(v, u); go(v);
          low.set(u, Math.min(low.get(u), low.get(v)));
          if (parent.has(u) && low.get(v) >= disc.get(u)) ap.add(u);
        } else if (v !== parent.get(u)) low.set(u, Math.min(low.get(u), disc.get(v)));
      }
      if (!parent.has(u) && children > 1) ap.add(u);
    }
    nodes.forEach(n => { if (!disc.has(n)) go(n); });
    return [...ap];
  }

  /* ---------- concentration measures: Herfindahl (HHI) and Gini ---------- */
  function herfindahl(counts) { const t = counts.reduce((a, b) => a + b, 0); if (!t) return 0; return +counts.reduce((a, c) => a + (c / t) ** 2, 0).toFixed(4); }
  function gini(counts) {
    const s = [...counts].sort((a, b) => a - b), n = s.length, t = s.reduce((a, b) => a + b, 0);
    if (!n || !t) return 0;
    let cum = 0; s.forEach((v, i) => cum += (2 * (i + 1) - n - 1) * v);
    return +(cum / (n * t)).toFixed(4);
  }

  const API = { adjacency, bfs, dfs, topoSort, findCycles, shortestPath, scc, betweenness, criticalPath, maxFlow, communities, articulationPoints, herfindahl, gini };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityGraph = API;
})(typeof window !== 'undefined' ? window : this);
