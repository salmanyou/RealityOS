/* =====================================================================
   RealityOS — Information Layer (reality-information.js)
   "What information is missing? What evidence reduces uncertainty most?"
     Shannon entropy · conditional entropy · mutual information ·
     expected information gain (which question to ask next) ·
     value of information (in decision terms)
   ===================================================================== */
(function (root) {
  const log2 = x => Math.log(x) / Math.LN2;

  /* entropy of a belief distribution (array of probabilities) */
  function entropy(ps) { return +(-ps.filter(p => p > 0).reduce((a, p) => a + p * log2(p), 0)).toFixed(4); }
  /* binary entropy of a single probability */
  const H = p => (p <= 0 || p >= 1) ? 0 : +(-(p * log2(p) + (1 - p) * log2(1 - p))).toFixed(4);

  /* Expected information gain from observing evidence E about hypothesis H.
     Uses Bayes to compute posterior under each outcome of E, weighted by P(E).      */
  function infoGain(prior, pEgivenH, pEgivenNotH) {
    const pE = pEgivenH * prior + pEgivenNotH * (1 - prior);
    const postIfE = pE === 0 ? prior : (pEgivenH * prior) / pE;
    const postIfNotE = (1 - pE) === 0 ? prior : ((1 - pEgivenH) * prior) / (1 - pE);
    const expectedPosteriorH = pE * H(postIfE) + (1 - pE) * H(postIfNotE);
    return { gain: +(H(prior) - expectedPosteriorH).toFixed(4), pE: +pE.toFixed(3), postIfE: +postIfE.toFixed(3), postIfNotE: +postIfNotE.toFixed(3) };
  }

  /* Rank candidate questions/checks by expected information gain — what to ask NEXT */
  function nextBestQuestion(prior, questions) {
    return questions.map(q => ({ question: q.name, ...infoGain(prior, q.pIfTrue, q.pIfFalse), cost: q.cost || 1 }))
      .map(q => ({ ...q, gainPerCost: +(q.gain / q.cost).toFixed(4) }))
      .sort((a, b) => b.gainPerCost - a.gainPerCost);
  }

  /* mutual information between two binary variables from a joint table {x,y:count} */
  function mutualInformation(rows, x, y) {
    const n = rows.length; const c = (a, b) => rows.filter(r => r[x] === a && r[y] === b).length / n;
    const px = a => rows.filter(r => r[x] === a).length / n, py = b => rows.filter(r => r[y] === b).length / n;
    let mi = 0; for (const a of [0, 1]) for (const b of [0, 1]) { const pxy = c(a, b); if (pxy > 0) mi += pxy * log2(pxy / (px(a) * py(b))); }
    return +mi.toFixed(4);
  }

  const API = { entropy, H, infoGain, nextBestQuestion, mutualInformation };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.RealityInformation = API;
})(typeof window !== 'undefined' ? window : this);
