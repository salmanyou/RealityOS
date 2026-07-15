/* =====================================================================
   RealityOS — App UI (drives the Reality Engine)
   ===================================================================== */
const { Reality, seed } = window.RealityEngine;
const $ = s => document.querySelector(s);
const DAY = 86400000, MEM = {}, SKEY = 'realityos:workspace';

/* ---- CONFIG: replace these with YOUR Paddle values to go live ---- */
const CONFIG = {
  support: 'support@stmzkinetic.com',
  paddle: {
    environment: 'sandbox',          // 'sandbox' while testing, 'production' when live
    clientToken: '',                 // Paddle > Developer tools > Authentication (client-side token)
    // create these in your Paddle dashboard (Catalog > Products/Prices), then paste the pri_... IDs:
    pricePro: 'pri_REPLACE_pro_monthly',
    priceBusiness: 'pri_REPLACE_business_monthly',
  }
};

/* ---- persistence: window.storage (Claude) -> localStorage (deployed) -> memory ---- */
const Store = {
  async get(k){ if(window.storage){try{const r=await window.storage.get(k);return r?JSON.parse(r.value):null;}catch{return null;}}
    try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return MEM[k]??null;} },
  async set(k,v){ if(window.storage){try{await window.storage.set(k,JSON.stringify(v));return;}catch{}}
    try{localStorage.setItem(k,JSON.stringify(v));}catch{MEM[k]=v;} },
  async del(k){ if(window.storage){try{await window.storage.delete(k);return;}catch{}}
    try{localStorage.removeItem(k);}catch{delete MEM[k];} }
};

let R = null, WS = { name:'', apiKey:'' }, TT = 0; // TT = days back for time machine
const asOf = () => TT === 0 ? Infinity : Date.now() - TT*DAY;
async function save(){ await Store.set(SKEY, { name:WS.name, apiKey:WS.apiKey, reality:R.toJSON() }); }

/* ---- helpers ---- */
const uid = p => p + Math.random().toString(36).slice(2,8);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
function fmtTime(at){ const d=Date.now()-at; const ad=Math.abs(d);
  if(ad<3600000) return d>=0?Math.max(1,Math.round(ad/60000))+'m ago':'in '+Math.round(ad/60000)+'m';
  if(ad<DAY) return (d>=0?'':'in ')+Math.round(ad/3600000)+'h'+(d>=0?' ago':'');
  return (d>=0?'':'in ')+Math.round(ad/DAY)+'d'+(d>=0?' ago':''); }
const TYPE_COLOR = {person:'var(--teal)',goal:'var(--amber)',project:'var(--violet)',task:'var(--text)',customer:'var(--green)',code:'var(--muted)'};
const tcolor = o => o.status==='blocked'?'var(--red)':(TYPE_COLOR[o.type]||'var(--faint)');

