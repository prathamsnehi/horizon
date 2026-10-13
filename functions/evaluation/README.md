# Minneapolis evaluation

This standalone benchmark compares Google Places with native MapKit search and
the configured primary TokenRouter Luna Writer with on-device Apple Foundation Models.
It never calls Firebase functions, touches Firestore, deploys, changes quotas, or
pre-generates quests. Production exports do not import the evaluation modules.

Requirements: Node 22, backend dependencies, authenticated Firebase CLI with
read access to `PLACES_API_KEY` and `TOKENROUTER_API_KEY`, macOS 26+ on eligible Apple
silicon with Apple Intelligence ready, and full Xcode. The checked-in harness
currently uses macOS 27 SDK symbols; compile and execute with Xcode 27/macOS 27.
Native networking/inference services and Swift compiler macros need normal
macOS access; a nested execution sandbox may need a per-command exception.

From the repository root:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun swiftc \
  -parse-as-library -module-cache-path /private/tmp/horizon-eval-module-cache \
  functions/evaluation/native/HorizonEvaluation.swift \
  -o /private/tmp/horizon-native-eval
corepack yarn --cwd functions test --runInBand
corepack yarn --cwd functions build
corepack yarn --cwd functions evaluate:quests run \
  --native /private/tmp/horizon-native-eval \
  --out ../.evaluation-results/minneapolis --phase tuning
