# Quest quality evaluation

The isolated [evaluation runner](../../functions/evaluation/README.md) compares
native Apple and current Google/cloud components without invoking deployed
callables or modifying backend state. It uses synthetic Minneapolis scenarios,
with a ten-scenario tuning split and twenty held-out cases.

Progression, provider migration, and iPhone compatibility decisions must use
semantic quality and factual checks, not structured-output success alone.
Every evaluated quest requires a resolved venue; unresolved locations remain
failures rather than being replaced by generic quests. Model selection is
pinned to the configured primary TokenRouter Luna Writer and the native system model;
production routing and Scout behavior are outside this experiment.

Credentials remain in process memory. Local artifacts exclude credentials,
raw API responses, and photos; temporary normalized venue evidence must be
purged after verification. The runner does not produce generation samples or
modify production rate-limit state. See its README for commands, exact study
boundaries, evidence retention, blind scoring, and resume behavior.

The cloud adapter shares production's Luna model, strict schema, disabled
reasoning, 4,096 completion-token cap, and 20-second attempt timeout. Cloud
starts are paced five seconds apart, with no fallback or automatic cloud retry.
The isolated runner does not participate in the application's Firestore gate;
avoid overlapping it with production traffic on the same limited account.
