import { MetaPublishingPanel } from './meta-publishing';
import { PosterFlow } from './poster-flow';
import { TargetingFields } from './targeting';
import { BudgetPanel } from './budget';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  Download,
  Copy,
  ChevronRight,
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  ExternalLink,
  Check,
  Phone,
  Eye,
  Sliders,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import {
  api,
  emptyCard,
  emptyContent,
  type Campaign,
  type Row,
  type Content,
  money,
} from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Loading, Notice, Empty, Button, Field, Status } from '../components/ui';
import { CreativeCanvas } from './creative-canvas';

type StudioProject = {
  id: string;
  revision: number;
  content: {
    name: string;
    prompt: string;
    campaignId?: string;
    offerId?: string;
    messages: { role: string; text: string }[];
    brief?: Record<string, string>;
    questions?: string[];
    briefApproved?: boolean;
    concepts?: {
      id: string;
      title: string;
      angle: string;
      audience: string;
      rationale: string;
      posterText: string;
      visualDirection: string;
    }[];
    selectedConcept?: { id: string; title: string; visualDirection: string };
    preparedPrompt?: {
      promptVersion?: string;
      prompt: string;
      specification: Record<string, string>;
      settings: Record<string, string>;
    };
    copyAlternatives?: { primaryText: string; headline: string; description: string }[];
    versions: {
      assetId: string;
      model?: string;
      style: string;
      size: string;
      createdAt: string;
      feedback?: string;
      quality?: { status: string; issues: string[]; strengths?: string[] };
      brief?: Record<string, string>;
    }[];
    selectedAssetId?: string;
    brandSnapshot?: Record<string, unknown>;
  };
};

