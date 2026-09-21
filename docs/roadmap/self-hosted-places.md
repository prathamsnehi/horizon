# Deferred self-hosted places and imagery

**Status: deferred.** The current Google Places search and server-fetched photo
path remains the production design. Revisit this direction only when measured
cost, coverage, or vendor risk justifies a substantially larger backend.

This document preserves the durable decisions from the earlier v2 exploration,
not its dated price estimates or speculative implementation detail.

## Goal and boundary

The proposed change replaces rented, per-request place discovery and imagery
with a shared place corpus and legally cacheable images. Search and photos must
be evaluated as one migration: Google photo references originate in Google
place responses, so self-hosting search while retaining that photo path may not
remove the dominant dependency or cost.

This is not a client feature redesign. Quest generation still follows Scout ->
place retrieval -> Writer, returns optional location information, and falls back
to generic quests when no safe place is available.

## Direction retained for a future design phase

- Build regional place packs from open place data such as Overture, enriched by
  OpenStreetMap where licensing and attribution permit.
- Keep the Scout's free-form search concept and retrieve semantically within the
  active region rather than forcing concepts into a fixed taxonomy.
- Score place legitimacy and worthiness as eligibility floors. Use prominence
  only to support broad discovery tiers such as hidden, local, and well-known.
- Start with static tier weights based on `experimentationLevel`. Do not add an
  adaptive bandit until a trustworthy completion signal exists.
- Source photos only through identity-bound, cache-permitted sources: licensed
  venue providers, explicit Wikidata/OSM image links, then a bundled category
  placeholder. Do not scrape website metadata, use proximity-only imagery, run
  AI image verification, or generate synthetic venue photos.
- Store normalized images behind a CDN with immutable content paths, and retain
  source, license, and attribution alongside every asset. Negative-cache places
  with no usable photo.
- Keep Google only as a bounded cold-start or thin-region fallback, protected by
  region-creation rate limits and a hard daily spend guard.

## Preconditions before implementation

1. Measure current monthly Places search/photo volume, cache opportunity, and
   failure rate; choose a trigger from real data rather than an old MAU estimate.
2. Reconfirm source licenses, photo caching rights, attribution requirements,
   coverage, and current vendor pricing.
3. Prototype retrieval and photo quality in representative dense, suburban,
   rural, and international regions.
4. Design the regional build/refresh pipeline, vector index, storage/CDN,
   fallback budget, deletion policy, and operational ownership.
5. Specify the replacement API contract and iOS migration, including photo URL
   persistence and attribution UI, before changing the production path.

Treat the eventual effort as a separately reviewed architecture project. Do not
incrementally introduce its collections or infrastructure into today's request
path without that review.