/* ============================================================ HOME */
function renderHome(){
  const t = asOf();
  $('#homeTitle').textContent = TT===0 ? 'Your reality, right now' : `Reality, ${TT} day(s) ago`;
  $('#ttLabel').textContent = TT===0 ? 'now' : `${TT}d ago`;
  $('#ttLabel').className = 'now' + (TT?' past':'');
  const snap = R.materialize(t);
  const u = R.understand(t);
  const evCount = R.events.filter(e=>e.at<=t).length;
  $('#kpiGrid').innerHTML = [
    ['Objects', snap.objects.size, ''],
    ['Events', evCount, ''],
    ['Relations', snap.rels.length, ''],
    ['Risks', u.risks.length, u.risks.length?'alert':'']
  ].map(([l,v,c])=>`<div class="kpi ${c}"><div class="kv">${v}</div><div class="kl">${l}</div></div>`).join('');

  $('#riskList').innerHTML = u.risks.length ? u.risks.map(r=>{
    const sev = r.probability>=.65?'var(--red)':'var(--amber)';
    return `<div class="risk" style="--sev:${sev}"><div class="rhead"><div class="rtitle">${r.title}</div>
      <div class="prob">${Math.round(r.probability*100)}%<small>risk</small></div></div>
      <div class="meter"><i style="width:${r.probability*100}%"></i></div><p class="why">${r.why}</p></div>`;
  }).join('') : `<div class="empty">No risks detected at this point in time.</div>`;

  const acts = R.decide(t);
  $('#decideList').innerHTML = acts.length ? acts.slice(0,3).map(a=>`
    <div class="act"><div class="at">${a.action}</div><div class="ar">${a.reason}</div>
      <div class="ax"><span class="lbl">expect</span><span>${a.expectedResult}</span></div>
      <div class="meta"><span>confidence ${Math.round(a.confidence*100)}%</span><span>impact ${a.impact}</span></div></div>`).join('')
    : `<div class="empty">Nothing needs a decision right now.</div>`;

  const evs = [...R.events].filter(e=>e.at<=t && e.type!=='object.created' && e.type!=='rel.created').sort((a,b)=>b.at-a.at).slice(0,8);
  $('#timeline').innerHTML = evs.length ? evs.map(e=>{
    const o = snap.objects.get(e.subject); const verb = e.type.split('.').pop();
    const dim = e.at < t-3*DAY;
    return `<div class="tev ${dim?'dim':''}"><div class="tt">${o?o.name||o.id:e.subject} · ${verb}${e.payload?.reason?` (${e.payload.reason})`:''}</div><div class="td">${new Date(e.at).toLocaleDateString()} · ${fmtTime(e.at)}</div></div>`;
  }).join('') : `<div class="empty">No events yet.</div>`;
}

/* ============================================================ OBJECTS */
let OBJ_TYPE = null;
function renderObjects(){
  const snap = R.materialize();
  const types = [...new Set([...snap.objects.values()].map(o=>o.type))];
  if(!OBJ_TYPE || !types.includes(OBJ_TYPE)) OBJ_TYPE = types[0];
  $('#typeSeg').innerHTML = types.length? types.map(ty=>`<button class="${ty===OBJ_TYPE?'on':''}" data-ty="${ty}">${ty}s</button>`).join('') : '';
  const list = [...snap.objects.values()].filter(o=>o.type===OBJ_TYPE);
  $('#objList').innerHTML = list.length ? list.map(o=>`
    <div class="obj" data-obj="${o.id}"><div class="dot" style="background:${tcolor(o)}"></div>
      <div class="om"><div class="ot">${o.name||o.id}</div><div class="od">${o.id}${o.deadline?` · due ${new Date(o.deadline).toLocaleDateString()}`:''}</div></div>
      <span class="badge ${o.status}">${o.status}</span></div>`).join('')
    : `<div class="empty">No ${OBJ_TYPE||'object'}s yet. Tap “+ Object”.</div>`;
}
function openContext(id){
  const snap = R.materialize();
  const ctx = R.context(id); if(!ctx) return;
  const o = ctx.object;
  const outRels = R.neighbors(snap,id,null,'out'), inRels = R.neighbors(snap,id,null,'in');
  const isTask = o.type==='task';
  $('#modal').innerHTML = `<div class="grabber"></div>
    <div class="mt">${o.name||o.id}<button class="x" data-close>✕</button></div>
    <div style="display:flex;gap:8px;margin-bottom:14px"><span class="badge ${o.status}">${o.status}</span>
      <span class="badge done" style="background:var(--panel-3);color:var(--muted)">${o.type}</span></div>
    ${isTask?`<div class="quickacts">
      <button data-ev="task.blocked" data-s="${id}">Block</button>
      <button data-ev="task.unblocked" data-s="${id}">Unblock</button>
      <button data-ev="task.started" data-s="${id}">Start</button>
      <button data-ev="task.completed" data-s="${id}">Complete</button></div>`:''}
    <div class="sectlabel" style="margin-top:10px"><span>Context — why</span></div>
    <ul class="ctxwhy">${ctx.why.length?ctx.why.map(w=>`<li>${w}</li>`).join(''):'<li>No notable context.</li>'}</ul>
    <div class="sectlabel"><span>Relationships</span></div>
    <ul class="ctxwhy">${[...outRels.map(x=>`<li>${o.name||id} <b style="color:var(--amber)">${x.rel.rtype}</b> ${x.node.name||x.node.id}</li>`),
       ...inRels.map(x=>`<li>${x.node.name||x.node.id} <b style="color:var(--amber)">${x.rel.rtype}</b> ${o.name||id}</li>`)].join('')||'<li>No relationships.</li>'}</ul>
    <div class="sectlabel"><span>History</span></div>
    <div class="tline">${o._events.slice(-6).reverse().map(e=>`<div class="tev"><div class="tt">${e.type.split('.').pop()}${e.payload?.reason?` (${e.payload.reason})`:''}</div><div class="td">${fmtTime(e.at)}</div></div>`).join('')||'<div class="empty">—</div>'}</div>`;
  openSheet();
}

