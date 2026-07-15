/* =====================================================================
   RealityOS — Plugin SDK (reality-plugins.js)
   Extend RealityOS WITHOUT touching the kernel. Contracts are validated
   at registration, so a bad plugin fails loudly at load, not silently at
   reasoning time.
     kinds: planner · causal · optimizer · explanation · archetype
            connector · visualization · inference-rule
   Domain packages bundle: ontology + constraints + archetype + causal priors.
   ===================================================================== */
(function (root) {
  const CONTRACTS = {
    planner:      { fn: ['plan'],       doc: 'plan(domain, goal, state) -> {success, steps}' },
    causal:       { fn: ['effect'],     doc: 'effect(data, x, y, adjust) -> {ate}' },
    optimizer:    { fn: ['assign'],     doc: 'assign(costMatrix) -> {assign, total}' },
    explanation:  { fn: ['render'],     doc: 'render(explanation) -> string' },
    archetype:    { fn: [],             doc: '{entities, chain, policies, constraints, capabilities, resources}' },
    connector:    { fn: ['translate'],  doc: 'translate(eventType, payload) -> ops[]' },
    visualization:{ fn: ['render'],     doc: 'render(reality) -> any' },
    'inference-rule': { fn: ['rule'],   doc: 'rule(R, snap, facts) -> facts[]' },
  };

  const registry = new Map();   // kind -> Map(name -> plugin)

  function validate(kind, plugin) {
    const c = CONTRACTS[kind];
    if (!c) throw new Error(`unknown plugin kind "${kind}". Valid: ${Object.keys(CONTRACTS).join(', ')}`);
    const missing = c.fn.filter(f => typeof plugin[f] !== 'function');
    if (missing.length) throw new Error(`plugin fails the "${kind}" contract: missing ${missing.join(', ')}. Expected ${c.doc}`);
    if (kind === 'archetype' && (!plugin.entities || !plugin.chain)) throw new Error('archetype needs {entities, chain}');
    return true;
  }
  function register(kind, name, plugin) {
    validate(kind, plugin);
    if (!registry.has(kind)) registry.set(kind, new Map());
    registry.get(kind).set(name, plugin);
    return { kind, name, registered: true };
  }
  const get = (kind, name) => (registry.get(kind) || new Map()).get(name) || null;
  const list = (kind) => kind ? [...(registry.get(kind) || new Map()).keys()] : Object.fromEntries([...registry].map(([k, v]) => [k, [...v.keys()]]));
  const contracts = () => CONTRACTS;

  /* ---- Domain packages: ontology + constraints + archetype + causal priors ---- */
  const packages = new Map();
  function installPackage(pkg) {
    const need = ['name', 'ontology', 'constraints', 'archetype'];
    const missing = need.filter(k => !pkg[k]);
    if (missing.length) throw new Error(`domain package missing: ${missing.join(', ')}`);
    register('archetype', pkg.name, pkg.archetype);
    packages.set(pkg.name, pkg);
    // wire into the type system + compiler if available
    try {
      const T = require('./reality-types.js');
      const E = require('./reality-engine.js');
      Object.entries(pkg.ontology).forEach(([type, def]) => {
        T.TYPE_SYSTEM[type] = def;
        E.ONTOLOGY[type] = def.extends || 'entity';   // so isA()/normalizeType() know the new type
      });
      const C = require('./reality-compiler.js'); C.defineArchetype(pkg.name, pkg.archetype);
    } catch (e) { /* browser context */ }
    return { installed: pkg.name, types: Object.keys(pkg.ontology).length, causalPriors: (pkg.causalPriors || []).length };
  }
  const getPackage = n => packages.get(n) || null;
  const listPackages = () => [...packages.keys()];

  const API = { register, get, list, validate, contracts, installPackage, getPackage, listPackages, CONTRACTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityPlugins = API;
})(typeof window !== 'undefined' ? window : this);
