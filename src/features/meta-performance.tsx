import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Sparkles, X, ArrowLeft, ExternalLink } from 'lucide-react';
import { api, money } from '../lib/api';
import { MetaAssetSelector, useMetaStatus } from './meta-assets';
import { MetaReportExplorer, type DailyAd } from './meta-report-explorer';
import {
  OutcomeValues,
  entityOutcomes,
  entityOutcomeMetrics,
  observedOutcomes,
  type OutcomeKind,
  type OutcomeMetrics,
} from './meta-outcomes';
import { useWorkspace } from '../lib/workspace';
import { Button, Field, Heading, Notice, Loading, Stat, Status, Empty } from '../components/ui';

type Metrics = Record<string, number | null> & { actions: Record<string, number> };
type Entity = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id?: string;
  adset_id?: string;
  objective?: string;
  destination_type?: string;
  optimization_goal?: string;
  targeting?: unknown;
  attribution_spec?: unknown;
  daily_budget?: string;
  lifetime_budget?: string;
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    body?: string;
    title?: string;
    object_story_spec?: unknown;
    asset_feed_spec?: unknown;
  };
  metrics: Metrics;
  previous: Metrics;
};
type Level = 'campaign' | 'adset' | 'ad';
type Answer = {
  summary: string;
  facts: string[];
  hypotheses: string[];
  recommendations: string[];
  limitations: string[];
};
type Discussion = { id: string; question: string; answer: Answer; created_at?: string };
type Snapshot = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  fetchedAt: string;
  attribution: string;
  account: { id: string; name: string; currency: string; timezone_name: string };
  totals: Metrics;
  previousTotals: Metrics;
  levels: Record<Level, Entity[]>;
  daily: DailyAd[];
  dailyAds?: DailyAd[];
};
type Report = {
  connected: boolean;
  selection: { account_id?: string; page_id?: string };
  snapshot: Partial<Snapshot>;
  sync: { state?: string; error_message?: string; from_day?: string; to_day?: string };
};
function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function delta(now: number | null | undefined, before: number | null | undefined) {
  if (now == null || before == null || before === 0) return 'No comparable baseline';
  const n = ((now - before) / before) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}% vs previous period`;
}
const number = (v: unknown) => Number(v || 0).toLocaleString('en-IN');

export function MetaPerformancePage() {
  const { base, owner, business } = useWorkspace();
  const cache = useQueryClient();
  const [from, setFrom] = useState(localDay(-29)),
    [to, setTo] = useState(localDay());
  const [selected, setSelected] = useState<{ level: Level; id: string } | null>(null);
  const [question, setQuestion] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [asking, setAsking] = useState(false),
    [confirm, setConfirm] = useState(false);
  const [evidence, setEvidence] = useState<unknown>(null);
  const metaStatus = useMetaStatus();
  const accountId = String(metaStatus.data?.selection.account_id || '');
  useEffect(() => {
    setSelected(null);
    setEvidence(null);
    setConfirm(false);
    setQuestion('');
    setError('');
  }, [base, accountId]);
  const params = `?from=${from}&to=${to}`;
  const report = useQuery({
    queryKey: [base, 'meta-performance', accountId, from, to],
    enabled: !owner || (!metaStatus.isLoading && !metaStatus.error),
    queryFn: () => api<Report>(base + '/meta/performance' + params),
    refetchInterval: (q) =>
      ['QUEUED', 'RUNNING'].includes(q.state.data?.sync.state || '') ? 3000 : false,
  });
  const scope = selected?.level || 'account',
    scopeId = selected?.id || '';
  const history = useQuery({
    queryKey: [base, 'meta-analysis', accountId, from, to, scope, scopeId],
    queryFn: () =>
      api<Discussion[]>(base + '/meta/analysis' + params + `&level=${scope}&entityId=${scopeId}`),
    enabled: !!report.data?.snapshot.fetchedAt,
  });
  const sharing = useQuery({
    queryKey: [base, 'meta-sharing'],
    queryFn: () =>
      api<{ provider: string; ready: boolean; data: string[] }>(base + '/meta/analysis/sharing'),
  });
  const matchesAccount = !owner || String(report.data?.selection.account_id || '') === accountId;
  const snap = (matchesAccount ? report.data?.snapshot : undefined) as Snapshot | undefined;
  const imported = !!snap?.fetchedAt;
  const entity = selected
    ? snap?.levels?.[selected.level]?.find((e) => e.id === selected.id)
    : undefined;
  const current = entity?.metrics || snap?.totals,
    previous = entity?.previous || snap?.previousTotals;
  const currency = snap?.account?.currency || business.currency;
  const outcomeKinds =
    entity && snap ? entityOutcomes(entity, snap.levels) : observedOutcomes(current || {});
  const campaignOutcomeKinds: OutcomeKind[] = snap
    ? [...new Set(snap.levels.campaign.flatMap((e) => entityOutcomes(e, snap.levels)))]
    : [];
  const campaignOutcomeMetrics = (kind: OutcomeKind): OutcomeMetrics => {
    const actions: Record<string, number> = {};
    const totals: Record<string, number> = {};
    for (const campaign of snap?.levels.campaign || []) {
      if (!snap || !entityOutcomes(campaign, snap.levels).includes(kind)) continue;
      const metrics = entityOutcomeMetrics(campaign, snap.levels, kind);
      for (const [key, value] of Object.entries(metrics))
        if (typeof value === 'number' && !['reach', 'frequency'].includes(key))
          totals[key] = (totals[key] || 0) + value;
      for (const [key, value] of Object.entries(metrics.actions || {}))
        actions[key] = (actions[key] || 0) + value;
    }
    return { ...totals, actions } as OutcomeMetrics;
  };
  const fmt = (n: number | null | undefined) => (n == null ? '—' : money(n, currency, 2));
  const working = ['QUEUED', 'RUNNING'].includes(report.data?.sync.state || '');
  async function sync() {
    setBusy(true);
    setError('');
    try {
      await api(base + '/meta/sync' + params, 'POST');
      await cache.invalidateQueries({ queryKey: [base, 'meta-performance'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function ask() {
    setConfirm(false);
    setAsking(true);
    setError('');
    try {
      const reply = await api<Discussion & { evidence: unknown }>(base + '/meta/analysis', 'POST', {
        from,
        to,
        level: scope,
        entityId: scopeId,
        question,
        approveDataSharing: true,
      });
      setEvidence(reply.evidence);
      setQuestion('');
      await cache.invalidateQueries({ queryKey: [base, 'meta-analysis'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  }
  function changeDates(a: string, b: string) {
    setFrom(a);
    setTo(b);
    setSelected(null);
    setEvidence(null);
  }
  return (
    <>
      <Heading
        eyebrow="YOUR META ACCOUNT"
        title="Ad performance"
        description="See what ran, what it cost, and what to improve next."
        action={
          <Link className="button secondary" to="/settings">
            Meta connection
          </Link>
        }
      />
      {owner && (
        <MetaAssetSelector
          disabled={busy || working || asking}
          onChange={async (accountChanged) => {
            setSelected(null);
            setEvidence(null);
            setConfirm(false);
            setQuestion('');
            if (accountChanged) await sync();
          }}
        />
      )}
      <section className="panel meta-toolbar">
        <Field label="From">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => changeDates(e.target.value, to)}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={to}
            min={from}
            max={localDay()}
            onChange={(e) => changeDates(from, e.target.value)}
          />
        </Field>
        {owner && (
          <Button onClick={sync} disabled={busy || working || !report.data?.connected}>
            <RefreshCw size={16} className={working ? 'spin' : ''} />
            {working ? 'Importing…' : busy ? 'Queuing…' : 'Import / refresh'}
          </Button>
        )}
      </section>
      {error && <Notice error>{error}</Notice>}
      {report.error && <Notice error>{report.error.message}</Notice>}
      {report.isLoading ? (
        <Loading />
      ) : !report.data?.connected ? (
        <Empty
          title="Choose your Meta ad account"
          description="Use the account and Page selectors above after authorizing Meta. Existing ads continue running unchanged."
          action={
            <Link className="button" to="/settings">
              Connect Meta
            </Link>
          }
        />
      ) : (
        <>
          {working && (
            <Notice>
              Importing campaigns, ad sets, ads and both date ranges. You can leave this page; the
              import continues in the background.
            </Notice>
          )}
          {report.data?.sync.state === 'FAILED' && (
            <Notice error>
              {report.data.sync.error_message}{' '}
              {imported ? 'Showing the last successful snapshot.' : ''}
            </Notice>
          )}
          {!imported ? (
            <Empty
              title="Import this date range"
              description="Your full account will be included, along with the previous equal-length period. Reports are saved locally for review."
              action={
                owner ? (
                  <Button onClick={sync} disabled={busy || working}>
                    Import performance
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="meta-report-note">
                <span>
                  Updated {new Date(snap!.fetchedAt).toLocaleString()} · {snap!.account.name} (
                  {snap!.account.id || report.data?.selection.account_id}) ·{' '}
                  {snap!.account.timezone_name}
                </span>
                <span>
                  Comparison: {snap!.previousFrom} → {snap!.previousTo}
                </span>
              </div>
              {selected && (
                <div className="meta-scope">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelected(null);
                      setEvidence(null);
                    }}
                  >
                    <ArrowLeft size={15} />
                    Whole account
                  </Button>
                  <strong>
                    {entity?.name} ({entity?.id})
                  </strong>
                  <Status value={entity?.effective_status} />
                  <a
                    className="button secondary small"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.facebook.com/adsmanager/manage/${selected.level === 'campaign' ? 'campaigns' : selected.level === 'adset' ? 'adsets' : 'ads'}?selected_${selected.level}_ids=${selected.id}`}
                  >
                    <ExternalLink size={14} />
                    Meta Ads Manager
                  </a>
                </div>
              )}
              <div className="meta-kpi-grid">
                <Stat
                  label={selected ? 'Selected item spend' : 'Account spend'}
                  value={fmt(current?.spend)}
                  detail={delta(current?.spend, previous?.spend)}
                />
                <Stat
                  label="Impressions"
                  value={number(current?.impressions)}
                  detail={delta(current?.impressions, previous?.impressions)}
                />
                <Stat
                  label={selected ? 'Results' : 'Reach'}
                  value={
                    selected ? (
                      <OutcomeValues
                        metrics={current || {}}
                        kinds={outcomeKinds}
                        byKind={
                          entity && snap
                            ? (kind) => entityOutcomeMetrics(entity, snap.levels, kind)
                            : undefined
                        }
                        previousByKind={
                          entity && snap
                            ? (kind) => entityOutcomeMetrics(entity, snap.levels, kind, true)
                            : undefined
                        }
                        currency={currency}
                      />
                    ) : (
                      number(current?.reach)
                    )
                  }
                  detail={
                    selected
                      ? 'Outcome detected from Meta campaign and ad-set goals'
                      : delta(current?.reach, previous?.reach)
                  }
                />
                <Stat
                  label={selected ? 'Cost per result' : 'Frequency'}
                  value={
                    selected ? (
                      <OutcomeValues
                        metrics={current || {}}
                        previous={previous}
                        kinds={outcomeKinds}
                        byKind={
                          entity && snap
                            ? (kind) => entityOutcomeMetrics(entity, snap.levels, kind)
                            : undefined
                        }
                        previousByKind={
                          entity && snap
                            ? (kind) => entityOutcomeMetrics(entity, snap.levels, kind, true)
                            : undefined
                        }
                        currency={currency}
                        mode="cost"
                      />
                    ) : (
                      Number(current?.frequency || 0).toFixed(2)
                    )
                  }
                  detail={
                    selected
                      ? 'Spend ÷ the corresponding outcome count'
                      : delta(current?.frequency, previous?.frequency)
                  }
                />
              </div>
              {!selected && (
                <div className="meta-account-outcomes">
                  <span>Campaign outcomes · shown separately</span>
                  <OutcomeValues
                    metrics={{}}
                    kinds={campaignOutcomeKinds.filter((k) =>
                      Object.values(campaignOutcomeMetrics(k)).some(
                        (v) => typeof v === 'number' && v > 0,
                      ),
                    )}
                    byKind={campaignOutcomeMetrics}
                    currency={currency}
                  />
                </div>
              )}
              <p className="meta-help">
                Results and cost per result follow each item's Meta goal automatically. Mixed
                outcomes are shown separately; conversations are not bookings. Selected item figures
                cover the full date range.
              </p>
              <div className="meta-secondary-stats">
                <span>
                  Reach <strong>{number(current?.reach)}</strong>
                </span>
                <span>
                  Frequency <strong>{Number(current?.frequency || 0).toFixed(2)}</strong>
                </span>
                <span>
                  Link CTR{' '}
                  <strong>
                    {current?.ctr == null ? '—' : Number(current.ctr).toFixed(2) + '%'}
                  </strong>
                </span>
                <span>
                  Link CPC <strong>{fmt(current?.cpc)}</strong>
                </span>
                <span>
                  CPM <strong>{fmt(current?.cpm)}</strong>
                </span>
              </div>
              <MetaReportExplorer
                key={accountId + from + to}
                scopeKey={accountId}
                levels={snap!.levels}
                daily={snap!.daily}
                dailyAds={snap!.dailyAds}
                currency={currency}
                from={from}
                to={to}
                onSelect={(level, id) => {
                  setSelected({ level, id });
                  setEvidence(null);
                }}
              />
              {entity && (
                <section className="panel meta-entity-detail">
                  <div>
                    <h3>{entity.name}</h3>
                    <p className="muted">
                      {entity.objective ||
                        entity.optimization_goal ||
                        entity.destination_type ||
                        'Meta delivery object'}
                    </p>
                    {entity.creative && (
                      <>
                        <h4>Actual ad creative</h4>
                        <p>{entity.creative.title}</p>
                        <p>{entity.creative.body}</p>
                        {(entity.creative.image_url || entity.creative.thumbnail_url) && (
                          <img
                            className="meta-creative-image"
                            src={entity.creative.image_url || entity.creative.thumbnail_url}
                            alt={entity.name + ' creative'}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <p className="tiny muted">
                          Meta preview URLs can expire; an empty preview does not mean the ad has no
                          creative.
                        </p>
                      </>
                    )}
                  </div>
                  <details>
                    <summary>Targeting, attribution and creative details</summary>
                    <pre className="meta-json">
                      {JSON.stringify(
                        {
                          targeting: entity.targeting,
                          attribution: entity.attribution_spec,
                          creative: entity.creative,
                          dailyBudgetMinorUnits: entity.daily_budget,
                          lifetimeBudgetMinorUnits: entity.lifetime_budget,
                          actions: entity.metrics.actions,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </section>
              )}
              <section className="panel meta-analysis">
                <div className="section-heading">
                  <h3>
                    <Sparkles size={20} />
                    Discuss performance with AI
                  </h3>
                  <span className="muted">
                    {entity?.name || 'Whole account'} · {from} → {to}
                  </span>
                </div>
                <p className="muted">
                  Ask what changed, which ads deserve attention, or what to test next. AI uses this
                  saved snapshot. Recommendations never change your ads.
                </p>
                {!sharing.data?.ready && (
                  <Notice>
                    AI text generation is not configured. Performance reports still work.
                  </Notice>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setConfirm(true);
                  }}
                >
                  <Field label="Your question">
                    <textarea
                      rows={3}
                      maxLength={3000}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Why did conversation costs rise? Which creatives should I test next?"
                    />
                  </Field>
                  <Button
                    type="submit"
                    disabled={
                      asking ||
                      !question.trim() ||
                      !sharing.data?.ready ||
                      (!owner && business.role !== 'MARKETER')
                    }
                  >
                    {asking ? 'Analysing…' : 'Review AI request'}
                  </Button>
                </form>
                {history.error && <Notice error>{history.error.message}</Notice>}
                {history.data?.map((h) => (
                  <article className="meta-answer" key={h.id}>
                    <strong>{h.question}</strong>
                    <p>{h.answer.summary}</p>
                    {(['facts', 'hypotheses', 'recommendations', 'limitations'] as const).map(
                      (k) =>
                        h.answer[k]?.length ? (
                          <div key={k}>
                            <h4>
                              {k === 'facts'
                                ? 'Observed facts'
                                : k === 'hypotheses'
                                  ? 'Possible explanations'
                                  : k === 'recommendations'
                                    ? 'Suggested next steps'
                                    : 'Limits of this analysis'}
                            </h4>
                            <ul>
                              {h.answer[k].map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null,
                    )}
                  </article>
                ))}
                {evidence != null && (
                  <details>
                    <summary>Report evidence used for the latest answer</summary>
                    <pre className="meta-json">{JSON.stringify(evidence, null, 2)}</pre>
                  </details>
                )}
              </section>
              <p className="tiny muted">
                {snap!.attribution} Reach is deduplicated by Meta for each date range; it is never
                summed across days or campaigns. Profit and booking conversion require your MIS
                linkage.
              </p>
            </>
          )}
        </>
      )}
      {confirm && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meta-sharing-title"
          >
            <div className="section-heading">
              <h3 id="meta-sharing-title">Review AI data sharing</h3>
              <button className="icon-button" aria-label="Close" onClick={() => setConfirm(false)}>
                <X />
              </button>
            </div>
            <p>
              This request sends the following to your configured{' '}
              <strong>{sharing.data?.provider}</strong> AI provider:
            </p>
            <ul>
              {sharing.data?.data.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p>
              <strong>{entity?.name || snap?.account.name}</strong> · {from} → {to}, plus the
              previous equal-length period. Account analysis includes the top 30 campaigns by spend;
              entity analysis includes up to 30 child entities.
            </p>
            <p>Your question: {question}</p>
            <p className="muted">
              API tokens, login details, customer records and previous conversations are excluded.
              Provider usage may incur text-generation charges.
            </p>
            <div className="actions">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={ask}>Approve & ask AI</Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