/* ============================================================ REASON */
function suggestions(){ return ['What\'s at risk?','Why is QA pass stuck?','Will Ship Checkout v2 hit its date?','CAUSE goal:checkout','ATTENTION','ECONOMICS']; }
function suggestHTML(){ return `<div class="suggest">${suggestions().map(s=>`<button class="qchip" data-q="${s.replace(/"/g,'&quot;')}">${s}</button>`).join('')}</div>`; }
function initReason(){ $('#messages').innerHTML = `<div class="msg bot"><div class="answer"><p>I reason over your reality graph — <b>context</b> (why), <b>understanding</b> (risks), and <b>prediction</b> (what's coming). Ask in plain English, or type <b>RealityQL</b> like <span style="font-family:var(--mono);color:var(--violet)">PREDICT goal:checkout</span> or <span style="font-family:var(--mono);color:var(--violet)">CAUSE goal:checkout</span>.</p></div>${suggestHTML()}</div>`; }
function pushMsg(html,who){ const d=document.createElement('div'); d.className='msg '+who; d.innerHTML=html; $('#messages').appendChild(d); window.scrollTo(0,document.body.scrollHeight); }
function reason(q){
  const snap = R.materialize(); const t=q.toLowerCase();
  // object by name
  const obj = [...snap.objects.values()].find(o=>o.name && t.includes(o.name.toLowerCase().split(' ')[0]) && o.name.length>3);
  const goals = R.byType(snap,'goal');
  if(/bottleneck/.test(t)){ const b=R.understand().bottlenecks; return {html:b.length?`Main bottleneck: <b>${b[0].name}</b> — ${b[0].degree} active dependencies route through it. ${b.slice(1).map(x=>x.name).join(', ')} also load-bearing.`:`No bottleneck stands out yet.`,conf:.8}; }
  if(/risk|wrong|worried|danger/.test(t)){ const u=R.understand(); return {html:u.risks.length?`Top risk: <b>${u.risks[0].title.replace(/"/g,'')}</b> (${Math.round(u.risks[0].probability*100)}%). ${u.risks[0].why}`:`Nothing flagged as risk.`,conf:.82}; }
  if(/who|coordinate|align|act|assign/.test(t) && goals[0]){ const c=R.coordinate(goals[0].id); return {html:`To align <b>${goals[0].name}</b>:`,list:c.map(x=>`<b>${x.who}</b> → ${x.what} (${x.state}, ${x.priority})`),conf:.78}; }
  if(obj && obj.type==='goal'){ const p=R.predict(obj.id); return {html:`<b>${obj.name}</b> — on-time probability <b>${Math.round(p.probability*100)}%</b>.`,list:p.drivers,data:`projected finish in ~${Math.round((p.projectedDate-Date.now())/DAY)} days`,conf:.8}; }
  if(/predict|on time|ship|deadline|hit|late/.test(t) && goals[0]){ const p=R.predict(goals[0].id); return {html:`<b>${goals[0].name}</b> — on-time probability <b>${Math.round(p.probability*100)}%</b>.`,list:p.drivers,data:`projected finish in ~${Math.round((p.projectedDate-Date.now())/DAY)} days`,conf:.8}; }
  if(obj){ const c=R.context(obj.id); return {html:`<b>${obj.name}</b> is <b>${obj.status}</b>.`,list:c.why,conf:c.confidence}; }
  // fallback: understanding summary
  const u=R.understand(); return {html:`Your reality has <b>${snap.objects.size} objects</b>, <b>${snap.rels.length} relationships</b>, and <b>${u.risks.length} active risk(s)</b>. ${u.risks[0]?'Biggest: '+u.risks[0].title.replace(/"/g,'')+'.':''}`,conf:.6}; }
