import { useState } from 'react';
import { Download, Search, ChevronDown, ChevronRight, Image } from 'lucide-react';
import { money } from '../lib/api';
import {
  OutcomeValues,
  entityOutcomes,
  entityOutcomeMetrics,
  observedOutcomes,
  outcomeLabels,
  outcomeCount,
  outcomeCost,
  type OutcomeKind,
} from './meta-outcomes';
import { Button, Field, Status } from '../components/ui';

type M = Record<string, number | null> & { actions?: Record<string, number> };
export type ReportEntity = {
  id: string;
  name: string;
  campaign_id?: string;
  adset_id?: string;
  effective_status: string;
  objective?: string;
  destination_type?: string;
  optimization_goal?: string;
  metrics: M;
  previous: M;
  creative?: { image_url?: string; thumbnail_url?: string; title?: string; body?: string };
};
export type DailyAd = M & {
  day: string;
  campaignId: string;
  adsetId?: string;
  adId?: string;
  campaignName?: string;
  adsetName?: string;
  adName?: string;
};
type Level = 'campaign' | 'adset' | 'ad';
const columns = [
  ['spend', 'Spend'],
  ['impressions', 'Impressions'],
  ['inline_link_clicks', 'Link clicks'],
  ['result', 'Results'],
  ['cost', 'Cost / result'],
  ['previousCost', 'Previous cost'],
  ['change', 'Cost change'],
  ['ctr', 'Link CTR'],
  ['cpc', 'Link CPC'],
  ['cpm', 'CPM'],
  ['reach', 'Reach'],
  ['frequency', 'Frequency'],
] as const;
const defaults = ['spend', 'impressions', 'result', 'cost', 'change', 'ctr'];
const n = (m: M | undefined, k: string) => Number(m?.[k] || 0);
function sum(rows: M[]): M {
  const m: M = {};
  for (const k of [
    'spend',
    'impressions',
    'inline_link_clicks',
    'messages',
    'installs',
    'purchases',
  ])
    m[k] = rows.reduce((s, r) => s + n(r, k), 0);
  m.actions = {};
  for (const row of rows)
    for (const [key, v] of Object.entries(row.actions || {}))
      m.actions[key] = (m.actions[key] || 0) + Number(v);
  m.ctr = n(m, 'impressions') ? (n(m, 'inline_link_clicks') / n(m, 'impressions')) * 100 : null;
  m.cpc = n(m, 'inline_link_clicks') ? n(m, 'spend') / n(m, 'inline_link_clicks') : null;
  m.cpm = n(m, 'impressions') ? (n(m, 'spend') / n(m, 'impressions')) * 1000 : null;
  return m;
}
function csvCell(v: unknown) {
  let s = String(v ?? '');
  if (typeof v !== 'number' && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}

export function MetaReportExplorer({
  levels,
  daily,
  dailyAds,
  currency,
  from,
  to,
  scopeKey,
  onSelect,
}: {
  levels: Record<Level, ReportEntity[]>;
  daily: DailyAd[];
  dailyAds?: DailyAd[];
  currency: string;
  from: string;
  to: string;
  scopeKey: string;
  onSelect: (level: Level, id: string) => void;
}) {
  const [view, setView] = useState<'campaign' | 'adset' | 'ad' | 'daily' | 'creative'>('campaign');
  const [search, setSearch] = useState('');
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [selectedAdsets, setSelectedAdsets] = useState<string[]>([]);
  const [delivery, setDelivery] = useState('all');
  const [purpose, setPurpose] = useState('all');
  const [minSpend, setMinSpend] = useState('1');
  const [sort, setSort] = useState('spend');
  const [chart, setChart] = useState('messages');
  const [chartMode, setChartMode] = useState('compare');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('arg-meta-columns') || 'null');
      if (Array.isArray(saved)) {
        const valid = saved.filter((k) => columns.some((c) => c[0] === k));
        if (valid.length) return valid;
      }
    } catch {
      /* Use default columns when saved preferences are invalid. */
    }
    return defaults;
  });
  const resultLabel = 'Results';
  const fmt = (v: number | null | undefined) => (v == null ? '—' : money(v, currency, 2));
  const num = (v: number | null | undefined) =>
    v == null ? '—' : Number(v).toLocaleString('en-IN');
  const percent = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(2) + '%');
  const campaignBy = new Map(levels.campaign.map((c) => [c.id, c]));
  const adsetBy = new Map(levels.adset.map((c) => [c.id, c]));
  const adBy = new Map(levels.ad.map((c) => [c.id, c]));
  function dailyKinds(items: DailyAd[]): OutcomeKind[] {
    return [
      ...new Set(
        items.flatMap((d) => {
          const e = d.adId ? adBy.get(d.adId) : campaignBy.get(d.campaignId);
          return e ? entityOutcomes(e, levels) : observedOutcomes(d);
        }),
      ),
    ];
  }
  function dailyOutcomeMetrics(items: DailyAd[], kind: OutcomeKind): M {
    return sum(items.filter((d) => dailyKinds([d]).includes(kind)));
  }
  function purposeOf(e: ReportEntity) {
    const c = campaignBy.get(e.campaign_id || e.id);
    const a = adsetBy.get(e.adset_id || e.id);
    const text =
      `${e.objective || c?.objective || ''} ${e.destination_type || a?.destination_type || ''} ${e.optimization_goal || a?.optimization_goal || ''}`.toUpperCase();
    if (/APP_PROMOTION|APP_INSTALL|MOBILE_APP/.test(text)) return 'app';
    if (/WHATSAPP|MESSENGER|INSTAGRAM_DIRECT|CONVERSATION|MESSAGES/.test(text)) return 'messages';
    if (/LEADS|LEAD_GENERATION/.test(text)) return 'leads';
    if (/SALES|PURCHASE/.test(text)) return 'sales';
    return 'other';
  }
  function toggleSelection(id: string) {
    if (level === 'campaign') {
      setSelectedCampaigns((ids) =>
        ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      );
      setSelectedAdsets([]);
    } else {
      setSelectedAdsets((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    }
  }
  function viewChildren(next: 'adset' | 'ad') {
    setSearch('');
    setView(next);
  }
  function extraOutcomes(e: ReportEntity) {
    const primary = entityOutcomes(e, levels);
    const kinds: OutcomeKind[] = [...observedOutcomes(e.metrics), 'linkClicks'];
    const extra = kinds.filter((k) => !primary.includes(k) && outcomeCount(e.metrics, k) > 0);
    return extra.length ? (
      <div className="meta-extra-outcomes" aria-label="Other recorded outcomes">
        {extra.map((k) => (
          <span key={k}>
            {num(outcomeCount(e.metrics, k))} {outcomeLabels[k]}
          </span>
        ))}
      </div>
    ) : null;
  }
  function eligible(e: ReportEntity) {
    const parent = e.campaign_id || e.id;
    return (
      (!campaigns.length || campaigns.includes(parent)) &&
      (level === 'campaign' || !selectedCampaigns.length || selectedCampaigns.includes(parent)) &&
      (level !== 'ad' || !selectedAdsets.length || selectedAdsets.includes(e.adset_id || '')) &&
      (delivery === 'all' || e.effective_status === delivery) &&
      (purpose === 'all' || purposeOf(e) === purpose) &&
      n(e.metrics, 'spend') >= Number(minSpend || 0) &&
      `${e.name} ${e.id} ${campaignBy.get(parent)?.name || ''} ${adsetBy.get(e.adset_id || '')?.name || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }
  const level: Level =
    view === 'adset'
      ? 'adset'
      : view === 'ad' || view === 'creative' || view === 'daily'
        ? 'ad'
        : 'campaign';
  const rows = levels[level].filter(eligible).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'cost')
      return (
        (outcomeCost(a.metrics, entityOutcomes(a, levels)[0]) ?? Infinity) -
        (outcomeCost(b.metrics, entityOutcomes(b, levels)[0]) ?? Infinity)
      );
    return (
      (sort === 'result'
        ? outcomeCount(b.metrics, entityOutcomes(b, levels)[0])
        : n(b.metrics, sort)) -
      (sort === 'result'
        ? outcomeCount(a.metrics, entityOutcomes(a, levels)[0])
        : n(a.metrics, sort))
    );
  });
  // Daily reach cannot be added across people, ads, or days; only additive metrics are grouped here.
  const source = dailyAds || daily;
  const days = new Map<string, DailyAd[]>();
  for (const r of source) {
    const e =
      !dailyAds || level === 'campaign'
        ? campaignBy.get(r.campaignId)
        : level === 'adset'
          ? adsetBy.get(r.adsetId || '')
          : adBy.get(r.adId || '');
    if (!e || !eligible(e)) continue;
    days.set(r.day, [...(days.get(r.day) || []), r]);
  }
  const dateRows = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, items, metrics: sum(items) }));
  const activeCols = columns.filter(
    (c) =>
      visible.includes(c[0]) &&
      (view !== 'daily' || !['previousCost', 'change', 'reach', 'frequency'].includes(c[0])),
  );
  function value(m: M, k: string, prev?: M, kind: OutcomeKind = observedOutcomes(m)[0]) {
    if (k === 'result') return outcomeCount(m, kind);
    if (k === 'cost') return outcomeCost(m, kind);
    if (k === 'previousCost') return outcomeCost(prev, kind);
    if (k === 'change') {
      const before = outcomeCost(prev, kind);
      const now = outcomeCost(m, kind);
      return before && now != null ? ((now - before) / before) * 100 : null;
    }
    return m[k];
  }
  function display(m: M, k: string, prev?: M) {
    const v = value(m, k, prev);
    if (['spend', 'cost', 'previousCost', 'cpc', 'cpm'].includes(k)) return fmt(v);
    if (k === 'change') return v == null ? 'No baseline' : (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    if (k === 'ctr') return percent(v);
    if (k === 'frequency') return v == null ? '—' : v.toFixed(2);
    return num(v);
  }
  function toggleColumn(k: string) {
    const next = visible.includes(k) ? visible.filter((v) => v !== k) : [...visible, k];
    if (!next.length) return;
    setVisible(next);
    try {
      localStorage.setItem('arg-meta-columns', JSON.stringify(next));
    } catch {
      /* Preferences are optional. */
    }
  }
  function exportCsv() {
    const header = [
      'Name',
      'Date',
      'Campaign ID',
      'Ad set ID',
      'Ad ID',
      'Outcome type',
      ...activeCols.map((c) => c[1]),
    ];
    const data =
      view === 'daily'
        ? dateRows.flatMap((r) =>
            r.items.flatMap((d) => {
              const entity = d.adId ? adBy.get(d.adId) : campaignBy.get(d.campaignId);
              const kinds = entity ? entityOutcomes(entity, levels) : observedOutcomes(d);
              return kinds.map((k) => [
                d.adName || d.campaignName || entity?.name || '',
                r.day,
                d.campaignId,
                d.adsetId || '',
                d.adId || '',
                outcomeLabels[k],
                ...activeCols.map((c) => value(d, c[0], undefined, k)),
              ]);
            }),
          )
        : rows.flatMap((r) =>
            entityOutcomes(r, levels).map((k) => [
              r.name,
              '',
              r.campaign_id || (level === 'campaign' ? r.id : ''),
              r.adset_id || (level === 'adset' ? r.id : ''),
              level === 'ad' ? r.id : '',
              outcomeLabels[k],
              ...activeCols.map((c) =>
                ['result', 'cost', 'previousCost', 'change'].includes(c[0])
                  ? value(
                      entityOutcomeMetrics(r, levels, k),
                      c[0],
                      entityOutcomeMetrics(r, levels, k, true),
                      k,
                    )
                  : value(r.metrics, c[0], r.previous, k),
              ),
            ]),
          );
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + [header, ...data].map((r) => r.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta_${view}_automatic_${from}_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const comparing = chartMode === 'compare';
  const metricKinds: OutcomeKind[] = [
    'messages',
    'installs',
    'leads',
    'purchases',
    'appRegistrations',
    'pixelRegistrations',
    'linkClicks',
  ];
  const chartCount = (metrics: M) => outcomeCount(metrics, chart as OutcomeKind);
  function chartScale(values: number[], count: boolean) {
    const max = Math.max(1, ...values);
    const magnitude = 10 ** Math.floor(Math.log10(max / 4));
    const rough = max / 4 / magnitude;
    const raw = (rough <= 1 ? 1 : rough <= 2 ? 2 : rough <= 5 ? 5 : 10) * magnitude;
    const step = count ? Math.max(1, Math.ceil(raw)) : raw;
    const top = Math.ceil(max / step) * step;
    return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
  }
  const leftIsSpend = comparing || chart === 'spend';
  const leftValue = (metrics: M) => (leftIsSpend ? n(metrics, 'spend') : chartCount(metrics));
  const leftScale = chartScale(
    dateRows.map((r) => leftValue(r.metrics)),
    !leftIsSpend,
  );
  const rightScale = chartScale(
    dateRows.map((r) => chartCount(r.metrics)),
    true,
  );
  const chartWidth = Math.max(500, dateRows.length * 56);
  const x = (i: number) => ((i + 0.5) * chartWidth) / Math.max(1, dateRows.length);
  const y = (value: number, top: number) => 234 - (value / top) * 190;
  const linePoints = dateRows
    .map((r, i) => `${x(i)},${y(chartCount(r.metrics), rightScale.top)}`)
    .join(' ');
  const selectedTotals = sum(rows.map((r) => r.metrics));
  return (
    <section className="meta-explorer" key={scopeKey}>
      <div className="panel meta-trend-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE DAILY PICTURE</span>
            <h3>How performance is moving</h3>
          </div>
          <div className="meta-chart-controls">
            <Field label="Chart view">
              <select
                value={chartMode}
                onChange={(e) => {
                  setChartMode(e.target.value);
                  if (e.target.value === 'compare' && chart === 'spend') setChart('messages');
                }}
              >
                <option value="compare">Spend vs outcomes</option>
                <option value="single">One metric</option>
              </select>
            </Field>
            <Field label={comparing ? 'Compare spend with' : 'Chart metric'}>
              <select value={chart} onChange={(e) => setChart(e.target.value)}>
                {!comparing && <option value="spend">Spend</option>}
                {metricKinds.map((k) => (
                  <option value={k} key={k}>
                    {outcomeLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <p className="tiny muted">
          {from} → {to} · Chart follows the report filters below. Scroll sideways for longer ranges.
        </p>
        <div className="meta-chart-legend">
          <span>
            <i className="meta-spend-key" />
            {leftIsSpend
              ? `Spend (${currency}) · left axis`
              : `${outcomeLabels[chart as OutcomeKind]} · left axis`}
          </span>
          {comparing && (
            <span>
              <i className="meta-count-key" />
              {outcomeLabels[chart as OutcomeKind]} · right axis
            </span>
          )}
        </div>
        <div
          className="meta-combo-chart"
          role="group"
          aria-label={
            comparing
              ? `Daily spend versus ${outcomeLabels[chart as OutcomeKind]}`
              : `Daily ${chart}`
          }
        >
          <div className="meta-combo-axis" aria-hidden="true">
            {leftScale.ticks.map((t) => (
              <span key={t} style={{ top: y(t, leftScale.top) }}>
                {leftIsSpend ? money(t, currency) : num(t)}
              </span>
            ))}
          </div>
          <div className="meta-combo-scroll">
            <svg
              className="meta-combo-svg"
              viewBox={`0 0 ${chartWidth} 266`}
              style={{ minWidth: chartWidth }}
              role="img"
              aria-label={
                comparing
                  ? 'Purple spend bars and green outcome line, using separate scales'
                  : 'Daily metric bars'
              }
            >
              {leftScale.ticks.map((t) => (
                <line
                  key={t}
                  x1="0"
                  x2={chartWidth}
                  y1={y(t, leftScale.top)}
                  y2={y(t, leftScale.top)}
                  stroke="#edeaf5"
                />
              ))}
              {dateRows.map((r, i) => {
                const v = leftValue(r.metrics);
                const label = leftIsSpend ? fmt(v) : num(v);
                return (
                  <g
                    key={r.day}
                    tabIndex={0}
                    className="meta-chart-mark"
                    aria-label={`${r.day}: ${leftIsSpend ? 'Spend ' : ''}${label}${comparing ? `; ${outcomeLabels[chart as OutcomeKind]} ${num(chartCount(r.metrics))}` : ''}`}
                  >
                    <title>
                      {r.day}: {label}
                      {comparing
                        ? ` · ${outcomeLabels[chart as OutcomeKind]}: ${num(chartCount(r.metrics))}`
                        : ''}
                    </title>
                    <rect
                      x={x(i) - 13}
                      y={y(v, leftScale.top)}
                      width="26"
                      height={v ? Math.max(1, 234 - y(v, leftScale.top)) : 0}
                      rx="3"
                      fill="#8670ed"
                    />
                    <text
                      x={x(i)}
                      y={y(v, leftScale.top) - 8}
                      textAnchor="middle"
                      className="meta-spend-value"
                    >
                      {label}
                    </text>
                    <text x={x(i)} y="256" textAnchor="middle" className="meta-chart-date">
                      {r.day.slice(5)}
                    </text>
                  </g>
                );
              })}
              {comparing && (
                <>
                  <polyline points={linePoints} fill="none" stroke="#078b70" strokeWidth="2.5" />
                  {dateRows.map((r, i) => {
                    const count = chartCount(r.metrics),
                      cy = y(count, rightScale.top);
                    return (
                      <g key={r.day} aria-hidden="true">
                        <circle
                          cx={x(i)}
                          cy={cy}
                          r="3.5"
                          fill="#078b70"
                          stroke="white"
                          strokeWidth="1.5"
                        />
                        <text x={x(i)} y={cy + 15} textAnchor="middle" className="meta-count-value">
                          {num(count)}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
            </svg>
          </div>
          {comparing && (
            <div className="meta-combo-axis meta-combo-axis-right" aria-hidden="true">
              {rightScale.ticks.map((t) => (
                <span key={t} style={{ top: y(t, rightScale.top) }}>
                  {num(t)}
                </span>
              ))}
            </div>
          )}
        </div>
        {comparing && (
          <p className="meta-chart-scale-note">
            Spend and outcome counts use separate axes. Values are reported for the same day; they
            do not establish attribution between that day's spend and results.
          </p>
        )}
        {!dateRows.length && <p className="muted">No daily data matches these filters.</p>}
      </div>
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">EXPLORE YOUR ADVERTISING</span>
            <h3>Find what works</h3>
          </div>
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={view === 'daily' ? !dateRows.length : !rows.length}
          >
            <Download size={16} />
            Export CSV
          </Button>
        </div>
        <div className="meta-view-tabs" role="group" aria-label="Report view">
          {(
            [
              ['campaign', 'Campaigns'],
              ['adset', 'Ad sets'],
              ['ad', 'Ads'],
              ['daily', 'Day by day'],
              ['creative', 'Creative gallery'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              aria-pressed={view === k}
              className={'button ' + (view === k ? '' : 'ghost')}
              onClick={() => setView(k)}
            >
              {label}
              {k === 'adset' && selectedCampaigns.length > 0
                ? ` · for ${selectedCampaigns.length} campaign${selectedCampaigns.length === 1 ? '' : 's'}`
                : k === 'ad' && (selectedAdsets.length || selectedCampaigns.length)
                  ? ` · for ${selectedAdsets.length || selectedCampaigns.length} ${selectedAdsets.length ? 'ad set' : 'campaign'}${(selectedAdsets.length || selectedCampaigns.length) === 1 ? '' : 's'}`
                  : ''}
            </button>
          ))}
        </div>
        {(selectedCampaigns.length > 0 || selectedAdsets.length > 0) && (
          <div className="meta-selection-bar">
            <div>
              <strong>
                {selectedCampaigns.length > 0
                  ? `${selectedCampaigns.length} campaign${selectedCampaigns.length === 1 ? '' : 's'} selected`
                  : 'All campaigns'}
                {selectedAdsets.length > 0
                  ? ` · ${selectedAdsets.length} ad set${selectedAdsets.length === 1 ? '' : 's'} selected`
                  : ''}
              </strong>
              <small>
                {selectedCampaigns.map((id) => campaignBy.get(id)?.name).join(', ')}
                {selectedAdsets.length > 0
                  ? ` / ${selectedAdsets.map((id) => adsetBy.get(id)?.name).join(', ')}`
                  : ''}
              </small>
            </div>
            <div>
              {selectedCampaigns.length > 0 && (
                <Button variant="secondary" onClick={() => viewChildren('adset')}>
                  View ad sets
                </Button>
              )}
              <Button variant="secondary" onClick={() => viewChildren('ad')}>
                View ads
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedCampaigns([]);
                  setSelectedAdsets([]);
                }}
              >
                Clear selection
              </Button>
            </div>
          </div>
        )}
        <div className="meta-explorer-filters">
          <Field label="Search ads or campaigns">
            <div className="meta-search">
              <Search size={16} />
              <input
                placeholder="Name or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Field>
          <details className="meta-campaign-filter">
            <summary>Campaigns · {campaigns.length || 'All'}</summary>
            <div className="meta-filter-menu">
              <Button variant="ghost" onClick={() => setCampaigns([])}>
                All campaigns
              </Button>
              {levels.campaign.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={campaigns.includes(c.id)}
                    onChange={() =>
                      setCampaigns(
                        campaigns.includes(c.id)
                          ? campaigns.filter((id) => id !== c.id)
                          : [...campaigns, c.id],
                      )
                    }
                  />
                  <span>
                    {c.name}
                    <small>{c.id}</small>
                  </span>
                </label>
              ))}
            </div>
          </details>
          <Field label="Delivery">
            <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <Field label="Campaign purpose">
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="all">All purposes</option>
              <option value="messages">Messaging</option>
              <option value="leads">Lead generation</option>
              <option value="app">App promotion</option>
              <option value="sales">Sales</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Minimum period spend">
            <input
              type="number"
              min="0"
              placeholder="0"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
            />
          </Field>
          {view !== 'daily' && (
            <Field label="Sort by">
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="spend">Highest spend</option>
                <option value="result">Most {resultLabel.toLowerCase()}</option>
                <option value="cost">Lowest cost / result</option>
                <option value="name">Name</option>
              </select>
            </Field>
          )}
          <details className="meta-column-filter">
            <summary>Columns</summary>
            <div className="meta-filter-menu">
              {columns.map(([k, label]) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={visible.includes(k)}
                    onChange={() => toggleColumn(k)}
                  />
                  {k === 'result' ? resultLabel : label}
                </label>
              ))}
            </div>
          </details>
        </div>
        <p className="meta-filter-summary">
          {view === 'daily'
            ? `${dateRows.length} days · daily totals`
            : `${rows.length} ${view === 'creative' ? 'creatives' : view === 'campaign' ? 'campaigns' : view === 'adset' ? 'ad sets' : 'ads'} · ${fmt(n(selectedTotals, 'spend'))} spent`}
          <button
            className="meta-row-link"
            onClick={() => {
              setSearch('');
              setCampaigns([]);
              setSelectedCampaigns([]);
              setSelectedAdsets([]);
              setDelivery('all');
              setPurpose('all');
              setMinSpend('1');
            }}
          >
            Reset filters
          </button>
        </p>
        {view === 'daily' && !dailyAds && (
          <p className="meta-help">
            This saved report has campaign-level daily data. Import / refresh after the backend
            update to see daily ad-set and ad details.
          </p>
        )}
        {view === 'creative' ? (
          <div className="meta-creative-grid">
            {rows.map((r) => (
              <article key={r.id} className="meta-creative-card">
                <button
                  className="meta-gallery-image"
                  onClick={() => onSelect('ad', r.id)}
                  aria-label={`Inspect ${r.name}`}
                >
                  {r.creative?.image_url || r.creative?.thumbnail_url ? (
                    <img
                      src={r.creative.image_url || r.creative.thumbnail_url}
                      alt={r.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>
                      <Image size={32} />
                      Preview unavailable
                    </span>
                  )}
                </button>
                <div className="meta-gallery-body">
                  <Status value={r.effective_status} />
                  <button className="meta-row-link" onClick={() => onSelect('ad', r.id)}>
                    {r.name}
                  </button>
                  <small className="muted meta-id">{r.id}</small>
                  <p className="tiny muted">{campaignBy.get(r.campaign_id || '')?.name}</p>
                  {extraOutcomes(r)}
                  <div className="meta-gallery-numbers">
                    <span>
                      Spent<strong>{fmt(r.metrics.spend)}</strong>
                    </span>
                    <span>
                      {resultLabel}
                      <OutcomeValues
                        metrics={r.metrics}
                        kinds={entityOutcomes(r, levels)}
                        byKind={(kind) => entityOutcomeMetrics(r, levels, kind)}
                        previousByKind={(kind) => entityOutcomeMetrics(r, levels, kind, true)}
                        currency={currency}
                      />
                    </span>
                    <span>
                      Cost / result
                      <OutcomeValues
                        metrics={r.metrics}
                        kinds={entityOutcomes(r, levels)}
                        byKind={(kind) => entityOutcomeMetrics(r, levels, kind)}
                        previousByKind={(kind) => entityOutcomeMetrics(r, levels, kind, true)}
                        currency={currency}
                        mode="cost"
                      />
                    </span>
                    <span>
                      Link CTR<strong>{percent(r.metrics.ctr)}</strong>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {view !== 'daily' && (level === 'campaign' || level === 'adset') && (
                    <th className="meta-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select all visible ${level === 'campaign' ? 'campaigns' : 'ad sets'}`}
                        checked={
                          rows.length > 0 &&
                          rows.every((r) =>
                            (level === 'campaign' ? selectedCampaigns : selectedAdsets).includes(
                              r.id,
                            ),
                          )
                        }
                        onChange={(e) => {
                          const ids = rows.map((r) => r.id);
                          if (level === 'campaign') {
                            setSelectedCampaigns((old) =>
                              e.target.checked
                                ? [...new Set([...old, ...ids])]
                                : old.filter((id) => !ids.includes(id)),
                            );
                            setSelectedAdsets([]);
                          } else
                            setSelectedAdsets((old) =>
                              e.target.checked
                                ? [...new Set([...old, ...ids])]
                                : old.filter((id) => !ids.includes(id)),
                            );
                        }}
                      />
                    </th>
                  )}
                  <th>{view === 'daily' ? 'Day / campaign / ad' : 'Name'}</th>
                  {view !== 'daily' && <th>Delivery</th>}
                  {activeCols.map(([k, label]) => (
                    <th key={k}>{k === 'result' ? resultLabel : label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view === 'daily'
                  ? [...dateRows].reverse().map((r) => (
                      <tr key={r.day}>
                        <td colSpan={activeCols.length + 1}>
                          <details className="meta-daily-group">
                            <summary>
                              <span>
                                <strong>{r.day}</strong>
                                <small>
                                  {r.items.length} {dailyAds ? 'ad' : 'campaign'} records
                                </small>
                              </span>
                              <span>
                                {fmt(n(r.metrics, 'spend'))}
                                <OutcomeValues
                                  metrics={r.metrics}
                                  kinds={dailyKinds(r.items)}
                                  byKind={(kind) => dailyOutcomeMetrics(r.items, kind)}
                                  currency={currency}
                                />
                              </span>
                            </summary>
                            <div className="table-wrap">
                              <table>
                                <tbody>
                                  <tr>
                                    <td>
                                      <strong>Day total</strong>
                                    </td>
                                    {activeCols.map(([k]) => (
                                      <td key={k}>
                                        {k === 'cost' &&
                                        !dailyAds &&
                                        dailyKinds(r.items).length > 1 ? (
                                          'See individual campaigns'
                                        ) : ['result', 'cost'].includes(k) ? (
                                          <OutcomeValues
                                            metrics={r.metrics}
                                            kinds={dailyKinds(r.items)}
                                            byKind={(kind) => dailyOutcomeMetrics(r.items, kind)}
                                            currency={currency}
                                            mode={k as 'result' | 'cost'}
                                          />
                                        ) : (
                                          display(r.metrics, k)
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                  {[...new Set(r.items.map((i) => i.campaignId))].map((id) => {
                                    const items = r.items.filter((i) => i.campaignId === id);
                                    return (
                                      <tr key={id}>
                                        <td colSpan={activeCols.length + 1}>
                                          <details>
                                            <summary>
                                              {campaignBy.get(id)?.name ||
                                                items[0].campaignName ||
                                                id}{' '}
                                              · {fmt(n(sum(items), 'spend'))}
                                            </summary>
                                            <table>
                                              <tbody>
                                                {items.map((d, i) => (
                                                  <tr key={`${d.adId || id}-${i}`}>
                                                    <td>
                                                      <button
                                                        className="meta-row-link"
                                                        onClick={() =>
                                                          onSelect(
                                                            d.adId ? 'ad' : 'campaign',
                                                            d.adId || id,
                                                          )
                                                        }
                                                      >
                                                        {d.adName ||
                                                          d.campaignName ||
                                                          adBy.get(d.adId || '')?.name ||
                                                          campaignBy.get(id)?.name ||
                                                          id}
                                                      </button>
                                                      <small className="meta-id muted">
                                                        {d.adsetName ||
                                                          adsetBy.get(d.adsetId || '')?.name}{' '}
                                                        {d.adId && `(${d.adId})`}
                                                      </small>
                                                    </td>
                                                    {activeCols.map(([k]) => (
                                                      <td key={k}>
                                                        {['result', 'cost'].includes(k) ? (
                                                          <OutcomeValues
                                                            metrics={d}
                                                            kinds={
                                                              d.adId && adBy.get(d.adId)
                                                                ? entityOutcomes(
                                                                    adBy.get(d.adId)!,
                                                                    levels,
                                                                  )
                                                                : observedOutcomes(d)
                                                            }
                                                            currency={currency}
                                                            mode={k as 'result' | 'cost'}
                                                          />
                                                        ) : (
                                                          display(d, k)
                                                        )}
                                                      </td>
                                                    ))}
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </details>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))
                  : rows.map((r) => (
                      <tr
                        key={r.id}
                        className={
                          (level === 'campaign' ? selectedCampaigns : selectedAdsets).includes(r.id)
                            ? 'meta-selected-row'
                            : ''
                        }
                      >
                        {(level === 'campaign' || level === 'adset') && (
                          <td className="meta-select-cell">
                            <input
                              type="checkbox"
                              aria-label={`Select ${r.name} (${r.id})`}
                              checked={(level === 'campaign'
                                ? selectedCampaigns
                                : selectedAdsets
                              ).includes(r.id)}
                              onChange={() => toggleSelection(r.id)}
                            />
                          </td>
                        )}
                        <td>
                          <button className="meta-row-link" onClick={() => onSelect(level, r.id)}>
                            {r.name}
                          </button>
                          <small className="meta-id muted">({r.id})</small>
                          {extraOutcomes(r)}
                          {level !== 'campaign' && (
                            <small className="meta-id muted">
                              {campaignBy.get(r.campaign_id || '')?.name}
                            </small>
                          )}
                          {level === 'campaign' && (
                            <button
                              className="meta-expand"
                              aria-expanded={!!expanded[r.id]}
                              onClick={() => setExpanded({ ...expanded, [r.id]: !expanded[r.id] })}
                            >
                              {expanded[r.id] ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                              Ad sets & ads
                            </button>
                          )}
                          {level === 'campaign' && expanded[r.id] && (
                            <div className="meta-child-list">
                              {levels.adset
                                .filter((a) => a.campaign_id === r.id)
                                .map((a) => (
                                  <div key={a.id}>
                                    <button
                                      className="meta-row-link"
                                      onClick={() => onSelect('adset', a.id)}
                                    >
                                      {a.name}
                                    </button>
                                    <small>
                                      {fmt(a.metrics.spend)}
                                      <OutcomeValues
                                        metrics={a.metrics}
                                        kinds={entityOutcomes(a, levels)}
                                        byKind={(kind) => entityOutcomeMetrics(a, levels, kind)}
                                        previousByKind={(kind) =>
                                          entityOutcomeMetrics(a, levels, kind, true)
                                        }
                                        currency={currency}
                                      />
                                    </small>
                                    {levels.ad
                                      .filter((d) => d.adset_id === a.id)
                                      .map((d) => (
                                        <button
                                          key={d.id}
                                          className="meta-child-ad"
                                          onClick={() => onSelect('ad', d.id)}
                                        >
                                          {d.name}{' '}
                                          <span>
                                            <OutcomeValues
                                              metrics={d.metrics}
                                              kinds={entityOutcomes(d, levels)}
                                              byKind={(kind) =>
                                                entityOutcomeMetrics(d, levels, kind)
                                              }
                                              previousByKind={(kind) =>
                                                entityOutcomeMetrics(d, levels, kind, true)
                                              }
                                              currency={currency}
                                              mode="cost"
                                            />
                                          </span>
                                        </button>
                                      ))}
                                  </div>
                                ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <Status value={r.effective_status} />
                          <small className="meta-id muted">
                            {r.destination_type || r.objective || r.optimization_goal}
                          </small>
                        </td>
                        {activeCols.map(([k]) => (
                          <td
                            key={k}
                            className={
                              k === 'change' && value(r.metrics, k, r.previous) != null
                                ? Number(value(r.metrics, k, r.previous)) <= 0
                                  ? 'meta-positive'
                                  : 'meta-negative'
                                : ''
                            }
                          >
                            {['result', 'cost', 'previousCost', 'change'].includes(k) ? (
                              <OutcomeValues
                                metrics={r.metrics}
                                previous={r.previous}
                                kinds={entityOutcomes(r, levels)}
                                byKind={(kind) => entityOutcomeMetrics(r, levels, kind)}
                                previousByKind={(kind) =>
                                  entityOutcomeMetrics(r, levels, kind, true)
                                }
                                currency={currency}
                                mode={k as 'result' | 'cost' | 'previousCost' | 'change'}
                              />
                            ) : (
                              display(r.metrics, k, r.previous)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
        {(view === 'daily' ? !dateRows.length : !rows.length) && (
          <p className="meta-help">
            No results match these filters. Try resetting them or importing a different date range.
          </p>
        )}
        <p className="tiny muted">
          Filters affect this explorer and chart; summary cards above show the whole account or
          selected item. Delivery is its latest imported status, not its status on each historical
          day. Results follow the Meta goal automatically; mixed outcomes are shown separately. A
          dash means no measurable results. Conversations are not bookings. Reach is not summed in
          daily views. Lower cost needs sufficient results before judging a winner.
        </p>
      </div>
    </section>
  );
}
