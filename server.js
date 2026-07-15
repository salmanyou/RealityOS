/* =====================================================================
   RealityOS — Backend (Node + Express) — MULTI-TENANT
   - Persistent event store (SQLite local / Postgres prod) = source of truth
   - Strict tenant isolation: every request is scoped to its tenant's
     workspace; one team's data can never touch another's.
   - Per-tenant API keys + per-tenant GitHub webhook secrets
   - Rate limiting + audit log
   - Evidence Loop endpoint (/v1/accuracy)
   Provision a pilot team:  POST /admin/tenant  (X-Admin-Key: $REALITYOS_ADMIN_KEY)
   Run:  npm install && npm start
   ===================================================================== */
const express = require('express');
const crypto = require('crypto');
const { Reality, seed, isA } = require('./reality-engine.js');
const { createStore } = require('./db.js');
const { githubToOps, applyOps, verifyGithub } = require('./adapters/github.js');
const QL = require('./realityql.js');
const { Kernel } = require('./reality-kernel.js');
const FB = require('./reality-feedback.js');

const app = express();
const PORT = process.env.PORT || 8787;
const store = createStore();
const ADMIN_KEY = process.env.REALITYOS_ADMIN_KEY || 'admin_dev_key';
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || '';
const PRICE_TO_PLAN = {
  [process.env.PADDLE_PRICE_PRO || 'pri_REPLACE_pro_monthly']: 'pro',
  [process.env.PADDLE_PRICE_BUSINESS || 'pri_REPLACE_business_monthly']: 'business',
};

/* ---- in-memory materialized realities, keyed by tenant id (= workspace) ---- */
const realities = new Map();
function realityFor(ws) { if (!realities.has(ws)) { const r = new Reality(); r.isA = isA; realities.set(ws, r); } return realities.get(ws); }
async function persistNew(ws, R, haveIds) { const fresh = R.events.filter(e => !haveIds.has(e.id)).sort((a, b) => a.at - b.at); for (const ev of fresh) await store.append(ws, ev); return fresh.length; }

/* ---- rate limiting (per key, token bucket) ---- */
const buckets = new Map();
function rateLimit(key, perMin = 120) {
  const now = Date.now(); const b = buckets.get(key) || { tokens: perMin, ts: now };
  b.tokens = Math.min(perMin, b.tokens + ((now - b.ts) / 60000) * perMin); b.ts = now;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1; buckets.set(key, b); return true;
}

/* ---- audit log (in-memory ring; swap for a table/SIEM in production) ---- */
const audit = []; function logAccess(tenantId, method, path) { audit.push({ tenantId, method, path, at: Date.now() }); if (audit.length > 1000) audit.shift(); }

/* ---- AUTH: resolve tenant from API key; scope everything to it ---- */
async function auth(req, res, next) {
  const key = (req.headers.authorization || '').replace('Bearer ', '') || req.header('X-API-Key') || '';
  const tenant = key ? await store.tenantByKey(key) : null;
  if (!tenant) return res.status(401).json({ error: 'invalid_or_missing_api_key' });
  if (!rateLimit(key)) return res.status(429).json({ error: 'rate_limited' });
  req.tenant = tenant; req.ws = tenant.id;          // workspace is ALWAYS the tenant id (client cannot override)
  logAccess(tenant.id, req.method, req.path);
  next();
}

/* =====================================================================
   ADMIN: provision a pilot team (returns its API key + GitHub webhook secret)
   ===================================================================== */
