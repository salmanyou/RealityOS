/* =====================================================================
   RealityOS — Persistent Event Store
   Event sourcing on disk: an append-only `events` table is the source of
   truth; realities are rebuilt by replaying events. Two real drivers:
     • SqliteStore  — node:sqlite, zero-config local persistence (default)
     • PgStore      — node-postgres, production Postgres (set DATABASE_URL)
   Both expose the same async interface.
   ===================================================================== */

/* ---------- SQLite driver (built-in node:sqlite) ---------- */
class SqliteStore {
  constructor(path = process.env.REALITYOS_DB || './realityos.db') { this.path = path; }
  async init() {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(this.path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        id         TEXT NOT NULL,
        workspace  TEXT NOT NULL,
        type       TEXT NOT NULL,
        subject    TEXT NOT NULL,
        payload    TEXT NOT NULL DEFAULT '{}',
        at         INTEGER NOT NULL,
        source     TEXT NOT NULL DEFAULT 'manual'
      );
      CREATE INDEX IF NOT EXISTS idx_events_ws ON events(workspace, at);
      CREATE TABLE IF NOT EXISTS entitlements (
        email   TEXT PRIMARY KEY,
        plan    TEXT NOT NULL,
        status  TEXT NOT NULL,
        since   INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tenants (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        api_key       TEXT NOT NULL UNIQUE,
        github_secret TEXT NOT NULL DEFAULT '',
        created       INTEGER NOT NULL
      );
    `);
  }
  async createTenant(t) {
    this.db.prepare(`INSERT INTO tenants (id,name,api_key,github_secret,created) VALUES (?,?,?,?,?)`)
      .run(t.id, t.name, t.apiKey, t.githubSecret || '', t.created || Date.now());
    return t;
  }
  async tenantByKey(apiKey) { return this.db.prepare(`SELECT id,name,api_key,github_secret FROM tenants WHERE api_key=?`).get(apiKey) || null; }
  async tenantById(id) { return this.db.prepare(`SELECT id,name,api_key,github_secret FROM tenants WHERE id=?`).get(id) || null; }
  async listTenants() { return this.db.prepare(`SELECT id,name FROM tenants`).all(); }
  async append(ws, ev) {
    this.db.prepare(`INSERT INTO events (id,workspace,type,subject,payload,at,source)
      VALUES (?,?,?,?,?,?,?)`).run(ev.id, ws, ev.type, ev.subject, JSON.stringify(ev.payload || {}), ev.at, ev.source || 'manual');
  }
  async loadWorkspaces() {
    return this.db.prepare(`SELECT DISTINCT workspace FROM events`).all().map(r => r.workspace);
  }
  async loadEvents(ws) {
    return this.db.prepare(`SELECT id,type,subject,payload,at,source FROM events WHERE workspace=? ORDER BY at, seq`)
      .all(ws).map(r => ({ id: r.id, type: r.type, subject: r.subject, payload: JSON.parse(r.payload), at: r.at, source: r.source }));
  }
  async setEntitlement(email, d) {
    this.db.prepare(`INSERT INTO entitlements (email,plan,status,since) VALUES (?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET plan=excluded.plan, status=excluded.status, since=excluded.since`)
      .run(email, d.plan, d.status, d.since || Date.now());
  }
  async getEntitlement(email) {
    const r = this.db.prepare(`SELECT plan,status,since FROM entitlements WHERE email=?`).get(email);
    return r || { plan: 'free', status: 'none' };
  }
  async close() { this.db?.close(); }
}

/* ---------- Postgres driver (production) ---------- */
class PgStore {
  constructor(url = process.env.DATABASE_URL) { this.url = url; }
  async init() {
    const { Pool } = require('pg');
    this.pool = new Pool({ connectionString: this.url, ssl: process.env.PGSSL ? { rejectUnauthorized: false } : undefined });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        seq        BIGSERIAL PRIMARY KEY,
        id         TEXT NOT NULL,
        workspace  TEXT NOT NULL,
        type       TEXT NOT NULL,
        subject    TEXT NOT NULL,
        payload    JSONB NOT NULL DEFAULT '{}',
        at         BIGINT NOT NULL,
        source     TEXT NOT NULL DEFAULT 'manual'
      );
      CREATE INDEX IF NOT EXISTS idx_events_ws ON events(workspace, at);
      CREATE TABLE IF NOT EXISTS entitlements (
        email   TEXT PRIMARY KEY,
        plan    TEXT NOT NULL,
        status  TEXT NOT NULL,
        since   BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tenants (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        api_key       TEXT NOT NULL UNIQUE,
        github_secret TEXT NOT NULL DEFAULT '',
        created       BIGINT NOT NULL
      );`);
  }
  async createTenant(t) {
    await this.pool.query(`INSERT INTO tenants (id,name,api_key,github_secret,created) VALUES ($1,$2,$3,$4,$5)`,
      [t.id, t.name, t.apiKey, t.githubSecret || '', t.created || Date.now()]);
    return t;
  }
  async tenantByKey(apiKey) { const { rows } = await this.pool.query(`SELECT id,name,api_key,github_secret FROM tenants WHERE api_key=$1`, [apiKey]); return rows[0] || null; }
  async tenantById(id) { const { rows } = await this.pool.query(`SELECT id,name,api_key,github_secret FROM tenants WHERE id=$1`, [id]); return rows[0] || null; }
  async listTenants() { const { rows } = await this.pool.query(`SELECT id,name FROM tenants`); return rows; }
  async append(ws, ev) {
    await this.pool.query(
      `INSERT INTO events (id,workspace,type,subject,payload,at,source) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ev.id, ws, ev.type, ev.subject, JSON.stringify(ev.payload || {}), ev.at, ev.source || 'manual']);
  }
  async loadWorkspaces() {
    const { rows } = await this.pool.query(`SELECT DISTINCT workspace FROM events`);
    return rows.map(r => r.workspace);
  }
  async loadEvents(ws) {
    const { rows } = await this.pool.query(
      `SELECT id,type,subject,payload,at,source FROM events WHERE workspace=$1 ORDER BY at, seq`, [ws]);
    return rows.map(r => ({ id: r.id, type: r.type, subject: r.subject,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload, at: Number(r.at), source: r.source }));
  }
  async setEntitlement(email, d) {
    await this.pool.query(
      `INSERT INTO entitlements (email,plan,status,since) VALUES ($1,$2,$3,$4)
       ON CONFLICT(email) DO UPDATE SET plan=$2,status=$3,since=$4`,
      [email, d.plan, d.status, d.since || Date.now()]);
  }
  async getEntitlement(email) {
    const { rows } = await this.pool.query(`SELECT plan,status,since FROM entitlements WHERE email=$1`, [email]);
    return rows[0] || { plan: 'free', status: 'none' };
  }
  async close() { await this.pool?.end(); }
}

/* ---------- factory ---------- */
function createStore() {
  if (process.env.DATABASE_URL) return new PgStore();
  return new SqliteStore();
}

module.exports = { SqliteStore, PgStore, createStore };