const QL_VERBS=(window.RealityQL&&window.RealityQL.VERBS)||['OBSERVE','UNDERSTAND','EXPLAIN','WHY','PREDICT','SIMULATE','DECIDE','COORDINATE','CAUSE','ATTENTION','ECONOMICS','MEMORY','GOALS','VERIFY','INFER','REMEMBER','CAPABILITIES','LIFECYCLE'];
function askReason(q){
  pushMsg(q,'user');
  // RealityQL: if the message starts with a QL verb, run the language
  const v=(q.trim().split(/\s+/)[0]||'').toUpperCase();
  if(window.RealityQL && QL_VERBS.includes(v)){
    if(R.isA===undefined) R.isA=window.RealityEngine.isA;
    const res=window.RealityQL.execute(R,q);
    const txt=(res.text||'(no result)').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    pushMsg(`<div class="answer"><div style="font-family:var(--mono);font-size:9px;letter-spacing:1px;color:var(--violet);text-transform:uppercase;margin-bottom:8px">RealityQL · ${v}</div><pre style="white-space:pre-wrap;margin:0;font-family:var(--mono);font-size:12.5px;line-height:1.55;color:var(--text)">${txt}</pre></div>`,'bot');
    return;
  }
  const ty=document.createElement('div'); ty.className='msg bot'; ty.innerHTML='<div class="typing"><span></span><span></span><span></span></div>';
  $('#messages').appendChild(ty); window.scrollTo(0,document.body.scrollHeight);
  setTimeout(()=>{ ty.remove(); const a=reason(q);
    const list=a.list&&a.list.length?`<ul>${a.list.map(x=>`<li>${x}</li>`).join('')}</ul>`:'';
    const data=a.data?`<div class="dataline">${a.data}</div>`:'';
    const conf=`<div class="conf"><span class="lbl">confidence</span><div class="bar"><i style="width:${a.conf*100}%"></i></div><span class="pct">${Math.round(a.conf*100)}%</span></div>`;
    pushMsg(`<div class="answer"><p>${a.html}</p>${list}${data}${conf}</div>`,'bot');
  },520);
}

/* ============================================================ SIMULATE */
function renderSimulate(){
  const snap = R.materialize();
  const opts = [];
  R.byType(snap,'task').forEach(tk=>{
    if(tk.status==='blocked') opts.push({label:`Unblock & finish "${tk.name}"`, desc:'remove the blocker and complete it', hypos:[{type:'task.unblocked',subject:tk.id},{type:'task.completed',subject:tk.id}]});
    else if(tk.status!=='done') opts.push({label:`Complete "${tk.name}"`, desc:'mark this task done today', hypos:[{type:'task.completed',subject:tk.id}]});
  });
  R.byType(snap,'goal').forEach(g=>{ if(g.deadline) opts.push({label:`Slip "${g.name}" deadline 3 days`, desc:'push the date and see the effect', hypos:[{type:'object.updated',subject:g.id,payload:{patch:{deadline:g.deadline+3*DAY}}}]}); });
  $('#simOptions').innerHTML = opts.length? opts.map((o,i)=>`<div class="simopt"><div class="sm"><div class="sn">${o.label}</div><div class="sd">${o.desc}</div></div><button class="runbtn" data-sim="${i}">Run</button></div>`).join('') : `<div class="empty">Add some tasks and goals to simulate.</div>`;
  SIM_OPTS = opts;
}
let SIM_OPTS = [];
function runSim(i){
  const o = SIM_OPTS[i]; const res = R.simulate(o.hypos, null);
  const rows = res.deltas.length ? res.deltas.map(d=>`
    <div class="deltarow"><div class="dn">${d.name}</div>
      <div class="barpair"><span class="b1">${d.before}%</span><span class="arrow">→</span><span class="b2">${d.after}%</span></div>
      <span class="deltapill ${d.delta>=0?'up':'down'}">${d.delta>=0?'+':''}${d.delta}</span></div>
    ${d.dateShift?`<div style="font-family:var(--mono);font-size:11px;color:var(--faint);margin:-4px 0 8px">date moves ${-d.dateShift} day(s) ${d.dateShift<0?'earlier':'later'}</div>`:''}`).join('')
    : `<div class="empty">No goal affected by this change.</div>`;
  $('#simResult').innerHTML = `<div class="simresult"><div class="srt">⮕ ${o.label}</div>${rows}
    <div style="font-size:11.5px;color:var(--faint);margin-top:8px;font-family:var(--mono)">Re-derived from a cloned event log. Your real data is untouched.</div></div>`;
  window.scrollTo(0,0);
}

