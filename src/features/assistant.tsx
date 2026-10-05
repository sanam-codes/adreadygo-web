import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { api, type Row, type Content, type Campaign } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Field, AsyncForm, Notice, Button } from '../components/ui';
export function AssistantPage() {
  const { base } = useWorkspace();
  const nav = useNavigate();
  const query = useQueryClient();
  const [draft, setDraft] = useState<Content>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const offers = useQuery({
    queryKey: [base, 'offers'],
    queryFn: () => api<Row[]>(base + '/offers'),
  });
  const messages = useQuery({
    queryKey: [base, 'messages'],
    queryFn: () => api<Row[]>(base + '/assistant'),
  });
  async function save() {
    setBusy(true);
    try {
      const c = await api<Campaign>(base + '/campaigns', 'POST', {
        name: draft?.headline || 'New campaign',
        content: draft,
      });
      nav('/campaigns/' + c.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR CREATIVE PARTNER"
        title="What are we creating today?"
        description="Start with an offer, an idea, or a business goal. Shape the details together."
      />
      <Notice>
        Development assistant · Uses your saved brand and offer to prepare a sample template. Live
        AI models will be connected later.
      </Notice>
      <div className="grid assistant-grid">
        <section className="panel">
          <div className="conversation">
            {messages.data?.length ? (
              messages.data.map((m) => (
                <div key={String(m.id)} className={'message ' + m.role}>
                  <span>{m.role === 'user' ? 'You' : 'AdReadyGo · Development'}</span>
                  <p>{String(m.message)}</p>
                </div>
              ))
            ) : (
              <div className="assistant-welcome">
                <span className="sparkle-orb">
                  <Sparkles size={30} />
                </span>
                <h2>
                  A great campaign starts
                  <br />
                  with a conversation.
                </h2>
                <p>
                  Tell us what you’re offering, who it’s for,
                  <br />
                  and what you want to achieve.
                </p>
              </div>
            )}
          </div>
          <AsyncForm
            submit="Prepare draft →"
            onSubmit={async (d) => {
              const result = await api<{ draft: Content }>(
                base + '/assistant',
                'POST',
                Object.fromEntries(d),
              );
              setDraft(result.draft);
              query.invalidateQueries({ queryKey: [base, 'messages'] });
            }}
          >
            <Field label="Choose an offer">
              <select name="offerId">
                <option value="">General brand campaign</option>
                {offers.data?.map((o) => (
                  <option key={String(o.id)} value={String(o.id)}>
                    {String(o.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your campaign brief">
              <textarea
                name="message"
                required
                maxLength={6000}
                rows={3}
                placeholder="Promote our new offer to people in Mumbai. Keep the tone warm and straightforward…"
              />
            </Field>
          </AsyncForm>
        </section>
        <aside className="panel">
          <h3>Your campaign takes shape</h3>
          {draft ? (
            <>
              <span className="pill">SAMPLE DRAFT</span>
              <h2>{draft.headline}</h2>
              <p>{draft.primaryText}</p>
              <div className="mini-preview" style={{ background: draft.cards[0].backgroundColor }}>
                <Sparkles />
                <strong>{draft.cards[0].title}</strong>
                <span>{draft.cards[0].cta} →</span>
              </div>
              <p className="muted">
                Open the editor to adjust your creative, copy, budget, and audience. Nothing is
                published yet.
              </p>
              {error && <Notice error>{error}</Notice>}
              <Button onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Open creative editor'}
                <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <p className="muted">
                Your draft will appear here. You’ll be able to edit every important detail before
                approval.
              </p>
              <div className="brief-hints">
                <strong>A useful brief includes</strong>
                <p>01 &nbsp; The offer and its value</p>
                <p>02 &nbsp; Your ideal customers</p>
                <p>03 &nbsp; Where you want to advertise</p>
                <p>04 &nbsp; The action you want people to take</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
