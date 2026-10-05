import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Row } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Button, Field, Notice } from '../components/ui';

export type MetaStatus = { configured: boolean; authorized: boolean; selection: Row };
export function useMetaStatus() {
  const { base, owner } = useWorkspace();
  return useQuery({
    queryKey: [base, 'meta-status'],
    queryFn: () => api<MetaStatus>(base + '/meta/status'),
    enabled: owner,
  });
}
export function MetaAssetSelector({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (accountChanged: boolean) => Promise<void>;
}) {
  const { base } = useWorkspace();
  const cache = useQueryClient();
  const status = useMetaStatus();
  const assets = useQuery({
    queryKey: [base, 'meta-assets'],
    queryFn: () => api<{ accounts: Row[]; pages: Row[] }>(base + '/meta/assets'),
    enabled: !!status.data?.authorized,
  });
  const savedAccount = String(status.data?.selection.account_id || '');
  const savedPage = String(status.data?.selection.page_id || '');
  const [account, setAccount] = useState('');
  const [page, setPage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setAccount(savedAccount);
    setPage(savedPage);
    setError('');
    setMessage('');
  }, [base, savedAccount, savedPage]);
  if (status.isLoading) return <section className="panel">Checking Meta access…</section>;
  if (status.error) return <Notice error>{status.error.message}</Notice>;
  if (!status.data?.authorized)
    return (
      <section className="panel">
        <h3>Connect your Meta account</h3>
        <p className="muted">
          Authorize Meta in Settings, then choose your ad account and Page here.
        </p>
        <Link className="button" to="/settings">
          Connect Meta →
        </Link>
      </section>
    );
  const dirty = account !== savedAccount || page !== savedPage;
  async function apply() {
    const accountChanged = account !== savedAccount;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api(base + '/meta/selection', 'POST', { accountId: account, pageId: page });
      // Stop old account requests before showing the new selection. No placeholder data is reused.
      await cache.cancelQueries({ queryKey: [base, 'meta-performance'] });
      await cache.cancelQueries({ queryKey: [base, 'meta-analysis'] });
      cache.removeQueries({ queryKey: [base, 'meta-performance'] });
      cache.removeQueries({ queryKey: [base, 'meta-analysis'] });
      await cache.invalidateQueries({ queryKey: [base, 'meta-status'] });
      await cache.invalidateQueries({ queryKey: [base, 'integration'] });
      await onChange(accountChanged);
      setMessage(
        accountChanged
          ? 'Account switched. Performance is loading for the selected dates.'
          : 'Facebook Page updated. Performance covers the whole ad account.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="panel meta-assets-panel">
      <div className="section-heading">
        <h3>Account & Facebook Page</h3>
        <span className="pill">Authorized assets</span>
      </div>
      <p className="muted">
        Choose the account whose performance you want to see. The Page is used for future campaign
        publishing; it does not filter account statistics.
      </p>
      {assets.isLoading && <p>Loading your accounts and Pages…</p>}
      {assets.error && (
        <Notice error>
          {assets.error.message} Reconnect Meta in Settings if access has expired.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="meta-assets-controls">
        <Field label="Ad account">
          <select
            value={account}
            disabled={disabled || saving || !assets.data}
            onChange={(e) => {
              setAccount(e.target.value);
              setMessage('');
            }}
          >
            <option value="">Choose ad account</option>
            {assets.data?.accounts.map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.name)} ({String(a.id)}) · {String(a.currency)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Facebook Page">
          <select
            value={page}
            disabled={disabled || saving || !assets.data}
            onChange={(e) => {
              setPage(e.target.value);
              setMessage('');
            }}
          >
            <option value="">Choose Facebook Page</option>
            {assets.data?.pages.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name)} ({String(p.id)})
              </option>
            ))}
          </select>
        </Field>
        <Button
          onClick={apply}
          disabled={!dirty || !account || !page || disabled || saving || !!assets.error}
        >
          {saving
            ? 'Switching…'
            : !savedAccount
              ? 'Load performance'
              : account !== savedAccount
                ? 'Switch account & load stats'
                : dirty
                  ? 'Save Page'
                  : 'Selection saved'}
        </Button>
      </div>
      {dirty && (
        <p className="tiny muted">
          Apply your selection to load its statistics. The current report still belongs to the saved
          account.
        </p>
      )}
      {!!status.data.selection.instagram_id && (
        <p className="tiny muted">
          Linked Instagram account ({String(status.data.selection.instagram_id)})
        </p>
      )}
      {disabled && (
        <p className="tiny muted">
          Wait for the current import or analysis to finish before switching accounts.
        </p>
      )}
    </section>
  );
}