export function CampaignsPage() {
  const { base, business } = useWorkspace();
  const nav = useNavigate();
  const query = useQueryClient();
  const [modalOpen, setModalOpen] = useState(
    () => new URLSearchParams(window.location.search).get('new') === '1',
  );
  const [name, setName] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const q = useQuery({
    queryKey: [base, 'campaigns'],
    queryFn: () => api<Campaign[]>(base + '/campaigns'),
    refetchInterval: 5000,
  });

  const offersQuery = useQuery({
    queryKey: [base, 'offers'],
    queryFn: () => api<Row[]>(base + '/offers'),
  });

  const brandQuery = useQuery({
    queryKey: [base, 'brand'],
    queryFn: () => api<Row>(base + '/brand'),
  });

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !goal.trim()) return;
    setBusy(true);
    setError('');

    try {
      const brand = brandQuery.data || {};
      const offers = offersQuery.data || [];
      const selectedOffer = offers.find((o) => o.id === selectedOfferId);

      const initialContent: Content = {
        ...emptyContent(),
        headline: selectedOffer ? String(selectedOffer.name) : name,
        primaryText: goal.trim(),
        location: String(brand.city || 'Major cities'),
        targetCountry: String(brand.country || 'IN'),
        whatsapp: String(brand.whatsapp || ''),
        dailyBudget: 500,
      };

      if (selectedOffer) {
        initialContent.cards = [
          {
            ...emptyCard(),
            title: String(selectedOffer.name),
            subtitle: String(selectedOffer.description || '').slice(0, 150),
            price: money(selectedOffer.price, business.currency),
            backgroundColor: String(brand.primaryColor || '#6d5efc'),
          },
        ];
      }

      // 1. Create the campaign
      const newCamp = await api<Campaign>(base + '/campaigns', 'POST', {
        name: name.trim(),
        content: initialContent,
      });

      // 2. Initialize linked AI Studio session for this campaign
      const aiPrompt = goal.trim()
        ? goal.trim()
        : selectedOffer
          ? `Create a high-converting Meta campaign to promote our ${selectedOffer.name} priced at ${business.currency} ${selectedOffer.price}. Focus on WhatsApp lead generation.`
          : `Create a Meta ad campaign for ${name}. Target local customers looking for our services.`;

      try {
        await api(base + '/studio', 'POST', {
          prompt: aiPrompt,
          campaignId: newCamp.id,
          offerId: selectedOfferId,
        });
      } catch (err) {
        console.warn('AI studio init note:', err);
      }

      await query.invalidateQueries({ queryKey: [base, 'campaigns'] });
      setModalOpen(false);
      nav('/campaigns/' + newCamp.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading
        eyebrow="FROM DRAFT TO DELIVERY"
        title="Campaigns workspace."
        description="Craft, refine with AI, and prepare complete campaigns for your Meta ad account."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            New campaign
          </Button>
        }
      />

      {error && <Notice error>{error}</Notice>}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-600" />
                <h3>Create a poster campaign</h3>
              </div>
              <button className="icon-button" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="form-stack mt-4">
              <Field label="Campaign Name *">
                <input
                  required
                  placeholder="e.g. Weekend brunch, Summer membership"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={160}
                />
              </Field>

              <Field label="Select an Offer to promote">
                <select
                  value={selectedOfferId}
                  onChange={(e) => {
                    setSelectedOfferId(e.target.value);
                    if (!name && e.target.value) {
                      const off = offersQuery.data?.find((o) => o.id === e.target.value);
                      if (off) setName(String(off.name) + ' Campaign');
                    }
                  }}
                >
                  <option value="">Custom Promotion / General Branding</option>
                  {offersQuery.data?.map((o) => (
                    <option key={String(o.id)} value={String(o.id)}>
                      {String(o.name)} · {money(o.price, business.currency)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="What would you like to advertise? *">
                <textarea
                  required
                  maxLength={6000}
                  rows={5}
                  placeholder="Describe your offer, who it’s for, and what customers should do. For example: a weekend brunch at ₹699 for nearby families, with table bookings."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </Field>

              <div className="modal-actions">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !name.trim() || !goal.trim()}>
                  {busy ? 'Creating workspace…' : 'Create poster workspace →'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <Notice error>{q.error.message}</Notice>
      ) : q.data?.length ? (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Review Status</th>
                <th>Delivery Status</th>
                <th>Revision</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="strong" to={'/campaigns/' + c.id}>
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    <Status value={c.review_state} />
                  </td>
                  <td>
                    <Status value={c.delivery_state} />
                  </td>
                  <td>Rev {c.revision}</td>
                  <td className="muted tiny">{String(c.updated_at).slice(0, 10)}</td>
                  <td>
                    <Link to={'/campaigns/' + c.id} className="button small secondary">
                      Open Editor <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="panel">
          <Empty
            title="Create your first Meta campaign"
            description="Our AI assistant uses your business profile and offers to generate copy, creative assets, and audience targeting."
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Sparkles size={16} /> Create with AI Studio →
              </Button>
            }
          />
        </section>
      )}
    </>
  );
}