/* ============================================================ MORE: connect / billing / settings */
const CONNECTORS=[{id:'github',name:'GitHub',icon:'⌥'},{id:'slack',name:'Slack',icon:'#'},{id:'stripe',name:'Stripe',icon:'💳'},{id:'gcal',name:'Calendar',icon:'◷'}];
const PLANS=[
  {id:'free',name:'Developer',price:'$0',per:'forever',feat:false,buy:null,
    items:['1 workspace','Up to 500 objects','Context · Understanding · Prediction','Community support']},
  {id:'pro',name:'Pro',price:'$29',per:'/ user / mo',feat:true,buy:CONFIG.paddle.pricePro,
    items:['Unlimited objects & events','Full reasoning + Simulation','Decide engine & Coordination','Event API + integrations','Email support']},
  {id:'business',name:'Business',price:'$59',per:'/ user / mo',feat:false,buy:CONFIG.paddle.priceBusiness,
    items:['Everything in Pro','Advanced prediction & learning','SSO + audit log','Time-travel exports','Priority support']},
  {id:'ent',name:'Enterprise',price:'Custom',per:'',feat:false,buy:'contact',
    items:['Single-tenant deployment','Customer-managed keys','Security review, SLAs','Dedicated success']},
];
function renderMore(){
  $('#apiKey').textContent = WS.apiKey;
  $('#snippet').innerHTML = `<span class="t">// pipe any event into your reality</span>\nfetch(<span class="a">"https://api.realityos.app/v1/ingest"</span>, {\n  method: <span class="a">"POST"</span>,\n  headers: { <span class="a">"Authorization"</span>: <span class="a">"Bearer ${WS.apiKey.slice(0,14)}…"</span> },\n  body: JSON.stringify({\n    type: <span class="a">"task.blocked"</span>, subject: <span class="a">"task:pay"</span>,\n    payload: { reason: <span class="a">"vendor delay"</span> }\n  })\n})`;
  $('#connList').innerHTML = CONNECTORS.map(c=>`<div class="conn"><div class="ic">${c.icon}</div><div><div class="cn">${c.name}</div><div class="cs">maps to Objects/Events</div></div><button class="cbtn" data-conn="${c.id}">Connect</button></div>`).join('');
  $('#planList').innerHTML = PLANS.map(p=>`<div class="plan ${p.feat?'feat':''}">${p.feat?'<span class="ribbon">Popular</span>':''}
    <div class="pn">${p.name}</div><div class="pp">${p.price}<small> ${p.per}</small></div>
    <ul>${p.items.map(i=>`<li>${i}</li>`).join('')}</ul>
    <button class="buy" data-plan="${p.id}" data-price="${p.buy||''}">${p.id==='free'?'Current plan':p.id==='ent'?'Contact sales':'Choose '+p.name}</button></div>`).join('');
  $('#setName').value = WS.name;
}

