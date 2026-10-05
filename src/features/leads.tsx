import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Row, type Campaign, money } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Field, AsyncForm, Notice, Button, Status, Empty } from '../components/ui';
export function LeadsPage() {
  const { base, business } = useWorkspace();
  const query = useQueryClient();
  const [tab, setTab] = useState('leads');
  const [preview, setPreview] = useState<{
    rows: Row[];
    valid: boolean;
    ready: number;
    imported: number;
  }>();
  const [file, setFile] = useState<File>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const leads = useQuery({ queryKey: [base, 'leads'], queryFn: () => api<Row[]>(base + '/leads') });
  const outcomes = useQuery({
    queryKey: [base, 'outcomes'],
    queryFn: () => api<Row[]>(base + '/outcomes'),
  });
  const campaigns = useQuery({
    queryKey: [base, 'campaigns'],
    queryFn: () => api<Campaign[]>(base + '/campaigns'),
  });
  const select = (
    <Field label="Campaign attribution">
      <select name="campaignId">
        <option value="">Unattributed / organic</option>
        {campaigns.data?.map((c) => (
          <option value={c.id} key={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
  async function importCsv(commit = false) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      const result = await api<{ rows: Row[]; valid: boolean; ready: number; imported: number }>(
        base + '/outcomes/import?preview=' + !commit,
        'POST',
        body,
      );
      setPreview(result);
      query.invalidateQueries({ queryKey: [base] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="BEYOND THE CLICK"
        title="Real conversations. Real outcomes."
        description="Keep track of enquiries and record what turns into business."
      />
      <div className="tabs page-tabs">
        {['leads', 'outcomes', 'import'].map((t) => (
          <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {error && <Notice error>{error}</Notice>}
      {tab === 'import' ? (
        <section className="panel">
          <h3>Import sales or bookings</h3>
          <p className="muted">
            Use your workspace currency ({business.currency}). Dates must use YYYY-MM-DD. Existing
            external IDs are skipped.
          </p>
          <p className="code-hint">
            externalId,label,revenue,directCost,status,occurredOn,campaignId
          </p>
          <p className="tiny muted">
            Status: PENDING, COMPLETED, CANCELLED, or REFUNDED. Leave campaignId blank for
            unattributed outcomes.
          </p>
          <Field label="CSV file">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0]);
                setPreview(undefined);
              }}
            />
          </Field>
          <div className="actions">
            <Button onClick={() => importCsv()} disabled={!file || busy}>
              Preview import
            </Button>
            {preview?.valid && preview.ready > 0 && !preview.imported && (
              <Button onClick={() => importCsv(true)} disabled={busy}>
                Import {preview.ready} rows
              </Button>
            )}
          </div>
          {preview?.imported !== undefined && preview.imported > 0 && (
            <Notice>Imported {preview.imported} outcomes.</Notice>
          )}
          {preview && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Reference</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={String(r.row)}>
                      <td>{String(r.row)}</td>
                      <td>{String(r.externalId || '—')}</td>
                      <td>
                        <Status value={r.status} />
                        {Boolean(r.message) && <span>{String(r.message)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className="grid leads-grid">
          <section className="panel">
            <h3>{tab === 'leads' ? 'Add an enquiry' : 'Record an outcome'}</h3>
            <AsyncForm
              key={tab}
              submit={tab === 'leads' ? 'Add lead' : 'Save outcome'}
              onSubmit={async (d) => {
                const values = Object.fromEntries(d);
                await api(
                  base + '/' + tab,
                  'POST',
                  tab === 'leads'
                    ? values
                    : {
                        ...values,
                        revenue: Number(values.revenue),
                        directCost: Number(values.directCost),
                      },
                );
                query.invalidateQueries({ queryKey: [base] });
              }}
            >
              {tab === 'leads' ? (
                <>
                  <Field label="Name">
                    <input name="name" required />
                  </Field>
                  <Field label="Email">
                    <input name="email" type="email" />
                  </Field>
                  <Field label="Phone">
                    <input name="phone" />
                  </Field>
                  <Field label="Source">
                    <input name="source" defaultValue="WhatsApp" required />
                  </Field>
                  <Field label="Stage">
                    <select name="status">
                      {['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Notes">
                    <textarea name="notes" rows={2} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Booking / sale reference">
                    <input name="externalId" required />
                  </Field>
                  <Field label="Offer or description">
                    <input name="label" required />
                  </Field>
                  <div className="grid two">
                    <Field label="Revenue">
                      <input name="revenue" type="number" min="0" step="0.01" required />
                    </Field>
                    <Field label="Direct cost">
                      <input name="directCost" type="number" min="0" step="0.01" required />
                    </Field>
                  </div>
                  <Field label="Status">
                    <select name="status">
                      {['COMPLETED', 'PENDING', 'CANCELLED', 'REFUNDED'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date">
                    <input
                      name="occurredOn"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </Field>
                </>
              )}
              {select}
            </AsyncForm>
          </section>
          <section className="panel table-wrap">
            <h3>{tab === 'leads' ? 'Your enquiries' : 'Recorded sales and bookings'}</h3>
            {(tab === 'leads' ? leads.error : outcomes.error) && (
              <Notice error>Unable to load records.</Notice>
            )}
            {tab === 'leads' ? (
              leads.data?.length ? (
                <div className="lead-list">
                  {leads.data.map((l) => (
                    <div className="lead-row" key={String(l.id)}>
                      <div>
                        <strong>{String(l.name)}</strong>
                        <small>{String(l.email || l.phone || l.source)}</small>
                        <small>{String(l.campaign_name || 'Unattributed')}</small>
                      </div>
                      <select
                        aria-label={'Status for ' + l.name}
                        value={String(l.status)}
                        onChange={async (e) => {
                          try {
                            await api(base + '/leads/' + l.id, 'PATCH', { status: e.target.value });
                            query.invalidateQueries({ queryKey: [base, 'leads'] });
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      >
                        {['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Start a conversation"
                  description="Add enquiries as they arrive, then move them through your pipeline."
                />
              )
            ) : outcomes.data?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Outcome</th>
                    <th>Revenue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.data.map((o) => (
                    <tr key={String(o.id)}>
                      <td>
                        <strong>{String(o.label)}</strong>
                        <small>
                          {String(o.external_id)} · {String(o.campaign_name || 'Unattributed')}
                        </small>
                      </td>
                      <td>{money(o.revenue, business.currency)}</td>
                      <td>
                        <Status value={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty
                title="Connect marketing to outcomes"
                description="Record completed sales and direct costs to understand contribution."
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
