import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSamplesInWindow } from "../../lib/samples";
import { computeStats, failingStage, type DashboardStats } from "../../lib/stats";
import { ms, pct, relative } from "../../lib/format";
import { DayBars, HBarChart, Legend, Meter, StatTile, TimeBars } from "../../components/viz";
import { fetchSiteMetrics, type SiteTotals } from "../../lib/siteMetrics";
import type { GenerationSample, TraceOutcome } from "../../types";

const WINDOWS = [
  { label: "24h", ms: 24 * 60 * 60 * 1000, buckets: 24 },
  { label: "48h", ms: 48 * 60 * 60 * 1000, buckets: 24 },
  { label: "7d", ms: 7 * 24 * 60 * 60 * 1000, buckets: 28 },
] as const;

/**
 * Outcome display order is load-bearing, not cosmetic — this sequence was the
 * one ordering of the four status colors whose adjacent pairs clear both the
 * colorblind and normal-vision separation floors. Every entry is labeled, so
 * color is never the only signal.
 */
const OUTCOMES: { key: TraceOutcome; label: string; fill: string }[] = [
  { key: "success", label: "Succeeded", fill: "bg-good" },
  { key: "rate_limited", label: "Rate limited", fill: "bg-warning" },
  { key: "error", label: "Failed", fill: "bg-critical" },
  { key: "invalid", label: "Rejected", fill: "bg-serious" },
];