/* ---- Paddle ---- */
function initPaddle(){
  if(typeof Paddle==='undefined') return;
  try{ Paddle.Environment.set(CONFIG.paddle.environment);
    if(CONFIG.paddle.clientToken) Paddle.Initialize({ token:CONFIG.paddle.clientToken,
      eventCallback:d=>{ if(d.name==='checkout.completed') toast('Payment complete — welcome aboard'); } });
  }catch(e){}
}
function buy(planId, priceId){
  if(planId==='free'){ toast("You're on Developer already"); return; }
  if(planId==='ent'){ window.location.href='mailto:'+CONFIG.support+'?subject=RealityOS Enterprise'; return; }
  if(!CONFIG.paddle.clientToken || /REPLACE/.test(priceId)){
    toast('Add your Paddle token + price IDs in CONFIG to take live payments'); return;
  }
  try{ Paddle.Checkout.open({ items:[{priceId, quantity:1}], settings:{ successUrl: location.href } }); }
  catch(e){ toast('Checkout error — check Paddle setup'); }
}

/* ============================================================ ROUTER / SHELL */
function go(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.go===view));
  $('#askbar').classList.toggle('hidden', view!=='reason');
  window.scrollTo(0,0);
  if(view==='home') renderHome();
  if(view==='objects') renderObjects();
  if(view==='simulate') renderSimulate();
  if(view==='more') renderMore();
  if(view==='reason') setTimeout(()=>$('#askInput').focus(),120);
}
function openSheet(){ $('#sheet').classList.add('open'); }
function closeSheet(){ $('#sheet').classList.remove('open'); }
let toastT; function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1900); }

function enterApp(){
  $('#bizName').textContent = WS.name;
  $('#topbar').classList.remove('hidden'); $('#tabs').classList.remove('hidden');
  $('#onboard').classList.remove('active');
  initReason(); initPaddle(); go('home');
}

/* ---- forms ---- */
function openAddObject(){
  const types=['task','goal','project','person','customer','code','document','custom'];
  $('#modal').innerHTML=`<div class="grabber"></div><div class="mt">New object<button class="x" data-close>✕</button></div>
    <div class="field"><label>Type</label><select id="f_type">${types.map(t=>`<option>${t}</option>`).join('')}</select></div>
    <div class="field"><label>Name</label><input id="f_name" placeholder="e.g. Payment integration"></div>
    <div class="field" id="f_deadwrap" style="display:none"><label>Deadline</label><input id="f_dead" type="date"></div>
    <div class="btnrow"><button class="btn primary" id="f_save">Add object</button></div>`;
  openSheet();
  $('#f_type').onchange=e=>$('#f_deadwrap').style.display = e.target.value==='goal'?'block':'none';
  $('#f_save').onclick=async()=>{ const ty=$('#f_type').value, nm=$('#f_name').value.trim(); if(!nm){toast('Name required');return;}
    const id=ty+':'+(slug(nm)||uid('')); const props={name:nm};
    if(ty==='goal'&&$('#f_dead').value) props.deadline=new Date($('#f_dead').value).getTime();
    R.object(id,ty,props); await save(); closeSheet(); renderObjects(); toast('Object added'); };
}
function openAddRel(){
  const snap=R.materialize(); const objs=[...snap.objects.values()];
  const rtypes=['depends_on','blocks','blocked_by','advances','belongs_to','owns','committed_to','implements','relates_to'];
  const opt=o=>`<option value="${o.id}">${o.name||o.id}</option>`;
  $('#modal').innerHTML=`<div class="grabber"></div><div class="mt">New relationship<button class="x" data-close>✕</button></div>
    <div class="field"><label>From</label><select id="r_from">${objs.map(opt).join('')}</select></div>
    <div class="field"><label>Relationship</label><select id="r_type">${rtypes.map(t=>`<option>${t}</option>`).join('')}</select></div>
    <div class="field"><label>To</label><select id="r_to">${objs.map(opt).join('')}</select></div>
    <div class="btnrow"><button class="btn primary" id="r_save">Add relationship</button></div>`;
  openSheet();
  $('#r_save').onclick=async()=>{ const f=$('#r_from').value,ty=$('#r_type').value,to=$('#r_to').value;
    if(f===to){toast('Pick two different objects');return;} R.relate(f,ty,to); await save(); closeSheet(); renderObjects(); renderHome(); toast('Relationship added'); };
}

