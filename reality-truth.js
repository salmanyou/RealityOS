/* =====================================================================
   RealityOS — Truth Engine (reality-truth.js)
   An Assumption-based Truth Maintenance System (de Kleer, 1986).
   When CRM says PAID, ERP says NOT PAID and the bank says PENDING,
   RealityOS does NOT choose. It maintains every consistent world
   (context) simultaneously, records WHY each belief holds, detects
   inconsistent assumption sets (nogoods), and revises belief when
   evidence arrives.
     node.label = minimal sets of assumptions ("environments") under
                  which the node holds. Believed iff some environment
                  is consistent (not a superset of a nogood).
   ===================================================================== */
(function (root) {
  const setKey = s => [...s].sort().join('&');
  const isSubset = (a, b) => [...a].every(x => b.has(x));

  class TruthEngine {
    constructor() {
      this.assumptions = new Map();      // name -> {reliability, source}
      this.nodes = new Map();            // name -> {label:Set<envKey>->Set, justifications:[]}
      this.nogoods = [];                 // Array<Set> inconsistent assumption sets
      this.contradictions = [];          // recorded conflicts
    }
    assume(name, { reliability = 0.5, source = name } = {}) {
      this.assumptions.set(name, { reliability, source });
      this._node(name).label.set(setKey([name]), new Set([name]));
      return name;
    }
    _node(name) { if (!this.nodes.has(name)) this.nodes.set(name, { name, label: new Map(), justifications: [] }); return this.nodes.get(name); }

    /* justify(consequent, [antecedents]) — "these together imply that" */
    justify(consequent, antecedents) {
      const n = this._node(consequent); n.justifications.push(antecedents.slice());
      antecedents.forEach(a => this._node(a));
      this._propagate();
      return this;
    }
    /* declare two (or more) propositions mutually exclusive → their joint envs become nogoods */
    exclusive(...props) {
      props.forEach(p => this._node(p));
      this._propagate();
      for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) {
        for (const ea of this._node(props[i]).label.values())
          for (const eb of this._node(props[j]).label.values()) {
            const joint = new Set([...ea, ...eb]);
            this._addNogood(joint);
            this.contradictions.push({ between: [props[i], props[j]], environment: [...joint] });
          }
      }
      this._propagate();
      return this;
    }
    _addNogood(env) { if (!this.nogoods.some(ng => isSubset(ng, env))) { this.nogoods = this.nogoods.filter(ng => !isSubset(env, ng)); this.nogoods.push(env); } }
    _consistent(env) { return !this.nogoods.some(ng => isSubset(ng, env)); }

    /* label propagation to a fixpoint (minimal, consistent environments) */
    _propagate() {
      for (let pass = 0; pass < 12; pass++) {
        let changed = false;
        for (const n of this.nodes.values()) {
          for (const ants of n.justifications) {
            // cross-product of antecedent environments
            let envs = [new Set()];
            for (const a of ants) {
              const al = this._node(a).label; if (!al.size) { envs = []; break; }
              const next = [];
              for (const e of envs) for (const ae of al.values()) next.push(new Set([...e, ...ae]));
              envs = next;
            }
            for (const e of envs) {
              if (!this._consistent(e)) continue;
              // minimality: skip if a subset already present; drop supersets
              let dominated = false;
              for (const existing of n.label.values()) { if (isSubset(existing, e)) { dominated = true; break; } }
              if (dominated) continue;
              for (const [k, existing] of [...n.label]) if (isSubset(e, existing)) n.label.delete(k);
              n.label.set(setKey(e), e); changed = true;
            }
          }
          // prune environments made inconsistent by new nogoods
          for (const [k, e] of [...n.label]) if (!this._consistent(e)) { n.label.delete(k); changed = true; }
        }
        if (!changed) break;
      }
    }

    /* is it believed in ANY consistent world? */
    believed(prop) { const n = this.nodes.get(prop); return !!n && [...n.label.values()].some(e => this._consistent(e)); }

    /* every consistent maximal world, with joint plausibility = Π reliability(assumption) */
    contexts() {
      const props = [...this.nodes.keys()].filter(p => !this.assumptions.has(p));
      const out = [];
      for (const p of props) for (const e of this._node(p).label.values()) {
        if (!this._consistent(e)) continue;
        const plaus = [...e].reduce((a, x) => a * (this.assumptions.get(x)?.reliability ?? 0.5), 1);
        out.push({ belief: p, assumptions: [...e], plausibility: +plaus.toFixed(4), sources: [...e].map(x => this.assumptions.get(x)?.source || x) });
      }
      return out.sort((a, b) => b.plausibility - a.plausibility);
    }
    /* competing hypotheses over a mutually-exclusive set: ranked, NOT collapsed */
    hypotheses(props) {
      return props.map(p => {
        const envs = [...this._node(p).label.values()].filter(e => this._consistent(e));
        const best = envs.map(e => [...e].reduce((a, x) => a * (this.assumptions.get(x)?.reliability ?? 0.5), 1)).sort((a, b) => b - a)[0] || 0;
        return { hypothesis: p, alive: envs.length > 0, support: envs.map(e => [...e]), plausibility: +best.toFixed(4) };
      }).sort((a, b) => b.plausibility - a.plausibility);
    }
    /* BELIEF REVISION: new hard evidence retracts an assumption (makes it a nogood) */
    retract(assumption, reason = 'contradicted by evidence') {
      this._addNogood(new Set([assumption]));
      this._propagate();
      return { retracted: assumption, reason, survivors: this.contexts().slice(0, 5) };
    }
    /* provenance: why do we believe this, and on whose word? */
    why(prop) {
      const n = this.nodes.get(prop); if (!n) return null;
      return { proposition: prop, believed: this.believed(prop),
        support: [...n.label.values()].filter(e => this._consistent(e)).map(e => ({ assumptions: [...e], sources: [...e].map(x => this.assumptions.get(x)?.source || x), plausibility: +[...e].reduce((a, x) => a * (this.assumptions.get(x)?.reliability ?? 0.5), 1).toFixed(4) })),
        nogoods: this.nogoods.map(ng => [...ng]) };
    }
  }
  const API = { TruthEngine };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityTruth = TruthEngine;
})(typeof window !== 'undefined' ? window : this);