export default function Dashboard() {
  const [windowIndex, setWindowIndex] = useState(1); // default 48h
  const [samples, setSamples] = useState<GenerationSample[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const active = WINDOWS[windowIndex];

  useEffect(() => {
    let cancelled = false;
    setSamples(null);
    setError(null);
    const stamp = Date.now();
    setNow(stamp);

    fetchSamplesInWindow(stamp - active.ms)
      .then((result) => {
        if (cancelled) return;
        setSamples(result.samples);
        setTruncated(result.truncated);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [active.ms]);

  const stats: DashboardStats | null = useMemo(
    () => (samples ? computeStats(samples, now, active.ms, active.buckets) : null),
    [samples, now, active.ms, active.buckets]
  );

  return (
    <div className="space-y-5">
      <SiteTraffic />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold">Pipeline health</h1>
        {/* Filters sit in one row above the charts. */}
        <div className="flex gap-1 rounded-lg border border-line p-0.5">
          {WINDOWS.map((w, i) => (
            <button
              key={w.label}
              onClick={() => setWindowIndex(i)}
              className={`ring-focus rounded-md px-3 py-1 text-micro font-medium transition-colors ${
                i === windowIndex ? "bg-raised text-fg" : "text-muted hover:text-dim"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card border-critical/40 p-4 text-tiny text-critical">
          Couldn&rsquo;t load samples: {error}
        </div>
      )}

      {!stats && !error && (
        <p className="py-16 text-center text-tiny text-muted">Loading…</p>
      )}

      {stats && stats.total === 0 && (
        <div className="card p-10 text-center">
          <p className="text-tiny text-dim">
            No generations in the last {active.label}.
          </p>
        </div>
      )}

      {stats && stats.total > 0 && (
        <>
          {truncated && (
            <p className="text-micro text-warning">
              Showing the most recent 300 samples — figures below cover that
              slice, not the whole window.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Generations"
              value={stats.total}
              sub={`in the last ${active.label}`}
            />
            <StatTile
              label="Success rate"
              value={pct(stats.successRate.value, 1)}
              sub={`${stats.successRate.hits}/${stats.successRate.total} completed`}
              tone={
                stats.successRate.value == null
                  ? undefined
                  : stats.successRate.value >= 0.95
                    ? "good"
                    : stats.successRate.value >= 0.8
                      ? "warning"
                      : "critical"
              }
            />
            <StatTile
              label="Failures"
              value={stats.errorCount}
              sub={`in the last ${active.label}`}
              tone={stats.errorCount > 0 ? "critical" : "good"}
            />
            <StatTile
              label="Latency p50 / p95"
              value={ms(stats.totalLatencyP50)}
              sub={`p95 ${ms(stats.totalLatencyP95)}`}
            />
          </div>

          <StatTile
            label="Estimated AI cost"
            value={`$${stats.estimatedCostUsd.toFixed(4)}`}
            sub={`Usage-priced attempts in loaded samples; ${stats.unpricedAttempts} unpriced. Not reconciled billing.`}
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <RateCard
              label="Maps resolution"
              ratio={stats.mapsResolutionRate}
              fill="bg-s3"
              note={
                stats.mapsResolutionRate.value != null &&
                stats.mapsResolutionRate.value < 0.5
                  ? "Below 50% — suspect the Scout prompt, not Maps"
                  : "Share of Scout queries that found a real place"
              }
              warn={
                stats.mapsResolutionRate.value != null &&
                stats.mapsResolutionRate.value < 0.5
              }
            />
            <RateCard
              label="Cache hits"
              ratio={stats.cacheHitRate}
              fill="bg-s1"
              note="Served from the pre-generated batch"
            />
            <RateCard
              label="Generic fallback"
              ratio={stats.genericFallbackRate}
              fill="bg-s4"
              note="Runs that needed location-free quests"
            />
            <RateCard
              label="LLM failover"
              ratio={stats.failoverRate}
              fill="bg-s7"
              note="Stages that switched to a fallback provider"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Volume over time">
              <TimeBars buckets={stats.buckets} />
            </Panel>

            <Panel title="Stage latency">
              <HBarChart
                categories={stats.stageLatencies.map((s) => s.stage)}
                series={[
                  {
                    label: "p50",
                    fill: "bg-q50",
                    values: stats.stageLatencies.map((s) => s.p50),
                  },
                  {
                    label: "p95",
                    fill: "bg-q95",
                    values: stats.stageLatencies.map((s) => s.p95),
                  },
                ]}
                format={ms}
              />
            </Panel>

            <Panel title="Outcomes">
              <OutcomeBreakdown stats={stats} />
            </Panel>

            <Panel title="Model usage">
              {stats.providers.length === 0 ? (
                <p className="py-6 text-center text-tiny text-muted">
                  No AI calls in this window
                </p>
              ) : (
                <HBarChart
                  categories={stats.providers.map((p) => p.key)}
                  series={[
                    {
                      label: "calls",
                      fill: "bg-s1",
                      values: stats.providers.map((p) => p.count),
                    },
                  ]}
                  format={(v) => `${v}`}
                />
              )}
            </Panel>
          </div>

          {stats.recentErrors.length > 0 && (
            <Panel title="Recent failures">
              <ul className="divide-y divide-line">
                {stats.recentErrors.map((sample) => (
                  <li key={sample.id}>
                    <Link
                      to={`/admin/logs/${sample.id}`}
                      className="ring-focus flex items-baseline gap-3 rounded-md px-1 py-2 hover:bg-raised"
                    >
                      <span className="chip border-critical/40 text-critical">
                        {failingStage(sample) ?? "unknown"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-tiny text-dim">
                        {sample.error ?? "No message recorded"}
                      </span>
                      <span className="nums shrink-0 text-micro text-muted">
                        {relative(sample.startedAt, now)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-tiny font-semibold text-dim">{title}</h2>
      {children}
    </section>
  );
}

function RateCard({
  label,
  ratio,
  fill,
  note,
  warn,
}: {
  label: string;
  ratio: { value: number | null; hits: number; total: number };
  fill: string;
  note: string;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-micro font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{pct(ratio.value)}</span>
        <span className="nums text-micro text-muted">
          {ratio.hits}/{ratio.total}
        </span>
      </div>
      <Meter value={ratio.value} fill={fill} />
      <p className={`mt-2 text-micro ${warn ? "text-warning" : "text-muted"}`}>
        {note}
      </p>
    </div>
  );
}

function OutcomeBreakdown({ stats }: { stats: DashboardStats }) {
  const present = OUTCOMES.filter((o) => stats.byOutcome[o.key] > 0);
  if (present.length === 0) {
    return <p className="py-6 text-center text-tiny text-muted">No outcomes yet</p>;
  }

  return (
    <div>
      <div className="mb-3">
        <Legend items={present.map((o) => ({ label: o.label, swatch: o.fill }))} />
      </div>

      {/* One stacked bar, 2px surface gaps between segments. */}
      <div className="flex h-3 w-full gap-[2px] overflow-hidden">
        {present.map((o) => (
          <div
            key={o.key}
            className={`h-full rounded-mark ${o.fill}`}
            style={{ width: `${(stats.byOutcome[o.key] / stats.total) * 100}%` }}
            title={`${o.label}: ${stats.byOutcome[o.key]}`}
          />
        ))}
      </div>

      <table className="mt-4 w-full text-tiny">
        <tbody className="divide-y divide-line">
          {present.map((o) => (
            <tr key={o.key}>
              <td className="py-1.5">
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-sm ${o.fill}`} aria-hidden />
                  <span className="text-dim">{o.label}</span>
                </span>
              </td>
              <td className="nums py-1.5 text-right text-muted">
                {stats.byOutcome[o.key]}
              </td>
              <td className="nums w-14 py-1.5 text-right text-muted">
                {pct(stats.byOutcome[o.key] / stats.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Marketing-site traffic (usehorizon.app). Reads the aggregate per-day counters
 * written by the `trackEvent` function — there are no per-visitor records to
 * show, by design, so everything here is a total or a rate.
 *
 * Loaded independently of the pipeline stats above: a failure here must not take
 * the rest of the dashboard down with it, so the error is reported inline.
 */
function SiteTraffic() {
  const [data, setData] = useState<SiteTotals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSiteMetrics(30)
      .then((d) => !cancelled && setData(d))
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = data?.days[data.days.length - 1];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-base font-semibold">Site traffic</h1>
        <span className="text-micro text-muted">Last 30 days · usehorizon.app</span>
      </div>

      {error && (
        <div className="card p-4 text-tiny text-critical">
          Couldn&apos;t load site metrics: {error}
        </div>
      )}

      {!error && !data && (
        <div className="card p-4 text-tiny text-muted">Loading…</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Visits"
              value={data.visits.toLocaleString()}
              sub={`${today?.visits ?? 0} today`}
            />
            <StatTile
              label="Page views"
              value={data.pageviews.toLocaleString()}
              sub={`${today?.pageviews ?? 0} today`}
            />
            <StatTile
              label="Download clicks"
              value={data.downloadClicks.toLocaleString()}
              sub={`${today?.downloadClicks ?? 0} today`}
            />
            <StatTile
              label="Click rate"
              value={data.conversion == null ? "—" : pct(data.conversion)}
              sub="clicks ÷ visits"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card p-4">
              <div className="mb-3 text-tiny font-medium">Visits per day</div>
              <DayBars
                days={data.days.map((d) => ({ date: d.date, value: d.visits }))}
                label="visit"
              />
            </div>

            <div className="card p-4">
              <div className="mb-3 text-tiny font-medium">Where visits came from</div>
              <HBarChart
                categories={data.topReferrers.slice(0, 6).map((r) => r.host)}
                series={[
                  {
                    label: "Visits",
                    fill: "bg-s1",
                    values: data.topReferrers.slice(0, 6).map((r) => r.count),
                  },
                ]}
                format={(v) => v.toLocaleString()}
                emptyNote="No referrers recorded yet"
              />
              <div className="mt-4 border-t border-line pt-3 text-micro text-muted nums">
                {data.devices.mobile + data.devices.desktop > 0
                  ? `${pct(data.devices.mobile / (data.devices.mobile + data.devices.desktop))} on mobile`
                  : "No device data yet"}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
