/* =====================================================================
   RealityOS — Multi-Agent Society (reality-agents.js)
   Contract Net Protocol (Smith, 1980): announce → bid → award → execute.
   Agents are ROLES over the reasoning stack, not separate engines:
     Planner · Engineer · Finance · Legal · Security · Risk · Economist
   Each declares capabilities and bids with a cost + confidence. The
   manager awards to the best bid. Coalitions form when no single agent
   can cover a task.
   ===================================================================== */
(function (root) {
  class Agent {
    constructor(name, capabilities, { skill = {}, load = 0 } = {}) { this.name = name; this.capabilities = capabilities; this.skill = skill; this.load = load; }
    canDo(cap) { return this.capabilities.includes(cap); }
    bid(task) {
      if (!this.canDo(task.capability)) return null;
      const s = this.skill[task.capability] ?? 0.5;               // 0..1 competence
      const cost = +( (task.effort || 1) / Math.max(0.15, s) * (1 + this.load * 0.35) ).toFixed(2);
      const confidence = +Math.min(0.97, 0.45 + s * 0.5).toFixed(2);
      return { agent: this.name, task: task.name, cost, confidence };
    }
  }

  class Society {
    constructor(agents = []) { this.agents = agents; this.log = []; }
    add(a) { this.agents.push(a); return this; }

    /* one Contract-Net round for a single task */
    announce(task) {
      const bids = this.agents.map(a => a.bid(task)).filter(Boolean);
      this.log.push({ phase: 'announce', task: task.name, bidders: bids.length });
      if (!bids.length) return { task: task.name, awarded: null, reason: 'no agent has capability: ' + task.capability, bids: [] };
      // award: best value = confidence per unit cost
      const ranked = bids.map(b => ({ ...b, value: +(b.confidence / b.cost).toFixed(3) })).sort((a, b) => b.value - a.value);
      const winner = ranked[0];
      const agent = this.agents.find(a => a.name === winner.agent); agent.load += 1;   // load balancing
      this.log.push({ phase: 'award', task: task.name, to: winner.agent, cost: winner.cost });
      return { task: task.name, awarded: winner.agent, cost: winner.cost, confidence: winner.confidence, bids: ranked };
    }

    /* allocate a whole task list; forms a coalition when tasks need different capabilities */
    allocate(tasks) {
      const results = tasks.map(t => this.announce(t));
      const coalition = [...new Set(results.filter(r => r.awarded).map(r => r.awarded))];
      const unassigned = results.filter(r => !r.awarded).map(r => ({ task: r.task, reason: r.reason }));
      return { results, coalition, unassigned, totalCost: +results.reduce((a, r) => a + (r.cost || 0), 0).toFixed(2) };
    }
  }
  const API = { Agent, Society };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityAgents = API;
})(typeof window !== 'undefined' ? window : this);
