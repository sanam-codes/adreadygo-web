import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Row, money } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Loading, Notice, Stat, Field, Status } from '../components/ui';
type Report = {
  media: Row;
  linked: Row;
  outcomes: Row[];
  series: Row[];
  campaigns: Row[];
  simulated: boolean;
  leadCount: number;
};
export function ReportsPage() {
  const { base, business } = useWorkspace();
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const q = useQuery({
    queryKey: [base, 'reports', from, to],
    queryFn: () => api<Report>(base + '/reports?from=' + from + '&to=' + to),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <Notice error>{q.error.message}</Notice>;
  const r = q.data!;
  const measured = Number(r.media.records) > 0;
  const spend = Number(r.media.spend);
  const revenue = Number(r.linked.revenue);
  const margin = revenue - Number(r.linked.direct_cost);
  const total = r.outcomes.find((o) => o.status === 'COMPLETED');
  const max = Math.max(1, ...r.series.map((d) => Number(d.spend)));
  return (
    <>
      <Heading
        eyebrow="CLARITY OVER VANITY"
        title="Understand what’s working."
        description="Advertising activity and business outcomes, with the difference made clear."
      />
      <div className="date-range">
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {r.simulated && (
        <Notice>
          Simulated advertising metrics. These are sample results, not actual Meta performance.
        </Notice>
      )}
      <div className="stats">
        <Stat
          label="Advertising spend"
          value={measured ? money(spend, business.currency) : '—'}
          detail="Selected date range"
        />
        <Stat
          label="Linked completed revenue"
          value={money(revenue, business.currency)}
          detail="User-attributed sales only"
        />
        <Stat
          label="Contribution before ads"
          value={money(margin, business.currency)}
          detail="Linked revenue minus direct cost"
        />
        <Stat
          label="Contribution after ads"
          value={measured ? money(margin - spend, business.currency) : '—'}
          detail="Not net profit; other expenses excluded"
        />
      </div>
      <div className="grid two">
        <section className="panel">
          <h3>Spend over time</h3>
          <div className="bar-chart">
            {r.series.length ? (
              r.series.map((d) => (
                <div
                  className="bar-column"
                  key={String(d.day)}
                  title={String(d.day) + ': ' + money(d.spend, business.currency)}
                >
                  <div style={{ height: (Number(d.spend) / max) * 150 + 5 + 'px' }} />
                  <small>{String(d.day).slice(5)}</small>
                </div>
              ))
            ) : (
              <p className="muted">No advertising metrics for this period.</p>
            )}
          </div>
          <div className="metrics-inline">
            <div>
              <small>Impressions</small>
              <strong>{measured ? Number(r.media.impressions).toLocaleString() : '—'}</strong>
            </div>
            <div>
              <small>Click-through rate</small>
              <strong>
                {Number(r.media.impressions) > 0
                  ? ((Number(r.media.clicks) / Number(r.media.impressions)) * 100).toFixed(2) + '%'
                  : '—'}
              </strong>
            </div>
            <div>
              <small>Cost / message</small>
              <strong>
                {Number(r.media.messages) > 0
                  ? money(spend / Number(r.media.messages), business.currency)
                  : '—'}
              </strong>
            </div>
          </div>
        </section>
        <section className="panel">
          <h3>Business-wide outcomes</h3>
          <p className="muted">
            Includes both linked and unattributed bookings. These totals are not campaign revenue.
          </p>
          {r.outcomes.map((o) => (
            <div className="offer-row" key={String(o.status)}>
              <Status value={o.status} />
              <span>{String(o.count)} bookings</span>
              <strong>{money(o.revenue, business.currency)}</strong>
            </div>
          ))}
          <div className="offer-row">
            <span>Unattributed completed revenue</span>
            <strong>{money(Number(total?.revenue || 0) - revenue, business.currency)}</strong>
          </div>
        </section>
      </div>
      <section className="panel table-wrap">
        <h3>Campaign contribution</h3>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Spend</th>
              <th>Completed outcomes</th>
              <th>Contribution before ads</th>
              <th>After ads</th>
            </tr>
          </thead>
          <tbody>
            {r.campaigns.map((c) => (
              <tr key={String(c.id)}>
                <td>{String(c.name)}</td>
                <td>{Number(c.metric_records) > 0 ? money(c.spend, business.currency) : '—'}</td>
                <td>{String(c.completed)}</td>
                <td>{money(c.contribution, business.currency)}</td>
                <td>
                  {Number(c.metric_records) > 0
                    ? money(Number(c.contribution) - Number(c.spend), business.currency)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny muted">
          Manual attribution is not proof of causation. Revenue is grouped by outcome date; ad spend
          by delivery date. These are period comparisons, not acquisition-cohort profitability.
        </p>
      </section>
    </>
  );
}
