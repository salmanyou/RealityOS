/* =====================================================================
   RealityOS — Reality Compiler (reality-compiler.js)
   Compiles a DOMAIN DESCRIPTION into a reality: objects, relationships,
   constraints, goals, resources, policies, capabilities, events —
   the way a compiler turns source into an executable.
     compile('hospital', {goal:'Discharge patients safely'}) -> Reality
   The archetype library is knowledge, not magic: each archetype declares
   its entity kinds, relations, policies and constraints. Unknown domains
   compile through the GENERIC archetype (objects/events/relations/time),
   which is why the substrate is universal.
   ===================================================================== */
(function (root) {
  const req = (typeof require !== 'undefined');
  const E = req ? require('./reality-engine.js') : root.RealityEngine;
  const DAY = 86400000;

  /* archetypes: the compiler's "standard library" */
  const ARCHETYPES = {
    ecommerce: {
      entities: [['customer','Customer'],['product','Product'],['service','Payment gateway'],['task','Fulfilment'],['task','Catalogue setup'],['task','Checkout build'],['invoice','Invoice']],
      chain: ['Catalogue setup','Checkout build','Fulfilment'],
      policies: ['refund_within_30_days','pci_compliance'],
      constraints: ['payment_needs_invoice','finish_after_start','child_needs_parent'],
      capabilities: { customer:['commit','communicate'], service:['provide'] },
      resources: ['payment gateway','warehouse'],
    },
    hospital: {
      entities: [['person','Clinician'],['person','Patient'],['asset','Bed'],['service','Lab'],['task','Admission'],['task','Lab work'],['task','Operation'],['task','Recovery'],['invoice','Insurance claim']],
      chain: ['Admission','Lab work','Operation','Recovery'],
      policies: ['no_self_approval','patient_consent_required','hipaa_phi_minimisation'],
      constraints: ['finish_after_start','child_needs_parent','no_dependency_cycle'],
      capabilities: { person:['decide','approve','communicate'], service:['provide'] },
      resources: ['operating room','bed','lab capacity'],
    },
    factory: {
      entities: [['machine','Machine 4'],['resource','Raw parts'],['task','Order intake'],['task','Supply parts'],['task','Machining'],['task','Quality check'],['task','Shipment']],
      chain: ['Order intake','Supply parts','Machining','Quality check','Shipment'],
      policies: ['iso9001_qc_gate','maintenance_before_1000h'],
      constraints: ['finish_after_start','no_dependency_cycle'],
      capabilities: { machine:['observe','act','report'] },
      resources: ['machine time','raw parts'],
    },
    software: {
      entities: [['person','Engineer'],['repo','Repository'],['task','Design'],['task','Implement'],['task','Review'],['task','Deploy']],
      chain: ['Design','Implement','Review','Deploy'],
      policies: ['two_reviewer_rule','no_self_approval'],
      constraints: ['finish_after_start','child_needs_parent','no_dependency_cycle'],
      capabilities: { person:['decide','approve','learn'] },
      resources: ['engineering hours','CI minutes'],
    },
    generic: {
      entities: [['entity','Actor'],['task','Step 1'],['task','Step 2'],['task','Step 3']],
      chain: ['Step 1','Step 2','Step 3'],
      policies: [], constraints: ['finish_after_start'], capabilities: {}, resources: [],
    },
  };

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  function compile(domain, { goal, deadlineDays = 14, businessValue = 0, now = Date.now(), extras = [] } = {}) {
    const arch = ARCHETYPES[domain] || ARCHETYPES.generic;
    const R = new E.Reality();
    const t0 = now - 10 * DAY;
    const goalName = goal || `Deliver ${domain}`;

    // goals
    R.object('goal:main', 'goal', { name: goalName, deadline: now + deadlineDays * DAY, businessValue }, t0);
    R.object('proj:main', 'project', { name: goalName }, t0);
    R.relate('proj:main', 'advances', 'goal:main', {}, t0);

    // objects + relationships
    const idOf = {};
    for (const [type, name] of [...arch.entities, ...extras]) {
      const id = `${type}:${slug(name)}`; idOf[name] = id;
      R.object(id, type, { name }, t0);
      if (type === 'task') R.relate(id, 'belongs_to', 'proj:main', {}, t0);
    }
    // the process chain becomes depends_on relationships (time + sequence)
    for (let i = 1; i < arch.chain.length; i++) {
      const from = idOf[arch.chain[i]], to = idOf[arch.chain[i-1]];
      if (from && to) R.relate(from, 'depends_on', to, {}, t0);
    }
    // an actor owns the first step (responsibility)
    const actor = arch.entities.find(([ty]) => ty === 'person' || ty === 'machine' || ty === 'entity');
    if (actor && idOf[arch.chain[0]]) R.relate(idOf[actor[1]], 'owns', idOf[arch.chain[0]], {}, t0);

    // genesis event so the timeline is non-empty
    R.emit('project.started', 'proj:main', { compiledFrom: domain }, t0, 'compiler');

    return {
      reality: R,
      manifest: {
        domain, goal: goalName,
        objects: arch.entities.length + extras.length + 2,
        relationships: arch.chain.length - 1 + 1 + arch.entities.filter(([t])=>t==='task').length,
        constraints: arch.constraints,
        policies: arch.policies,
        capabilities: arch.capabilities,
        resources: arch.resources,
        goals: [goalName],
        events: R.events.length,
      },
    };
  }

  /* register a new archetype (this is how the compiler grows) */
  function defineArchetype(name, spec) { ARCHETYPES[name] = spec; return name; }

  const API = { compile, defineArchetype, ARCHETYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityCompiler = API;
})(typeof window !== 'undefined' ? window : this);
