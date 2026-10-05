import { MetaConnectionPanel } from './meta-connection';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Row } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Notice, Button, AsyncForm, Field, Status, Loading } from '../components/ui';
import { Plug, ShieldCheck } from 'lucide-react';
export function SettingsPage() {
  const { base, business, owner } = useWorkspace();
  const query = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  const integration = useQuery({
    queryKey: [base, 'integration'],
    queryFn: () => api<Row>(base + '/integration'),
  });
  const team = useQuery({
    queryKey: [base, 'team'],
    queryFn: () => api<{ members: Row[]; invitations: Row[] }>(base + '/team'),
    enabled: owner,
  });
  const usage = useQuery({ queryKey: [base, 'usage'], queryFn: () => api<Row[]>(base + '/usage') });
  const audit = useQuery({
    queryKey: [base, 'audit'],
    queryFn: () => api<Row[]>(base + '/audit'),
    enabled: owner,
  });
  const live = [integration.data?.providerMode, integration.data?.mode].some(
    (mode) => String(mode || '').toLowerCase() === 'live',
  );
  async function connect(disconnect = false) {
    setError('');
    try {
      await api(
        base + '/integration' + (disconnect ? '' : '/connect'),
        disconnect ? 'DELETE' : 'POST',
      );
      query.invalidateQueries({ queryKey: [base, 'integration'] });
      setMessage(
        disconnect
          ? 'Integration disconnected.'
          : 'Sandbox connected. No live ad account or spending is enabled.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="THE FOUNDATION"
        title="Your workspace, your control."
        description="Manage your team, integrations, and workspace activity."
      />
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="grid two">
        <section className="panel">
          <div className="section-heading">
            <h3>
              <Plug size={18} />
              Meta integration
            </h3>
            <span className="pill">
              {String(integration.data?.mode || 'simulated').toUpperCase()}
            </span>
          </div>
          <p className="muted">
            {live
              ? 'Connect Meta below to authorize access. Select your ad account and Page on Meta performance.'
              : 'Test the approval and publishing flow in the local sandbox. No real ads are created.'}
          </p>
          <div className="integration-card">
            <span className="meta-mark">∞</span>
            <div>
              <strong>Facebook & Instagram</strong>
              <p>
                {live
                  ? integration.data?.connected
                    ? `Connected to ${String(integration.data.account_name || 'Meta')}`
                    : 'Meta authorization is required.'
                  : integration.data?.connected
                    ? 'AdReadyGo sandbox account connected'
                    : 'Connect the local sandbox to start testing.'}
              </p>
            </div>
          </div>
          {owner && !live && (
            <Button
              variant={integration.data?.connected ? 'secondary' : ''}
              onClick={() => connect(Boolean(integration.data?.connected))}
            >
              {integration.data?.connected ? 'Disconnect sandbox' : 'Connect sandbox'}
            </Button>
          )}
          <p className="tiny muted">
            Live authorization is available below. Account-specific validation is required before
            real advertising.
          </p>
        </section>
        <section className="panel">
          <h3>
            <ShieldCheck size={18} />
            Workspace details
          </h3>
          <div className="detail-row">
            <span>Business</span>
            <strong>{business.name}</strong>
          </div>
          <div className="detail-row">
            <span>Industry</span>
            <strong>{business.industry}</strong>
          </div>
          <div className="detail-row">
            <span>Currency</span>
            <strong>{business.currency}</strong>
          </div>
          <div className="detail-row">
            <span>Timezone</span>
            <strong>{business.timezone}</strong>
          </div>
          <div className="detail-row">
            <span>Your role</span>
            <Status value={business.role} />
          </div>
          <p className="tiny muted">
            Invite-only pilot · English · AI configuration is managed on the backend.
          </p>
        </section>
      </div>
      {owner && <MetaConnectionPanel />}
      {owner && (
        <section className="panel">
          <h3>Your team</h3>
          <p className="muted">
            Invite a Marketer/Designer to create drafts. The Owner approves publishing and spending.
          </p>
          <AsyncForm
            submit="Create invitation"
            onSubmit={async (d) => {
              const r = await api<{ url?: string; message: string }>(
                base + '/invitations',
                'POST',
                Object.fromEntries(d),
              );
              setInvite(r.url || '');
              setMessage(r.message);
              query.invalidateQueries({ queryKey: [base, 'team'] });
            }}
          >
            <Field label="Email address">
              <input name="email" type="email" required />
            </Field>
          </AsyncForm>
          {invite && (
            <Notice>
              <strong>Share this link privately:</strong>
              <input
                aria-label="Invitation link"
                value={invite}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </Notice>
          )}
          {team.isLoading ? (
            <Loading />
          ) : (
            team.data?.members.map((m) => (
              <div className="offer-row" key={String(m.id)}>
                <div>
                  <strong>{String(m.display_name)}</strong>
                  <small>{String(m.email)}</small>
                </div>
                <Status value={m.role} />
                {m.role === 'MARKETER' && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api(base + '/team/' + m.id, 'DELETE');
                        query.invalidateQueries({ queryKey: [base, 'team'] });
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Remove access
                  </Button>
                )}
              </div>
            ))
          )}
        </section>
      )}
      <div className="grid two">
        <section className="panel">
          <h3>Generation usage</h3>
          {usage.data?.length ? (
            usage.data.map((u, i) => (
              <div className="offer-row" key={i}>
                <div>
                  <strong>{String(u.operation).replaceAll('_', ' ')}</strong>
                  <small>
                    {String(u.provider)} · {String(u.model)}
                  </small>
                </div>
                <strong>{String(u.count)}</strong>
              </div>
            ))
          ) : (
            <p className="muted">No generations yet.</p>
          )}
          <p className="tiny muted">Provider costs are unavailable in development mode.</p>
        </section>
        {owner && (
          <section className="panel">
            <h3>Recent activity</h3>
            <div className="audit-list">
              {audit.data?.slice(0, 15).map((a) => (
                <div key={String(a.id)}>
                  <strong>{String(a.action).toLowerCase().replaceAll('_', ' ')}</strong>
                  <small>{String(a.created_at).slice(0, 16).replace('T', ' ')}</small>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