/* ============================================================ EVENTS */
document.addEventListener('click', async e=>{
  const tab=e.target.closest('.tab'); if(tab){ go(tab.dataset.go); return; }
  if(e.target.closest('[data-close]')||(e.target.closest('#sheet')&&!e.target.closest('#modal'))){ closeSheet(); return; }
  const ty=e.target.closest('[data-ty]'); if(ty){ OBJ_TYPE=ty.dataset.ty; renderObjects(); return; }
  const ob=e.target.closest('[data-obj]'); if(ob){ openContext(ob.dataset.obj); return; }
  const ev=e.target.closest('[data-ev]'); if(ev){ R.emit(ev.dataset.ev, ev.dataset.s, {}); await save(); closeSheet(); renderObjects(); renderHome(); toast('Event recorded'); return; }
  const q=e.target.closest('.qchip'); if(q){ askReason(q.dataset.q); return; }
  const sm=e.target.closest('[data-sim]'); if(sm){ runSim(+sm.dataset.sim); return; }
  const cn=e.target.closest('[data-conn]'); if(cn){ toast('Live connectors need the backend — pipe events via your API key for now'); return; }
  const pl=e.target.closest('[data-plan]'); if(pl){ buy(pl.dataset.plan, pl.dataset.price); return; }
});
$('#addObj').onclick=openAddObject;
$('#addRel').onclick=openAddRel;
$('#startSample').onclick=async()=>{ WS.name=$('#bizInput').value.trim()||'My Workspace'; WS.apiKey='rk_live_'+uid('')+uid(''); R=seed(); await save(); enterApp(); };
$('#startEmpty').onclick=async()=>{ WS.name=$('#bizInput').value.trim()||'My Workspace'; WS.apiKey='rk_live_'+uid('')+uid(''); R=new Reality(); await save(); enterApp(); };
$('#sendBtn').onclick=()=>{ const v=$('#askInput').value.trim(); if(v){$('#askInput').value='';askReason(v);} };
$('#askInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){const v=e.target.value.trim(); if(v){e.target.value='';askReason(v);}} });
$('#ttSlider').addEventListener('input',e=>{ TT=+e.target.value; renderHome(); });
$('#copyKey').onclick=()=>{ navigator.clipboard?.writeText(WS.apiKey); toast('API key copied'); };
$('#simWebhook').onclick=async()=>{ R.emit('task.blocked','task:pay',{reason:'incoming webhook: vendor delay'}); await save(); toast('Event ingested → reality updated'); go('home'); };
$('#saveName').onclick=async()=>{ WS.name=$('#setName').value.trim()||WS.name; $('#bizName').textContent=WS.name; await save(); toast('Saved'); };
$('#exportData').onclick=()=>{ const blob=new Blob([JSON.stringify({name:WS.name,reality:R.toJSON()},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(slug(WS.name)||'realityos')+'.json'; a.click(); toast('Exported'); };
$('#reseed').onclick=async()=>{ if(confirm('Reload the example reality? This replaces current data.')){ R=seed(); await save(); toast('Example reloaded'); go('home'); } };
$('#resetAll').onclick=async()=>{ if(confirm('Erase everything and start over?')){ await Store.del(SKEY); location.reload(); } };
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{})); }

/* ============================================================ BOOT */
(async function boot(){
  const saved = await Store.get(SKEY);
  if(saved && saved.reality){ WS.name=saved.name||'My Workspace'; WS.apiKey=saved.apiKey||('rk_live_'+uid('')+uid('')); R=Reality.fromJSON(saved.reality); enterApp(); }
})();