export function CampaignPage() {
  const { id } = useParams();
  const { base } = useWorkspace();
  const q = useQuery({
    queryKey: [base, 'campaign', id],
    queryFn: () => api<Campaign>(base + '/campaigns/' + id),
    refetchInterval: 5000,
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <Notice error>{q.error.message}</Notice>;
  return <Editor key={q.data!.id} campaign={q.data!} />;
}

function Editor({ campaign }: { campaign: Campaign }) {
  const { base, owner, business } = useWorkspace();
  const query = useQueryClient();

  const [content, setContent] = useState<Content>(campaign.content);
  const [name, setName] = useState(campaign.name);
  const [revision, setRevision] = useState(campaign.revision);
  const [tab, setTab] = useState<'ai' | 'copy' | 'creative' | 'targeting' | 'preview' | 'approval'>(
    'ai',
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'facebook' | 'instagram' | 'story'>(
    'facebook',
  );
  const [copied, setCopied] = useState(false);

  const canvas = useRef<HTMLCanvasElement | null>(null);

  // Fetch or link AI Studio project for this campaign
  const studioQuery = useQuery({
    queryKey: [base, 'studio-by-campaign', campaign.id],
    queryFn: async () => {
      try {
        return await api<StudioProject>(base + '/studio/by-campaign/' + campaign.id);
      } catch {
        return null;
      }
    },
  });

  const brandQuery = useQuery({
    queryKey: [base, 'brand'],
    queryFn: () => api<Row>(base + '/brand'),
  });

  const history = useQuery({
    queryKey: [base, 'history', campaign.id],
    queryFn: () => api<Row[]>(base + '/campaigns/' + campaign.id + '/revisions'),
    enabled: tab === 'approval',
  });

  const locked = !['NOT_PUBLISHED', 'FAILED'].includes(campaign.delivery_state);

  function edit(key: keyof Content, value: unknown) {
    setContent((c) => ({ ...c, [key]: value }));
    setDirty(true);
  }

  async function persistDraft(next: Content): Promise<boolean> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const c = await api<Campaign>(base + '/campaigns/' + campaign.id, 'PUT', {
        name,
        content: next,
        revision,
      });
      setContent(c.content);
      setRevision(c.revision);
      setDirty(false);
      setMessage('Campaign saved.');
      query.invalidateQueries({ queryKey: [base, 'campaign', campaign.id] });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    return persistDraft(content);
  }

  async function handleReviewAction(action: 'submit' | 'approve' | 'request-changes') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(base + '/campaigns/' + campaign.id + '/review/' + action, 'POST');
      setMessage(
        `Campaign ${action === 'submit' ? 'submitted for review' : action === 'approve' ? 'approved' : 'changes requested'}.`,
      );
      await query.invalidateQueries({ queryKey: [base] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectCreativeAsset(assetId: string) {
    edit('renderedAssetIds', [assetId]);
    edit('selectedAssetId', assetId);
    setMessage('Active campaign creative updated!');
  }

  function copyMetaPackage() {
    const text = `
=== ADREADYGO META AD PACKAGE ===
Campaign: ${name}
Target Country: ${content.targetCountry || 'IN'}
Target Location: ${content.location}
Age Range: ${content.ageMin || 18} - ${content.ageMax || 65}
Daily Budget: ${business.currency} ${content.dailyBudget}
Placements: Facebook & Instagram Feed, Stories

--- AD COPY ---
PRIMARY TEXT:
${content.primaryText}

HEADLINE:
${content.headline}

DESCRIPTION:
${content.description}

CALL TO ACTION:
Send WhatsApp Message

DESTINATION LINK:
https://wa.me/${String(content.whatsapp).replace(/[^0-9]/g, '')}
=================================
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const activeAssetId =
    content.renderedAssetIds?.[0] ||
    content.selectedAssetId ||
    studioQuery.data?.content.selectedAssetId ||
    studioQuery.data?.content.versions?.[studioQuery.data.content.versions.length - 1]?.assetId;

  const studioProject = studioQuery.data;
  const brand = brandQuery.data || {};

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Link className="back-link" to="/campaigns">
          <ArrowLeft size={15} /> All campaigns
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={save} disabled={busy || locked || !dirty}>
            {busy ? 'Saving…' : dirty ? 'Save draft changes' : 'Draft saved'}
          </Button>
          {['DRAFT', 'CHANGES_REQUESTED'].includes(campaign.review_state) && (
            <Button onClick={() => handleReviewAction('submit')} disabled={busy}>
              Submit for review
            </Button>
          )}
          {owner && campaign.review_state === 'IN_REVIEW' && (
            <div className="flex gap-2">
              <Button onClick={() => handleReviewAction('approve')} disabled={busy}>
                <Check size={15} /> Approve campaign
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleReviewAction('request-changes')}
                disabled={busy}
              >
                Request changes
              </Button>
            </div>
          )}
        </div>
      </div>

      <Heading
        eyebrow={`CAMPAIGN WORKSPACE · REVISION ${revision}`}
        title={name}
        action={
          <button
            className="button small secondary"
            onClick={() => {
              const n = prompt('Rename campaign:', name);
              if (n && n.trim()) {
                setName(n.trim());
                setDirty(true);
              }
            }}
          >
            Rename
          </button>
        }
        description="Craft ad copy, generate posters with AI, configure audience, and export for Meta Ads."
      />

      <div className="campaign-meta-bar">
        <div className="flex items-center gap-2">
          <Status value={campaign.review_state} />
          <Status value={campaign.delivery_state} />
          <span className={dirty ? 'unsaved-badge' : 'tiny muted'}>
            {busy ? 'Saving…' : dirty ? '● Changes not saved yet' : 'All campaign changes saved'}
          </span>
          <Button variant="secondary" onClick={save} disabled={busy || locked || !dirty}>
            {busy ? 'Saving…' : 'Save campaign'}
          </Button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            Destination: {content.whatsapp ? `WhatsApp (${content.whatsapp})` : 'No WhatsApp set'}
          </span>
          <span>Budget: {money(content.dailyBudget, business.currency)}/day</span>
        </div>
      </div>

      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}

      {/* Main Campaign Tabs */}
      <div className="campaign-workspace-nav">
        <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
          <Sparkles size={16} /> Poster studio
        </button>
        <button className={tab === 'copy' ? 'active' : ''} onClick={() => setTab('copy')}>
          <FileText size={16} /> Meta Ad Copy
        </button>
        <button className={tab === 'creative' ? 'active' : ''} onClick={() => setTab('creative')}>
          <ImageIcon size={16} /> Ad Visuals & Canvas
        </button>
        <button className={tab === 'targeting' ? 'active' : ''} onClick={() => setTab('targeting')}>
          <Sliders size={16} /> Audience & Budget
        </button>
        <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>
          <Eye size={16} /> Live Meta Preview
        </button>
        <button className={tab === 'approval' ? 'active' : ''} onClick={() => setTab('approval')}>
          <ShieldCheck size={16} /> Review & Revisions
        </button>
      </div>

      {tab === 'ai' && (
        <PosterFlow
          campaignId={campaign.id}
          locked={locked}
          initialDescription={content.primaryText || name}
          beforeAction={async () => !dirty || (await persistDraft(content))}
          onApplied={async () => {
            const updated = await api<Campaign>(base + '/campaigns/' + campaign.id);
            setContent(updated.content);
            setRevision(updated.revision);
            setDirty(false);
            await studioQuery.refetch();
            await query.invalidateQueries({ queryKey: [base, 'campaign', campaign.id] });
          }}
        />
      )}

      {/* TAB 2: META AD COPY */}
      {tab === 'copy' && (
        <section className="panel max-w-3xl mt-6">
          <h3>Meta Ad Copy & Destination</h3>
          <p className="step-desc">
            These are the exact texts displayed on Facebook & Instagram ads, driving leads to
            WhatsApp.
          </p>

          <div className="form-stack mt-4">
            <Field label="Primary Text (Body copy shown above image)">
              <textarea
                rows={5}
                value={content.primaryText}
                onChange={(e) => edit('primaryText', e.target.value)}
                placeholder="Hook your audience, state the offer clearly, and encourage them to message on WhatsApp."
              />
              <span className="tiny muted">
                {content.primaryText.length} characters (125 recommended for feed)
              </span>
            </Field>

            <Field label="Headline (Prominent text shown below image)">
              <input
                value={content.headline}
                onChange={(e) => edit('headline', e.target.value)}
                placeholder="e.g. Full Body Health Checkup ₹999 | 84 Tests Included"
                maxLength={100}
              />
              <span className="tiny muted">{content.headline.length} / 100 characters</span>
            </Field>

            <Field label="Description (Additional context below headline)">
              <input
                value={content.description}
                onChange={(e) => edit('description', e.target.value)}
                placeholder="e.g. 100% NABL Accredited · Same Day Reports · Home Sample Collection"
                maxLength={150}
              />
            </Field>

            <div className="grid two">
              <Field label="Call to Action Button">
                <select value={content.cta} onChange={(e) => edit('cta', e.target.value)}>
                  <option value="WHATSAPP_MESSAGE">Send WhatsApp Message (Recommended)</option>
                  <option value="LEARN_MORE">Learn More</option>
                  <option value="ORDER_NOW">Order Now</option>
                  <option value="BOOK_TRAVEL">Book Now</option>
                  <option value="CONTACT_US">Contact Us</option>
                </select>
              </Field>

              <Field label="Destination WhatsApp Number">
                <div className="input-with-icon">
                  <Phone size={16} />
                  <input
                    value={content.whatsapp}
                    onChange={(e) => edit('whatsapp', e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                {content.whatsapp && (
                  <a
                    href={`https://wa.me/${content.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tiny text-indigo-600 inline-flex items-center gap-1 mt-1"
                  >
                    Test WhatsApp link <ExternalLink size={12} />
                  </a>
                )}
              </Field>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: AD VISUALS & CANVAS */}
      {tab === 'creative' && (
        <div className="grid two gap-6 mt-6">
          <section className="panel">
            <h3>Active Creative Asset</h3>
            {activeAssetId ? (
              <div className="active-asset-preview-wrap">
                <img
                  src={`/api${base}/assets/${activeAssetId}`}
                  alt="Active Creative"
                  className="active-asset-full"
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-500">Asset ID: {activeAssetId}</span>
                  <a
                    href={`/api${base}/assets/${activeAssetId}`}
                    download="campaign-active-creative.png"
                    className="button small secondary"
                  >
                    <Download size={14} /> Download Image
                  </a>
                </div>
              </div>
            ) : (
              <div className="canvas-wrapper">
                <CreativeCanvas
                  base={base}
                  onCanvas={(c) => {
                    canvas.current = c;
                  }}
                  card={content.cards[0] || emptyCard()}
                  format={content.format}
                />
              </div>
            )}
          </section>

          <section className="panel">
            <h3>Format & Creative Options</h3>
            <Field label="Creative Placement Format">
              <select value={content.format} onChange={(e) => edit('format', e.target.value)}>
                <option value="square">Square · 1080 × 1080 (Feed)</option>
                <option value="portrait">Portrait · 1080 × 1350 (Instagram Feed)</option>
                <option value="story">Vertical · 1080 × 1920 (Stories & Reels)</option>
              </select>
            </Field>

            <div className="mt-6">
              <h4>Switch to an AI-Generated Poster</h4>
              <p className="tiny muted">
                Select from any image generated in your AI studio for this campaign.
              </p>
              {studioProject?.content.versions.length ? (
                <div className="mini-versions-row mt-2">
                  {studioProject.content.versions.map((v, i) => (
                    <img
                      key={v.assetId}
                      src={`/api${base}/assets/${v.assetId}`}
                      alt={`Version ${i + 1}`}
                      className={`mini-thumb ${v.assetId === activeAssetId ? 'active' : ''}`}
                      onClick={() => handleSelectCreativeAsset(v.assetId)}
                      title={`Version ${i + 1} (${v.style})`}
                    />
                  ))}
                </div>
              ) : (
                <Button variant="secondary" className="mt-2" onClick={() => setTab('ai')}>
                  <Sparkles size={14} /> Open AI Studio to Generate Posters
                </Button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: AUDIENCE & BUDGET */}
      {tab === 'targeting' && (
        <section className="panel max-w-3xl mt-6">
          <h3>Targeting, Placements & Budget</h3>
          <p className="step-desc">
            Define who sees your ads, where they appear, and your daily advertising limit.
          </p>

          <div className="form-stack mt-4">
            <TargetingFields content={content} onChange={edit} />

            <div className="grid two mt-4">
              <Field label={`Daily Budget (${business.currency}) *`}>
                <input
                  type="number"
                  min="50"
                  value={content.dailyBudget}
                  onChange={(e) => edit('dailyBudget', Number(e.target.value))}
                />
                <span className="tiny muted">
                  Approx. {money(content.dailyBudget * 30, business.currency)} estimated monthly
                  spend
                </span>
              </Field>

              <Field label="Target Country">
                <select
                  value={content.targetCountry || 'IN'}
                  onChange={(e) => edit('targetCountry', e.target.value)}
                >
                  <option value="IN">India (IN)</option>
                  <option value="US">United States (US)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="AE">United Arab Emirates (AE)</option>
                  <option value="CA">Canada (CA)</option>
                  <option value="AU">Australia (AU)</option>
                </select>
              </Field>
            </div>

            <div className="grid two">
              <Field label="Start Date">
                <input
                  type="date"
                  value={content.startDate}
                  onChange={(e) => edit('startDate', e.target.value)}
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  value={content.endDate}
                  onChange={(e) => edit('endDate', e.target.value)}
                />
              </Field>
            </div>

            <BudgetPanel campaign={campaign} />
          </div>
        </section>
      )}

      {/* TAB 5: LIVE META PREVIEW */}
      {tab === 'preview' && (
        <div className="grid two gap-6 mt-6">
          <section className="panel flex flex-col items-center">
            <div className="preview-device-selector mb-4">
              <button
                type="button"
                className={previewDevice === 'facebook' ? 'active' : ''}
                onClick={() => setPreviewDevice('facebook')}
              >
                Facebook Feed
              </button>
              <button
                type="button"
                className={previewDevice === 'instagram' ? 'active' : ''}
                onClick={() => setPreviewDevice('instagram')}
              >
                Instagram Feed
              </button>
              <button
                type="button"
                className={previewDevice === 'story' ? 'active' : ''}
                onClick={() => setPreviewDevice('story')}
              >
                Instagram Story
              </button>
            </div>

            {/* Realistic Meta Feed Mockup */}
            {previewDevice !== 'story' ? (
              <div className="meta-phone-frame">
                <div className="meta-ad-card">
                  {/* Card Header */}
                  <div className="meta-card-header">
                    <div className="meta-avatar">
                      {brand.logoAssetId ? (
                        <img src={`/api${base}/assets/${brand.logoAssetId}`} alt="Logo" />
                      ) : (
                        business.name.slice(0, 1)
                      )}
                    </div>
                    <div className="meta-header-meta">
                      <strong>{business.name}</strong>
                      <span className="meta-sub">Sponsored · 🌐</span>
                    </div>
                  </div>

                  {/* Primary Text */}
                  <div className="meta-primary-text">
                    {content.primaryText || 'Your compelling ad copy will appear here...'}
                  </div>

                  {/* Creative Image */}
                  <div className="meta-media-box">
                    {activeAssetId ? (
                      <img
                        src={`/api${base}/assets/${activeAssetId}`}
                        alt="Creative"
                        className="meta-ad-img"
                      />
                    ) : (
                      <div className="meta-img-placeholder">
                        <ImageIcon size={40} className="text-gray-300" />
                        <span>No creative image selected yet</span>
                      </div>
                    )}
                  </div>

                  {/* CTA Bar */}
                  <div className="meta-cta-bar">
                    <div className="meta-cta-copy">
                      <span className="meta-dest-domain">WHATSAPP.COM</span>
                      <strong className="meta-cta-headline">
                        {content.headline || 'Your Headline Here'}
                      </strong>
                      <p className="meta-cta-desc">
                        {content.description || 'Tap to chat with us'}
                      </p>
                    </div>
                    <div className="meta-cta-btn">
                      <MessageSquare size={14} /> Send WhatsApp Message
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Instagram Story Mockup */
              <div className="meta-story-frame">
                {activeAssetId ? (
                  <img
                    src={`/api${base}/assets/${activeAssetId}`}
                    alt="Story Creative"
                    className="meta-story-bg"
                  />
                ) : (
                  <div className="meta-story-placeholder">
                    <ImageIcon size={40} className="text-gray-300" />
                  </div>
                )}
                <div className="meta-story-overlay">
                  <div className="meta-story-header">
                    <div className="meta-avatar-small">{business.name.slice(0, 1)}</div>
                    <span>{business.name}</span>
                    <span className="meta-sub">Sponsored</span>
                  </div>
                  <div className="meta-story-footer">
                    <div className="story-cta-pill">
                      <Phone size={14} /> Send WhatsApp Message
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right: Package Summary & 1-Click Export */}
          <section className="panel">
            <div className="section-heading">
              <h3>Meta Ads Ready Package</h3>
              <Button variant="secondary" onClick={copyMetaPackage}>
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? 'Copied to clipboard!' : 'Copy all text'}
              </Button>
            </div>

            <p className="tiny muted">
              All copy and parameters are organized and ready to run on your Meta Ad Account.
            </p>

            <div className="package-breakdown mt-4">
              <div className="package-item">
                <span className="package-label">Primary Text</span>
                <p className="package-val">{content.primaryText || '—'}</p>
              </div>

              <div className="package-item">
                <span className="package-label">Headline</span>
                <p className="package-val font-semibold">{content.headline || '—'}</p>
              </div>

              <div className="package-item">
                <span className="package-label">Description</span>
                <p className="package-val">{content.description || '—'}</p>
              </div>

              <div className="package-item">
                <span className="package-label">Action Destination</span>
                <p className="package-val">
                  {content.whatsapp ? (
                    <span className="text-emerald-700 font-mono">
                      WhatsApp: {content.whatsapp} (wa.me/{content.whatsapp.replace(/[^0-9]/g, '')})
                    </span>
                  ) : (
                    'Not specified'
                  )}
                </p>
              </div>

              <div className="package-item">
                <span className="package-label">Audience & Placements</span>
                <p className="package-val">
                  {content.targetCountry || 'IN'} ({content.location || 'All regions'}), Ages{' '}
                  {content.ageMin || 18}–{content.ageMax || 65} · Facebook & Instagram
                </p>
              </div>

              <div className="package-item">
                <span className="package-label">Creative Asset</span>
                {activeAssetId ? (
                  <div className="flex items-center gap-3 mt-1">
                    <img
                      src={`/api${base}/assets/${activeAssetId}`}
                      alt="Thumbnail"
                      className="h-12 w-12 object-cover rounded border"
                    />
                    <a
                      href={`/api${base}/assets/${activeAssetId}`}
                      download="meta-ad-creative.png"
                      className="button small secondary"
                    >
                      <Download size={13} /> Download Creative Image
                    </a>
                  </div>
                ) : (
                  <p className="package-val text-amber-600">No creative asset selected yet</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 6: REVIEW & APPROVAL */}
      {tab === 'approval' && (
        <section className="panel max-w-3xl mt-6">
          <h3>Campaign Review & Revision History</h3>
          <p className="step-desc">
            Immutable snapshot log: any edit increments revision and clears approval to ensure zero
            unintended changes are published.
          </p>

          <div className="review-workflow-card mt-4">
            <div className="flex justify-between items-center">
              <div>
                <strong>Current Status: {campaign.review_state}</strong>
                <p className="tiny muted">Revision {campaign.revision}</p>
              </div>
              <div className="flex gap-2">
                {['DRAFT', 'CHANGES_REQUESTED'].includes(campaign.review_state) && (
                  <Button onClick={() => handleReviewAction('submit')} disabled={busy}>
                    Submit revision for review
                  </Button>
                )}
                {owner && campaign.review_state === 'IN_REVIEW' && (
                  <>
                    <Button onClick={() => handleReviewAction('approve')} disabled={busy}>
                      <Check size={14} /> Approve Revision {campaign.revision}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleReviewAction('request-changes')}
                      disabled={busy}
                    >
                      Request changes
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <MetaPublishingPanel campaign={campaign} dirty={dirty} />
          <div className="revisions-list mt-6">
            <h4>Snapshot History</h4>
            {history.data?.map((r) => (
              <div className="offer-row" key={String(r.revision)}>
                <strong>Revision {String(r.revision)}</strong>
                <span>{String(r.created_at).slice(0, 16).replace('T', ' ')}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