```

Inspect tuning failures, then run `--phase heldout` with the same output
directory. Tuning uses guided generation with the production task and explicit
evidence boundaries. The one adaptation selected from tuning removes the
unrelated barista example, compacts the identical venue evidence, and restates
the existing allowed references, transport modes, and comfort edges. Its hash
freezes before held-out calls; the report keeps these prompt variants separate.
Changing the native binary, scenario suite, primary model, or cloud prompt
invalidates the checkpoint; start a new directory. Do not tune on held-out data.
OS/model-version changes or changed venue evidence also stop a resume rather
than mixing measurements. Held-out runs require all ten tuning cases to finish.
Use `--phase all` for an uninterrupted fixed-prompt run. `--limit N` permits a
smoke test; the checkpoint skips finished operations on the next run.

The suite has 15 coffee, five park, four art, three beginner, and three social
scenarios. Ten are tuning scenarios, twenty are held out, and ten held-out cases
also run the four place-provider/Writer combinations. Canonical Writer tests
give both models identical normalized facts from Google's first eligible
venue, with three repetitions. This choice is disclosed in the report.
Search compares the top five valid candidates within the same explicit study
rectangle (44.90–45.05 latitude, -93.38–-93.19 longitude). This is a Minneapolis
study area, not a claim that every returned place lies inside city boundaries.

Only one request runs at a time. Cloud calls use the production Luna adapter,
reasoning disabled, strict output, a 4,096 completion-token cap, a 20-second
attempt deadline, and five seconds between cloud starts. Cloud failures are not
retried or routed to a fallback; non-cloud transient errors retry once. SDK
retries are disabled. Every attempted paid/native call is checkpointed before dispatch.
There is no daily budget cap. Model metadata is checked before live work;
unavailable models stop the experiment rather than silently substituting a
fallback. Independent preflight tests a Google search, a MapKit search, and a
tiny native structured-generation probe. These probes count as calls, are
excluded from quality scores, and still run if cloud metadata fails.
The runner omits photos. Requesting Google website links may use a
higher Places billing tier than the app's current field mask.

## Review and artifacts

Results are ignored under `.evaluation-results/`. Credentials are read into
memory through captured CLI output and redacted from errors. No `.env` is used.
The evaluation-only preload disables Firebase CLI's temporary file logger and
requires a suppression handshake. It targets the standard Node-based
`firebase-tools` CLI; CLI compatibility failures stop secret access. Debug
console logging is disabled in that subprocess as well.
Checkpoints contain model/environment information, call counts, source links,
place IDs, validations, and app-authored outputs with literal full venue names
and addresses replaced. Short names or aliases can remain in generated text.
They contain no raw provider responses, coordinates, or photos.

A permission-restricted normalized venue snapshot is temporarily written to
`<os.tmpdir()>/horizon-venue-review-<manifest>.json` for verification. Review it
within 24 hours and purge it after review; the expiry marker is informational,
not an operating-system deletion guarantee. Do not commit or sync this file.
The runner does not use it to cache venue responses on later runs.
Blinded search cards are also temporary, at
`<os.tmpdir()>/horizon-blind-search-review-<manifest>.json`. The runner prints
the actual path (on macOS this is usually under `/var/folders`). They omit provider
IDs and Maps links but include the top five normalized candidates for review.
Temporary supplied venue identities for writing cards are at
`<os.tmpdir()>/horizon-blind-writer-evidence-<manifest>.json`, matched by blind
review ID. Use them to assess location fit without exposing provider labels.
The `purge` command removes all three temporary files. Complete all source checks
before purging; completed searches are not silently repeated to recreate them.

Read `blind-review.json` before opening `blind-key.json`, the checkpoint, or the
report. Review each card's request fit, clarity, feasibility, and challenge fit
from 1–5, record critical failures and notes, and save the array to
`reviews.json`. Each review has `id`, `requestFit`, `actionClarity`,
`feasibility`, `challengeFit`, `criticalFailures`, `notes`, and optional
`sourceURLs`. A score of 1 is unusable, 3 is usable with caveats, and 5 is
excellent. Unknown amenities are not automatically failures; unsupported
assertions need direct-source verification. Automated warnings flag claims
for inspection without declaring them false.

For search, read the temporary blinded search cards before opening
`blind-search-key.json` or the unblinded venue snapshot. Save assessments to
`search-reviews.json`: each entry has `id`, `notes`, and `candidates`. Score
every returned candidate in rank order with `rank`, `relevance` (1–5),
`activityEvidence` (`verified`, `unknown`, or `contradicted`),
`criticalFailures`, `notes`, and optional `sourceURLs`. Verified/contradicted
activity evidence requires an official source link. Unknown amenities do not
prove suitability and are not automatic failures. Allowed critical categories
for both reviews are `invented_venue_fact`, `wrong_location`, and
`missing_location`. Unresolved searches have an empty candidate list.
The candidate `websiteLink` is provider-supplied and can point to a third-party
site; verify that a source is official before using it as venue evidence.

Example review records (replace IDs and assessments with actual judgments):

```json
[
  {"id":"Q001","requestFit":4,"actionClarity":5,"feasibility":3,
   "challengeFit":4,"criticalFailures":[],"notes":"Focused action; amenities unknown."}
]
```

```json
[
  {"id":"S001","notes":"Relevant café; work suitability unverified.",
   "candidates":[{"rank":1,"relevance":4,"activityEvidence":"unknown",
                  "criticalFailures":[],"notes":"No Wi-Fi or noise evidence."}]}
]
```

The reused production Writer prompt does not include budget, vibe, or every
other profile field. Constraints placed in explicit requests reach both
Writers; the report discloses this limitation. Canonical Writer inputs give
both providers the same computed transport options, not verified routes.
Official venue evidence used for fact checking is not silently added to one
Writer's inputs.

If current TokenRouter authentication fails, restore the credential through the
normal Secret Manager workflow; this runner never rotates it. An explicitly
approved version can be selected using `--tokenrouter-secret-version N` with a new
output directory, keeping the configured model unchanged.

```sh
corepack yarn --cwd functions evaluate:quests report --out ../.evaluation-results/minneapolis
corepack yarn --cwd functions evaluate:quests purge --out ../.evaluation-results/minneapolis
```

The generated `report.md` distinguishes measured validity from unreviewed
semantic quality, aggregates each split separately, and includes median/P95
latency and actual calls. Add component recommendations in `findings.md` after
blind review and venue verification. Explicitly disclose single-reviewer
limitations and incomplete or failed operations. Neither Mac results nor
Minneapolis coverage establishes real-iPhone performance or worldwide quality.
