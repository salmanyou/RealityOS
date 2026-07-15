/* =====================================================================
   RealityOS — package entry point.
   One import gives you the whole platform:
     const ROS = require('realityos');
     const k = ROS.demo();              // a kernel preloaded with a sample team
     k.predict('goal:checkout');        // reason over it
   ===================================================================== */
const engine = require('./reality-engine.js');
const types = require('./reality-types.js');
const inference = require('./reality-inference.js');
const ql = require('./realityql.js');
const sdk = require('./reality-sdk.js');
const kernel = require('./reality-kernel.js');
const graph = require('./reality-graph.js');
const probability = require('./reality-probability.js');
const optimize = require('./reality-optimize.js');
const causal = require('./reality-causal.js');
const information = require('./reality-information.js');
const decideEngine = require('./reality-decide.js');
const reasonStack = require('./reality-reason.js');
const truth = require('./reality-truth.js');
const understanding = require('./reality-understand.js');
const planner = require('./reality-planner.js');
const compiler = require('./reality-compiler.js');
const agents = require('./reality-agents.js');
const physics = require('./reality-physics.js');
const explain = require('./reality-explain.js');
const twin = require('./reality-twin.js');
const ontology = require('./reality-ontology.js');
const verify = require('./reality-verify.js');
const select = require('./reality-select.js');
const incremental = require('./reality-incremental.js');
const discover = require('./reality-discover.js');
const plugins = require('./reality-plugins.js');

/** A kernel preloaded with the sample engineering-team reality (for a 5-minute start). */
function demo() { const k = new kernel.Kernel(engine.seed()); k.R.isA = engine.isA; return k; }

/** A fresh, empty kernel. */
function createKernel() { const k = new kernel.Kernel(); k.R.isA = engine.isA; return k; }

module.exports = {
  // core
  Reality: engine.Reality,
  Kernel: kernel.Kernel,
  RealitySDK: sdk.RealitySDK,
  // language + reasoning
  RealityQL: ql,
  RealityTypes: types,
  RealityInference: inference,
  RealityFeedback: require('./reality-feedback.js'),
  // ---- the reasoning stack (mathematics, no AI) ----
  RealityGraph: graph,              // BFS/DFS, topo, Dijkstra, SCC, betweenness, CPM, max-flow/min-cut
  RealityProbability: probability,  // PERT, Monte Carlo, Bayes, Kalman, uncertainty propagation
  RealityOptimize: optimize,        // Hungarian (exact), CSP, simulated annealing, complexity guard
  RealityCausal: causal,            // do-calculus, backdoor adjustment, counterfactuals, root cause
  RealityInformation: information,  // entropy, information gain, next-best-question
  RealityDecide: decideEngine,      // options + Pareto trade-offs + evidence + assumptions + unknowns
  RealityReason: reasonStack,       // the full stack over any Reality
  // ---- the intelligence layer (above Decision) ----
  TruthEngine: truth.TruthEngine,          // ATMS: competing hypotheses, nogoods, belief revision
  RealityUnderstand: understanding,        // abstractions: fragility, knowledge concentration, systemic weakness
  RealityPlanner: planner,                 // HTN autonomous planner (plan -> schedule -> budget -> risk)
  RealityCompiler: compiler,               // domain description -> a reality
  RealityAgents: agents,                   // multi-agent society (Contract Net Protocol)
  RealityPhysics: physics,                 // learn domain laws from observations (accept only if they fit)
  RealityExplain: explain,                 // publish decisions like proofs
  DigitalTwin: twin.DigitalTwin,           // live sync, freshness, drift, reconcile
  RealityOntology: ontology,               // proposes new types/relations (never auto-adopts)
  // ---- rigor layer: verification, meta-reasoning, incremental/distributed, discovery, plugins ----
  RealityVerify: verify,                   // 12 axioms, property-based; temporal logic with counterexamples
  RealitySelect: select,                   // adaptive algorithm selection + justification (meta-trace)
  RealityIncremental: incremental,         // incremental recomputation; partitioned == centralized
  RealityDiscover: discover,               // PC-stable causal discovery (PROPOSALS ONLY)
  RealityPlugins: plugins,                 // plugin SDK + domain packages
  verifyAxioms: verify.verify,
  checkTemporal: verify.checkTemporal,
  compile: compiler.compile,
  plan: planner.plan,
  understandDeeply: understanding.understand,
  reason: reasonStack.reason,
  optimalAssignment: reasonStack.optimalAssignment,
  // helpers
  seed: engine.seed,
  demo,
  createKernel,
  applyOps: sdk.applyOps,
  isA: engine.isA,
  ancestors: engine.ancestors,
  mintId: engine.mintId,
  ONTOLOGY: engine.ONTOLOGY,
  LAWS: engine.LAWS,
  Principal: engine.Principal,
  evidence: engine.evidence,
  DEFAULT_RELIABILITY: kernel.DEFAULT_RELIABILITY,
};