app.post('/admin/tenant', express.json(), async (req, res) => {
  if (req.header('X-Admin-Key') !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const name = (req.body && req.body.name) || 'Team';
  const id = 'ws_' + crypto.randomBytes(5).toString('hex');
  const apiKey = 'rk_live_' + crypto.randomBytes(16).toString('hex');
  const githubSecret = crypto.randomBytes(16).toString('hex');
  await store.createTenant({ id, name, apiKey, githubSecret, created: Date.now() });
  realityFor(id);
  res.json({ ok: true, tenant: { id, name }, apiKey, githubWebhook: `/webhook/github/${id}`, githubSecret,
    note: 'Store the apiKey securely. Add a GitHub webhook to the URL above with the githubSecret.' });
});

/* =====================================================================
   TENANT-SCOPED API  (all routes below require a valid tenant key)
   ===================================================================== */
app.post('/v1/ingest', auth, express.json(), async (req, res) => {
  const { type, subject, payload = {}, at } = req.body || {};
  if (!type || !subject) return res.status(400).json({ error: 'type_and_subject_required' });
  const R = realityFor(req.ws); const ev = R.emit(type, subject, payload, at || Date.now(), 'api');
  await store.append(req.ws, ev); const u = R.understand();
  res.json({ ok: true, event: ev.id, risks: u.risks.length, top_risk: u.risks[0] || null });
});

app.get('/v1/reality/understand', auth, (req, res) => res.json(realityFor(req.ws).understand()));
app.get('/v1/reality/predict', auth, (req, res) => res.json(realityFor(req.ws).predict(req.query.goal) || { error: 'goal_not_found' }));
app.get('/v1/reality/decide', auth, (req, res) => res.json(realityFor(req.ws).decide()));
app.get('/v1/reality/state', auth, (req, res) => { const s = realityFor(req.ws).materialize(); res.json({ tenant: req.tenant.name, objects: s.objects.size, relationships: s.rels.length, types: [...new Set([...s.objects.values()].map(o => o.type))] }); });

app.post('/v1/ql', auth, express.json(), (req, res) => { const R = realityFor(req.ws); R.isA = isA; res.json(QL.execute(R, String(req.body.query || ''))); });

app.post('/v1/kernel/record', auth, express.json(), async (req, res) => {
  const R = realityFor(req.ws); const k = new Kernel(R); const trace = k.record(req.body.event || {});
  if (trace.event) await store.append(req.ws, { id: trace.event.id, type: trace.event.type, subject: trace.event.subject, payload: (req.body.event && req.body.event.payload) || {}, at: trace.event._t.event, source: trace.event.source });
  res.json({ ok: trace.ok, violations: trace.violations, inferred: trace.inferred, contradictions: trace.contradictions, predictions: trace.predictions });
});

app.get('/v1/verify', auth, (req, res) => res.json(new Kernel(realityFor(req.ws)).verify()));
app.get('/v1/export/ref', auth, (req, res) => res.json(new Kernel(realityFor(req.ws)).exportREF()));

/* Evidence Loop: record a prediction, score outcomes, report accuracy */
app.post('/v1/predictions/record', auth, express.json(), async (req, res) => {
  const R = realityFor(req.ws); const have = new Set(R.events.map(e => e.id));
  const rec = FB.recordPrediction(R, req.body.goal); await persistNew(req.ws, R, have);
  res.json({ ok: !!rec, prediction: rec });
});
app.post('/v1/predictions/score', auth, async (req, res) => {
  const R = realityFor(req.ws); const have = new Set(R.events.map(e => e.id));
  const scored = FB.scorePredictions(R); await persistNew(req.ws, R, have);
  res.json({ scored: scored.length, results: scored });
});
app.get('/v1/accuracy', auth, (req, res) => res.json(FB.accuracy(realityFor(req.ws))));
app.get('/v1/audit', auth, (req, res) => res.json(audit.filter(a => a.tenantId === req.ws).slice(-100)));

/* =====================================================================
   GITHUB WEBHOOK — per tenant:  /webhook/github/:tenant  (own secret)
   ===================================================================== */
app.post('/webhook/github/:tenant', express.raw({ type: 'application/json' }), async (req, res) => {
  const tenant = await store.tenantById(req.params.tenant);
  if (!tenant) return res.status(404).send('unknown tenant');
  if (!verifyGithub(req.body, req.header('X-Hub-Signature-256'), tenant.github_secret)) return res.status(401).send('invalid signature');
  const eventType = req.header('X-GitHub-Event'); const payload = JSON.parse(req.body.toString());
  const R = realityFor(tenant.id); const have = new Set(R.events.map(e => e.id));
  applyOps(R, githubToOps(eventType, payload)); const persisted = await persistNew(tenant.id, R, have);
  logAccess(tenant.id, 'WEBHOOK', 'github:' + eventType);
  console.log(`[github:${tenant.id}] ${eventType} -> ${persisted} event(s)`);
  res.json({ ok: true, github_event: eventType, ingested: persisted });
});

/* =====================================================================
   PADDLE WEBHOOK -> entitlements
   ===================================================================== */
function verifyPaddle(rawBody, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(';').map(kv => kv.split('=')));
  if (!parts.ts || !parts.h1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.ts}:${rawBody.toString()}`).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.h1)); } catch { return false; }
}
app.post('/webhook/paddle', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!verifyPaddle(req.body, req.header('Paddle-Signature'), PADDLE_WEBHOOK_SECRET)) return res.status(401).send('invalid signature');
  const event = JSON.parse(req.body.toString());
  if (event.event_type === 'transaction.completed' || event.event_type === 'transaction.paid') {
    const email = event.data?.customer?.email || event.data?.customer_id || 'unknown';
    const plan = PRICE_TO_PLAN[event.data?.items?.[0]?.price?.id] || 'pro';
    await store.setEntitlement(email, { plan, status: 'active', since: Date.now() });
  } else if (event.event_type === 'subscription.canceled') {
    const email = event.data?.customer?.email || 'unknown'; const cur = await store.getEntitlement(email);
    await store.setEntitlement(email, { ...cur, status: 'canceled' });
  }
  res.status(200).send('ok');
});

app.get('/', (_q, r) => r.send('RealityOS backend up (multi-tenant). Provision: POST /admin/tenant.'));

/* =====================================================================
   BOOT: rebuild every tenant's reality from the event log
   ===================================================================== */
(async function boot() {
  await store.init();
  // ensure a demo tenant exists (id "default", key "rk_live_demo") for local trials
  if (!(await store.tenantByKey('rk_live_demo'))) {
    await store.createTenant({ id: 'default', name: 'Demo', apiKey: 'rk_live_demo', githubSecret: process.env.GITHUB_WEBHOOK_SECRET || 'demo_secret', created: Date.now() });
  }
  const wss = await store.loadWorkspaces();
  if (!wss.includes('default')) { const R = seed(); for (const ev of R.events) await store.append('default', ev); realities.set('default', R); console.log('[boot] seeded demo "default" workspace'); }
  for (const ws of wss) { const evs = await store.loadEvents(ws); const R = Reality.fromJSON({ events: evs }); R.isA = isA; realities.set(ws, R); console.log(`[boot] rebuilt "${ws}" from ${evs.length} events`); }
  app.listen(PORT, () => console.log(`RealityOS backend (multi-tenant) on :${PORT}`));
})();
