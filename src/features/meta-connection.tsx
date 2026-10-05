import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink } from 'lucide-react';
import { api, type Row } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Button, Notice } from '../components/ui';
export function MetaConnectionPanel() {
  const { base } = useWorkspace();
  const cache = useQueryClient();
  const [search] = useSearchParams();
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const status = useQuery({
    queryKey: [base, 'meta-status'],
    queryFn: () =>
      api<{ configured: boolean; authorized: boolean; selection: Row }>(base + '/meta/status'),
  });
  const assets = useQuery({
    queryKey: [base, 'meta-assets'],
    queryFn: () => api<{ accounts: Row[]; pages: Row[] }>(base + '/meta/assets'),
    enabled: !!status.data?.authorized,
  });
  const authorized = !!status.data?.authorized,
    connected =
      authorized && !!status.data?.selection.account_id && !!status.data?.selection.page_id;
  const account = assets.data?.accounts.find((a) => a.id === status.data?.selection.account_id);
  const page = assets.data?.pages.find((a) => a.id === status.data?.selection.page_id);
  const expiry = status.data?.selection.expires_at
    ? new Date(String(status.data.selection.expires_at))
    : null;
  const expired = expiry && expiry.getTime() <= Date.now();
  async function connect() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ url: string }>(base + '/meta/authorize', 'POST');
      window.location.assign(r.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="panel meta-connect">
      <div className="section-heading">
        <h3>Connect Meta</h3>
        {connected && !expired && (
          <span className="status active">
            <Check size={14} />
            Connected
          </span>
        )}
      </div>
      <p className="muted">
        Link your Facebook and Instagram advertising account to import campaigns and performance.
        Your ads continue running unchanged.
      </p>
      <ol className="meta-connect-steps">
        {['Connect Meta', 'Approve on Meta', 'Choose account on performance', 'Ready to use'].map(
          (label, i) => (
            <li
              key={label}
              className={
                (i < 2 && authorized) || (i === 2 && connected) || (i === 3 && connected)
                  ? 'done'
                  : ''
              }
            >
              <span>
                {(i < 2 && authorized) || (i >= 2 && connected) ? <Check size={15} /> : i + 1}
              </span>
              {label}
            </li>
          ),
        )}
      </ol>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {status.error && <Notice error>{status.error.message}</Notice>}
      {search.get('meta') === 'cancelled' && (
        <Notice>Meta connection was cancelled. Connect again when ready.</Notice>
      )}
      {search.get('meta') === 'expired' && (
        <Notice error>The connection request expired. Click Connect Meta to start again.</Notice>
      )}
      {!status.isLoading && !status.data?.configured ? (
        <Notice>
          Meta connection is not available yet. The platform administrator must finish the one-time
          Meta app setup on the backend. Business users do not need an app ID or secret.
        </Notice>
      ) : !authorized ? (
        <>
          <Button onClick={connect} disabled={busy || status.isLoading}>
            {busy ? 'Opening Meta…' : 'Connect Meta'}
            <ExternalLink size={15} />
          </Button>
          <p className="tiny muted">
            You’ll sign in and approve permissions on Meta. AdReadyGo never asks for your Facebook
            password.
          </p>
        </>
      ) : null}
      {assets.isLoading && (
        <p className="muted">Loading the ad accounts and Pages you authorized…</p>
      )}
      {assets.error && (
        <Notice error>{assets.error.message} Reconnect Meta if access expired or changed.</Notice>
      )}
      {expired && (
        <Notice error>
          Your Meta access token has expired. Reconnect to continue importing or managing ads.
        </Notice>
      )}
      {authorized && !connected && (
        <Notice>
          Meta access approved. Choose your ad account and Facebook Page on the Meta performance
          page.
        </Notice>
      )}
      {authorized && !connected && (
        <Link className="button" to="/meta">
          Choose account & view performance →
        </Link>
      )}
      {connected && (
        <div className="meta-connected-summary">
          <p>
            <strong>
              {String(account?.name || 'Ad account')} ({String(status.data?.selection.account_id)})
            </strong>
            <br />
            <span className="muted">
              Page: {String(page?.name || 'Facebook Page')} (
              {String(status.data?.selection.page_id)})
            </span>
          </p>
          <Link className="button" to="/meta">
            View Meta performance →
          </Link>
          <p className="tiny muted">
            Credentials are encrypted on the backend. Connecting does not publish or activate ads.
          </p>
        </div>
      )}
      {authorized && (
        <>
          <div className="actions">
            <Button variant="secondary" onClick={connect} disabled={busy}>
              {busy ? 'Opening Meta…' : 'Reconnect Meta'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    'Disconnect Meta from this workspace? Existing ads will continue running in Meta.',
                  )
                )
                  return;
                setBusy(true);
                setError('');
                try {
                  await api(base + '/meta', 'DELETE');
                  setMessage('Disconnected. Your Meta campaigns were not changed.');
                  await cache.invalidateQueries({ queryKey: [base] });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Disconnect
            </Button>
          </div>
          {expiry && (
            <p className="tiny muted">
              Access token expiry: {expiry.toLocaleString()}. Reconnect before expiry, or if Meta
              revokes access.
            </p>
          )}
        </>
      )}
    </section>
  );
}
