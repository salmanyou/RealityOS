/* =====================================================================
   RealityOS — Explanation Engine (reality-explain.js)
   "Like publishing a mathematical proof."
   Every conclusion is emitted as a structured argument:
     Claim → Evidence → Reasoning chain → Confidence →
     Alternatives → Trade-offs → Unknowns → Future risks
   Machine-readable (for audit) and human-readable (for trust).
   ===================================================================== */
(function (root) {
  function explain({ claim, evidence = [], reasoning = [], confidence = null, alternatives = [], tradeoffs = [], unknowns = [], futureRisks = [], assumptions = [] }) {
    return { claim, evidence, reasoning, confidence, alternatives, tradeoffs, unknowns, futureRisks, assumptions,
      complete: !!(claim && evidence.length && reasoning.length && confidence != null) };
  }

  /* build an explanation directly from a Decision Engine result */
  function fromDecision(decision, { question = 'What should we do?' } = {}) {
    const best = decision.options.filter(o => o.pareto).sort((a, b) => a.risk - b.risk)[0] || decision.options[0];
    const others = decision.options.filter(o => o !== best);
    return explain({
      claim: `${best.name} — completion ≈${best.days} days (p90 ${best.p90}), risk of missing ${(best.risk * 100).toFixed(0)}%.`,
      evidence: [
        `critical chain: ${decision.criticalChain.join(' → ')}`,
        `baseline if nothing changes: p50 ${decision.baseline.p50Days}d, on-time ${(decision.baseline.pOnTime * 100).toFixed(0)}%`,
        ...decision.rootCauses.slice(0, 2).map(c => `counterfactual: fixing "${c.cause}" changes delay by ${c.delayRemoved} days`),
      ],
      reasoning: decision.reasoningPath,
      confidence: decision.confidence,
      alternatives: others.map(o => ({ option: o.name, days: o.days, cost: o.cost, risk: o.risk, dominated: !o.pareto })),
      tradeoffs: decision.options.map(o => `${o.name}: ${o.days}d · cost ${o.cost} · risk ${(o.risk * 100).toFixed(0)}%${o.labels && o.labels.length ? ' [' + o.labels.join('/') + ']' : ''}`),
      unknowns: decision.unknowns.map(u => `${u.question} (would remove ${u.gain} bits of uncertainty)`),
      futureRisks: [
        best.risk > 0.2 ? `residual ${(best.risk * 100).toFixed(0)}% chance of missing even after acting` : 'low residual schedule risk',
        'assumptions may drift: re-check when new events arrive',
      ],
      assumptions: [...(best.assumptions || []), ...decision.assumptions],
    });
  }

  /* render as a proof-style document */
  function render(x) {
    const L = [];
    L.push(`CLAIM\n  ${x.claim}`);
    L.push(`\nEVIDENCE`); x.evidence.forEach(e => L.push(`  • ${e}`));
    L.push(`\nREASONING`); x.reasoning.forEach((r, i) => L.push(`  ${i + 1}. ${r}`));
    L.push(`\nCONFIDENCE\n  ${x.confidence != null ? (x.confidence * 100).toFixed(0) + '%' : 'unstated'}`);
    if (x.alternatives.length) { L.push(`\nALTERNATIVES`); x.alternatives.forEach(a => L.push(`  • ${a.option}: ${a.days}d, cost ${a.cost}, risk ${(a.risk * 100).toFixed(0)}%${a.dominated ? ' (dominated)' : ''}`)); }
    if (x.tradeoffs.length) { L.push(`\nTRADE-OFFS`); x.tradeoffs.forEach(t => L.push(`  • ${t}`)); }
    if (x.assumptions.length) { L.push(`\nASSUMPTIONS`); x.assumptions.forEach(a => L.push(`  • ${a}`)); }
    if (x.unknowns.length) { L.push(`\nUNKNOWNS`); x.unknowns.forEach(u => L.push(`  ? ${u}`)); }
    if (x.futureRisks.length) { L.push(`\nFUTURE RISKS`); x.futureRisks.forEach(f => L.push(`  ! ${f}`)); }
    L.push(`\n[explanation complete: ${x.complete ? 'yes' : 'NO — missing a required section'}]`);
    return L.join('\n');
  }

  const API = { explain, fromDecision, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityExplain = API;
})(typeof window !== 'undefined' ? window : this);
