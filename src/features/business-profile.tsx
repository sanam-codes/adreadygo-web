import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, Phone, Globe, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { api, type Row } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { AsyncForm, Field, Heading, Loading, Notice, Button } from '../components/ui';

export function BusinessGate({ children }: { children: React.ReactNode }) {
  // Non-blocking gate: Allows users to freely navigate the entire workspace
  return <>{children}</>;
}

export function WorkspaceReadinessBanner() {
  const { base } = useWorkspace();
  const brandQuery = useQuery({
    queryKey: [base, 'brand'],
    queryFn: () => api<Row>(base + '/brand'),
  });
  const offersQuery = useQuery({
    queryKey: [base, 'offers'],
    queryFn: () => api<Row[]>(base + '/offers'),
  });
  const integrationQuery = useQuery({
    queryKey: [base, 'integration'],
    queryFn: () => api<Row>(base + '/integration'),
  });

  if (brandQuery.isLoading || offersQuery.isLoading) return null;
  const brand = brandQuery.data || {};
  const offers = offersQuery.data || [];
  const integration = integrationQuery.data || {};

  const items = [
    {
      key: 'desc',
      label: 'Business context',
      done: Boolean(brand.description),
      link: '/brand',
      action: 'Add details',
    },
    {
      key: 'logo',
      label: 'Brand logo',
      done: Boolean(brand.logoAssetId),
      link: '/brand',
      action: 'Upload logo',
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp number',
      done: Boolean(brand.whatsapp),
      link: '/brand',
      action: 'Set WhatsApp',
    },
    {
      key: 'offer',
      label: 'Promotional offer',
      done: offers.length > 0,
      link: '/offers',
      action: 'Add offer',
    },
    {
      key: 'meta',
      label: 'Meta integration',
      done: Boolean(integration.connected),
      link: '/settings',
      action: 'Connect sandbox',
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = Math.round((completed / total) * 100);

  if (pct === 100) {
    return (
      <div className="readiness-banner complete">
        <div className="readiness-info">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <span>
            <strong>Workspace 100% Ready for Meta Ads!</strong> Everything is configured to create
            and run high-converting campaigns.
          </span>
        </div>
        <Link to="/campaigns" className="button small">
          <Sparkles size={14} /> Create Campaign
        </Link>
      </div>
    );
  }

  const nextItem = items.find((i) => !i.done);

  return (
    <div className="readiness-banner">
      <div className="readiness-main">
        <div className="readiness-info">
          <AlertCircle size={18} className="text-amber-500" />
          <div>
            <strong>Workspace Readiness: {pct}%</strong>
            <p className="tiny muted">
              Complete these {total - completed} steps for the best AI ad generation and Meta setup.
            </p>
          </div>
        </div>

        <div className="readiness-tags">
          {items.map((i) => (
            <span key={i.key} className={`readiness-pill ${i.done ? 'done' : 'pending'}`}>
              {i.done ? <CheckCircle2 size={12} /> : null}
              {i.label}
            </span>
          ))}
        </div>
      </div>

      {nextItem && (
        <Link to={nextItem.link} className="button small secondary">
          Next: {nextItem.action} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

export function BusinessProfilePage() {
  const { base, business } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [base, 'brand'], queryFn: () => api<Row>(base + '/brand') });

  const [notice, setNotice] = useState('');
  const [researching, setResearching] = useState(false);

  if (q.isLoading) return <Loading />;
  if (q.error) return <Notice error>{q.error.message}</Notice>;
  const b = q.data!;

  async function handleSave(d: FormData) {
    setNotice('');
    const details: Row = {
      ...b,
      ...Object.fromEntries(d),
      businessName: business.name,
      industry: business.industry,
      currency: business.currency,
      profileReviewed: true,
      profileReviewedAt: new Date().toISOString(),
    };

    const file = d.get('logo');
    delete details.logo;
    if (file instanceof File && file.size) {
      const upload = new FormData();
      upload.set('file', file);
      const a = await api<{ id: string }>(base + '/assets', 'POST', upload);
      details.logoAssetId = a.id;
    }

    await api(base + '/brand', 'PUT', details);
    await qc.invalidateQueries({ queryKey: [base, 'brand'] });
    setNotice('Business context and brand settings saved successfully.');
  }

  async function handleAiResearch() {
    if (!b.website) {
      setNotice('Please enter a website address below and save first.');
      return;
    }
    setResearching(true);
    setNotice('');
    try {
      const r = await api<Row>(base + '/studio/research', 'POST', { website: b.website });

      await api(base + '/brand', 'PUT', { ...b, profileDraft: r });
      setNotice('Website research complete! Review the findings on the right.');
      await qc.invalidateQueries({ queryKey: [base, 'brand'] });
    } catch (e) {
      setNotice('Website research note: ' + (e as Error).message);
    } finally {
      setResearching(false);
    }
  }

  return (
    <>
      <Heading
        eyebrow="FOUNDATION · BUSINESS BRAIN"
        title="Business context & brand."
        description="This information acts as the primary knowledge base for the AI when generating campaigns, ad copy, targeting angles, and creatives."
      />

      {notice && <Notice>{notice}</Notice>}

      <div className="grid two">
        <section className="panel">
          <div className="section-heading">
            <h3>Business core facts</h3>
            {b.website ? (
              <Button variant="secondary" onClick={handleAiResearch} disabled={researching}>
                <Sparkles size={14} /> {researching ? 'Scanning...' : 'Scan website with AI'}
              </Button>
            ) : null}
          </div>

          <AsyncForm submit="Save brand context" onSubmit={handleSave}>
            <div className="grid two">
              <Field label="Business name">
                <input value={business.name} readOnly className="bg-gray-50" />
              </Field>
              <Field label="Industry category">
                <input value={business.industry} readOnly className="bg-gray-50" />
              </Field>
            </div>

            <Field label="What does your business do? (AI baseline context) *">
              <textarea
                name="description"
                rows={4}
                defaultValue={String(b.description || '')}
                required
                maxLength={6000}
                placeholder="Describe your services, products, and core offerings in plain language."
              />
            </Field>

            <Field label="Target audience / Ideal customer profile">
              <textarea
                name="targetAudience"
                rows={3}
                defaultValue={String(b.targetAudience || '')}
                maxLength={4000}
                placeholder="Who do you primarily serve? (e.g. Demographics, pain points, location)"
              />
            </Field>

            <Field label="Key Value Proposition / USPs">
              <textarea
                name="usp"
                rows={3}
                defaultValue={String(b.usp || '')}
                maxLength={4000}
                placeholder="Why should customers choose you over competitors?"
              />
            </Field>

            <div className="grid two">
              <Field label="Operating city / region">
                <input
                  name="city"
                  defaultValue={String(b.city || '')}
                  maxLength={100}
                  placeholder="e.g. Bengaluru, Mumbai"
                />
              </Field>
              <Field label="Country">
                <input
                  name="country"
                  defaultValue={String(b.country || 'IN')}
                  maxLength={50}
                  placeholder="e.g. IN, US, UK"
                />
              </Field>
            </div>

            <Field label="Business WhatsApp Number (Ad destination)">
              <div className="input-with-icon">
                <Phone size={16} />
                <input
                  name="whatsapp"
                  defaultValue={String(b.whatsapp || '')}
                  placeholder="+91 98765 43210 (include country code)"
                />
              </div>
            </Field>

            <Field label="Website URL">
              <div className="input-with-icon">
                <Globe size={16} />
                <input
                  name="website"
                  type="url"
                  defaultValue={String(b.website || '')}
                  placeholder="https://yourbusiness.com"
                />
              </div>
            </Field>

            <Field label="Brand logo">
              <div className="flex items-center gap-3">
                <input name="logo" type="file" accept="image/png,image/jpeg" />
                {!!b.logoAssetId && (
                  <img
                    src={'/api' + base + '/assets/' + b.logoAssetId}
                    alt="Current logo"
                    className="h-10 w-auto object-contain border rounded p-1 bg-white"
                  />
                )}
              </div>
            </Field>

            <div className="grid two">
              <Field label="Primary brand colour">
                <div className="color-field-wrap">
                  <input
                    type="color"
                    name="primaryColor"
                    defaultValue={String(b.primaryColor || '#6d5efc')}
                  />
                  <input type="text" defaultValue={String(b.primaryColor || '#6d5efc')} readOnly />
                </div>
              </Field>
              <Field label="Secondary accent colour">
                <div className="color-field-wrap">
                  <input
                    type="color"
                    name="accentColor"
                    defaultValue={String(b.accentColor || '#059669')}
                  />
                  <input type="text" defaultValue={String(b.accentColor || '#059669')} readOnly />
                </div>
              </Field>
            </div>

            <Field label="Brand voice & tone">
              <input
                name="tone"
                defaultValue={String(b.tone || 'Clear, warm and confident')}
                maxLength={2000}
                placeholder="e.g. Clear, warm and confident"
              />
            </Field>
          </AsyncForm>
        </section>

        <section className="panel">
          <h3>AI knowledge snapshot</h3>
          <p className="tiny muted">
            The AI automatically synthesizes these details to maintain consistent voice across all
            generated ads.
          </p>

          <div className="knowledge-cards">
            <div className="knowledge-card">
              <strong>Core Offering</strong>
              <p>{String(b.description || 'Not provided yet.')}</p>
            </div>

            <div className="knowledge-card">
              <strong>Target Customer</strong>
              <p>{String(b.targetAudience || 'Not specified yet.')}</p>
            </div>

            <div className="knowledge-card">
              <strong>Key Differentiators</strong>
              <p>{String(b.usp || 'Not specified yet.')}</p>
            </div>

            <div className="knowledge-card">
              <strong>Ad Destination</strong>
              <p>
                {b.whatsapp ? (
                  <span>WhatsApp: {String(b.whatsapp)}</span>
                ) : (
                  <span className="text-amber-600">
                    No WhatsApp destination set. Ads need a destination.
                  </span>
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
