import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Campaign, type Row, money } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Button, Notice, Status } from '../components/ui';
import { BudgetPanel } from './budget';
export function MetaPublishingPanel({ campaign, dirty }: { campaign: Campaign; dirty: boolean }) {
  const { base, owner, business } = useWorkspace();
  const cache = useQueryClient();
  const [preview, setPreview] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const integration = useQuery({
    queryKey: [base, 'integration'],
    queryFn: () => api<Row>(base + '/integration'),
  });
  const live = integration.data?.providerMode === 'live';
  async function check() {
    setBusy(true);
    setError('');
    try {
      setPreview(await api<Row>(base + '/campaigns/' + campaign.id + '/publish-preview'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ message: string }>(
        base + '/campaigns/' + campaign.id + '/publish',
        'POST',
      );
      setMessage(r.message);
      setPreview(null);
      await cache.invalidateQueries({ queryKey: [base] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function control(action: 'pause' | 'resume') {
    if (
      action === 'resume' &&
      !window.confirm(
        `Activate ${campaign.name}? ${live ? 'This enables delivery and can start real ad spend' : 'This is a simulation'}. Daily budget: ${money(campaign.content.dailyBudget, business.currency)}. Schedule: ${campaign.content.startDate} to ${campaign.content.endDate}.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ message: string }>(
        base + '/integration/campaigns/' + campaign.id + '/' + action,
        'POST',
        { confirmActivation: action === 'resume' },
      );
      setMessage(r.message);
      await cache.invalidateQueries({ queryKey: [base] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel mt-6">
      <h3>Publish & manage delivery</h3>
      <p className="muted">
        {live
          ? 'Publish this approved revision as a paused single-image WhatsApp ad. Review it in Meta, then activate separately.'
          : 'The publishing provider is currently simulated. Connect Meta and configure live mode before creating real ads.'}
      </p>
      <p>
        <Status value={campaign.delivery_state} />{' '}
        {campaign.provider_id && (
          <>
            <span className="tiny muted">Meta ID: {campaign.provider_id} </span>
            {!campaign.provider_id.startsWith('sim_') && (
              <a
                href={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${campaign.provider_id}`}
                target="_blank"
                rel="noreferrer"
              >
                Review in Meta
              </a>
            )}
          </>
        )}
      </p>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {!integration.data?.connected && (
        <Notice>
          <Link to="/settings">Connect your Meta account in Settings</Link> before publishing.
        </Notice>
      )}
      {dirty && <Notice>Save your changes before reviewing a publish request.</Notice>}
      {owner && ['NOT_PUBLISHED', 'FAILED'].includes(campaign.delivery_state) && (
        <Button
          onClick={check}
          disabled={
            busy || dirty || campaign.review_state !== 'APPROVED' || !integration.data?.connected
          }
        >
          {busy ? 'Checking…' : 'Review publishing settings'}
        </Button>
      )}
      {campaign.review_state !== 'APPROVED' && (
        <p className="tiny muted">Submit and approve the current revision above first.</p>
      )}
      {preview && (
        <div className="meta-answer">
          <strong>
            {String(preview.name)} · revision {String(preview.revision)}
          </strong>
          <p>{String(preview.message)}</p>
          <p>
            Initial delivery: <strong>{String(preview.initialStatus)}</strong> · Budget:{' '}
            {money(campaign.content.dailyBudget, business.currency)}/day ·{' '}
            {campaign.content.startDate} → {campaign.content.endDate}
          </p>
          <p>
            WhatsApp: {campaign.content.whatsapp} · Audience: {campaign.content.location} · Ages{' '}
            {campaign.content.ageMin || 18}–{campaign.content.ageMax || 65}
          </p>
          {preview.account != null && (
            <p>
              Ad account: {String((preview.account as Row).name)} · Page: {String(preview.pageId)}
            </p>
          )}
          {!preview.writesEnabled && (
            <Notice>
              Live writes are disabled on the backend. Enable them only when you are ready to create
              paused objects in your Meta account.
            </Notice>
          )}
          <div className="actions">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              onClick={publish}
              disabled={busy || dirty || !preview.approved || !preview.writesEnabled}
            >
              {live ? 'Create paused campaign in Meta' : 'Publish simulation'}
            </Button>
          </div>
        </div>
      )}
      {owner && campaign.delivery_state === 'PAUSED' && (
        <Button onClick={() => control('resume')} disabled={busy}>
          Activate campaign{live ? ' · starts ad delivery' : ''}
        </Button>
      )}
      {owner && campaign.delivery_state === 'ACTIVE' && (
        <Button variant="secondary" onClick={() => control('pause')} disabled={busy}>
          Pause campaign
        </Button>
      )}
      {['QUEUED', 'RUNNING'].includes(campaign.delivery_state) && (
        <Notice>Publishing is in progress. Delivery status updates automatically.</Notice>
      )}
      <BudgetPanel campaign={campaign} />
    </section>
  );
}
