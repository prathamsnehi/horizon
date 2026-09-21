# Backend roadmap

This is a short list of deferred work adjacent to the current Firebase backend.
It is not an implementation plan. Re-check product need, vendor terms, quotas,
and current code before starting any item.

## Cost and resilience

- Add per-SKU daily spend guards around paid Places operations. At the cap,
  degrade to location-free quests rather than failing the request. Keep this
  separate from user rate limits and LLM quota accounting.
- Consider a normalized Places-query cache only after confirming current Google
  Maps storage and refresh restrictions. Preserve city specificity and the
  existing randomized top-result selection.
- Consider a shared quest pool keyed by coarse, non-identifying inputs such as
  region and broad preferences. Define invalidation, variety, and privacy before
  replacing the per-user pre-generation cache.
- Watch `llm_rate_buckets/global` for transaction contention before sharding it;
  do not add distributed-counter complexity without measured pressure.

## Safety and quality

- Replace the described-prompt keyword blocklist with a dedicated moderation
  design when product risk or volume justifies it. Moderated text must remain
  excluded from observability.
- Revalidate model IDs, structured-output quality, and account-specific quotas
  in provider consoles periodically. Avoid copying volatile limits into more
  documentation.
- Add a privacy-preserving user-outcome signal only after its product meaning,
  retention, and unlinkability have been designed. Generation samples currently
  have no acceptance/completion labels.

## Scale triggers

- If the admin dashboard's 300-document cap stops representing the selected
  window, write a compact `generation_stats` projection for metrics while
  keeping full samples for trace inspection.
- If external place/photo spend becomes material, evaluate the deferred
  [self-hosted places design](./self-hosted-places.md) as one migration rather
  than independently swapping only search or only images.
