import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Campaign, type Row, money } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { AsyncForm, Field, Notice, Status } from '../components/ui';
export function BudgetPanel({ campaign }: { campaign: Campaign }) {
  const { base, business, owner } = useWorkspace();
  const query = useQueryClient();
  const [message, setMessage] = useState('');
  const jobs = useQuery({
    queryKey: [base, 'jobs', campaign.id],
    queryFn: () => api<Row[]>(base + '/campaigns/' + campaign.id + '/jobs'),
    refetchInterval: 4000,
  });
  return (
    <div className="budget-panel">
      {owner && ['ACTIVE', 'PAUSED'].includes(campaign.delivery_state) && (
        <>
          <h3>Budget control</h3>
          <p className="tiny muted">
            Approved target: {money(campaign.content.dailyBudget, business.currency)} per day. Last
            confirmed applied budget:{' '}
            {campaign.applied_budget == null
              ? 'unavailable'
              : money(campaign.applied_budget, business.currency)}
            . Changes are recorded as a new approved revision and applied through a durable job.
          </p>
          <AsyncForm
            submit="Approve & update budget"
            onSubmit={async (d) => {
              const r = await api<{ message: string }>(
                base + '/campaigns/' + campaign.id + '/budget',
                'POST',
                { dailyBudget: Number(d.get('dailyBudget')), revision: campaign.revision },
              );
              setMessage(r.message);
              query.invalidateQueries({ queryKey: [base] });
            }}
          >
            <Field label={'New daily budget · ' + business.currency}>
              <input
                name="dailyBudget"
                type="number"
                min="1"
                step="0.01"
                required
                defaultValue={campaign.content.dailyBudget}
              />
            </Field>
          </AsyncForm>
        </>
      )}
      {message && <Notice>{message}</Notice>}
      {jobs.data && jobs.data.length > 0 && (
        <>
          <h3>Publishing activity</h3>
          {jobs.data.slice(0, 4).map((j) => (
            <div className="job-row" key={String(j.id)}>
              <span>
                {String(j.kind)} · Revision {String(j.revision)}
              </span>
              <Status value={j.state} />
              {Boolean(j.error_message) && <p className="tiny muted">{String(j.error_message)}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
