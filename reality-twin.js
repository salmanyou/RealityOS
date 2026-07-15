/* =====================================================================
   RealityOS — Digital Twin Engine (reality-twin.js)
   Reality is LIVE, not a snapshot. Sources stream in continuously;
   the twin tracks freshness, detects DRIFT (twin vs source of truth),
   reconciles, and reports staleness so nobody trusts a dead mirror.
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const K = req ? require('./reality-kernel.js') : null;

  class DigitalTwin {
    constructor(kernel) { this.kernel = kernel; this.sources = new Map(); this.driftLog = []; }
    /* register a live source with an expected heartbeat (ms) */
    register(name, { heartbeatMs = 60000, reliability = 0.8 } = {}) {
      this.sources.set(name, { name, heartbeatMs, reliability, lastSeen: 0, events: 0 });
      if (this.kernel.setSourceReliability) this.kernel.setSourceReliability(name, reliability);
      return this;
    }
    /* ingest one observation from a source (this is the continuous sync) */
    sync(source, event, at = Date.now()) {
      const s = this.sources.get(source); if (!s) throw new Error('unregistered source: ' + source);
      s.lastSeen = at; s.events++;
      return this.kernel.record({ ...event, source, at });
    }
    /* freshness: which sources have gone quiet? */
    freshness(now = Date.now()) {
      return [...this.sources.values()].map(s => {
        const age = s.lastSeen ? now - s.lastSeen : Infinity;
        const stale = age > s.heartbeatMs * 2;
        return { source: s.name, events: s.events, ageMs: isFinite(age) ? age : null, stale, status: !s.lastSeen ? 'never seen' : stale ? 'STALE' : 'live' };
      });
    }
    /* drift: does the twin's derived state still match the source of truth? */
    detectDrift(expectedStateHash) {
      const actual = this.kernel.stateHash();
      const drifted = expectedStateHash != null && actual !== expectedStateHash;
      if (drifted) this.driftLog.push({ at: Date.now(), expected: expectedStateHash, actual });
      return { drifted, actual, expected: expectedStateHash };
    }
    /* reconcile: replay authoritative events to converge the twin */
    reconcile(authoritativeEvents = []) {
      const have = new Set(this.kernel.R.events.map(e => e.id));
      let applied = 0;
      for (const e of authoritativeEvents) if (!have.has(e.id)) { this.kernel.R.events.push(Object.freeze({ ...e })); applied++; }
      this.kernel.R.events.sort((a, b) => a.at - b.at);
      return { applied, stateHash: this.kernel.stateHash() };
    }
    health(now = Date.now()) {
      const f = this.freshness(now); const stale = f.filter(x => x.stale || x.status === 'never seen');
      return { live: f.length - stale.length, stale: stale.length, drifts: this.driftLog.length,
        trustworthy: stale.length === 0 && this.driftLog.length === 0, sources: f };
    }
  }
  const API = { DigitalTwin };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityTwin = DigitalTwin;
})(typeof window !== 'undefined' ? window : this);
