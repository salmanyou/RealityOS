# RealityOS — 5-minute quickstart

From zero to reasoning over a real model in five minutes. Every snippet below is run as part of the build, so it works as written.

## Install
```bash
npm install realityos          # from npm (once published)
# or, from this package:
npm install /path/to/RealityOS
```

## Reason over a sample team (copy-paste)
```js
const ROS = require('realityos');

const k = ROS.demo();                    // a kernel preloaded with a sample engineering team

// 1) what's at risk, and why?
k.understand().risks[0].title;           // → "Ship Checkout v2" is at risk

// 2) predict a goal's on-time odds (with confidence)
const p = k.predict('goal:checkout');    // → { probability: 0.48, confidence: 0.78, drivers: [...], evidence: {...} }

// 3) ask in plain language with RealityQL
k.ql('CAUSE goal:checkout').text;
// → waiting on vendor API keys → Payment integration → QA pass → Security review → Ship Checkout v2

// 4) simulate a fix on a virtual timeline (reality is never mutated)
k.simulate([{ type:'task.unblocked', subject:'task:pay' },
            { type:'task.completed', subject:'task:pay' }], 'goal:checkout').deltas;
// → [{ before: 48, after: 97, ... }]

// 5) feed in a real event (e.g. from GitHub) and run the full pipeline
const trace = k.record({ type:'task.completed', subject:'task:ui', source:'github' });
trace.inferred;        // facts derived automatically
k.verify();            // { consistent, violations, contradictions }
```

## The kernel API (RFC-0033)
```js
k.observe(principal?)        // permission-aware snapshot
k.record(event)             // run the pipeline: validate → store → derive → constraints
                            //   → inference → contradictions → resolve → attention → predict → publish
k.predict(goalId)           // on-time probability + drivers + evidence + confidence
k.simulate(events, goalId)  // what-if on a virtual timeline
k.causalChain(goalId)       // root cause → … → goal
k.explain(id)               // context + causal + evidence
k.verify()                  // constraints + contradictions
k.deriveState(t) / k.replay(t)
k.forkTimeline() / k.mergeTimeline(other)
k.sealChain() / k.verifyChain(sealed)     // tamper-evidence
k.exportREF() / k.exportROF()             // interop formats
```

## Use RealityQL directly
```js
const { RealityQL } = require('realityos');
RealityQL.execute(k.R, 'PREDICT goal:checkout AS OF 3');   // time-travel: 3 days ago
RealityQL.execute(k.R, 'VERIFY');                          // is reality consistent?
RealityQL.execute(k.R, 'INFER');                           // derived facts
```

## Build on it
- **Add a data source** — write a translator `(eventType, payload) → ops[]`, register it: `RealitySDK.registerAdapter('jira', fn)`, then `sdk.ingestFrom('jira', type, payload)`.
- **Run the backend** — `npm start` (SQLite by default; Postgres via `DATABASE_URL`). See `DOCUMENTATION.md` §8.
- **Install the app on a phone** — deploy `index.html` + assets, Add to Home Screen. See `DOCUMENTATION.md` §2.

Next: `wedge/` for the Blocker Radar product, `THEORY_OF_ORGANIZATIONAL_REALITY.md` for the science, `REALITYOS_RFC_SERIES.md` for the frozen v1.0 spec.
