import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  Sparkles,
  Upload,
  Download,
  X,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Notice, Loading } from '../components/ui';

type Brief = Record<string, string>;
type Concept = Brief & { id: string; title: string; posterText: string; visualDirection: string };
type Version = { assetId: string; size: string; quality?: { status: string; issues: string[] } };
export type PosterProject = {
  id: string;
  revision: number;
  content: {
    prompt: string;
    campaignId?: string;
    messages?: { role: string; text: string }[];
    concepts?: Concept[];
    selectedConcept?: Concept;
    brief?: Brief;
    briefApproved?: boolean;
    refinementMessage?: string;
    questions?: string[];
    preparedPrompt?: { promptVersion: string; prompt: string; settings: Record<string, string> };
    versions: Version[];
    selectedAssetId?: string;
  };
};
const steps = ['Your campaign', 'Creative ideas', 'Visual style', 'Review wording', 'Your poster'];
const styles = [
  {
    id: 'blended',
    name: 'Blended photography',
    note: 'Subjects, type and shapes composed together.',
    use: 'Services, healthcare, education',
    image: 'blended.png',
  },
  {
    id: 'bold',
    name: 'Bold offer',
    note: 'A big offer and confident contrast.',
    use: 'Promotions, packages, local offers',
    image: 'bold.svg',
  },
  {
    id: 'product',
    name: 'Product spotlight',
    note: 'Rich lighting and an impressive product hero.',
    use: 'Food, gifts, beauty, retail',
    image: 'product.png',
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle story',
    note: 'A relatable moment with an emotional hook.',
    use: 'Fitness, family, travel',
    image: 'lifestyle.png',
  },
  {
    id: 'premium',
    name: 'Premium editorial',
    note: 'Refined typography and a considered composition.',
    use: 'Premium services, jewellery, interiors',
    image: 'premium.png',
  },
  {
    id: 'illustrated',
    name: 'Illustrated & playful',
    note: 'Characters, colour and a distinctive visual world.',
    use: 'Play arenas, apps, children’s activities',
    image: 'illustrated.svg',
  },
  {
    id: 'typographic',
    name: 'Expressive typography',
    note: 'The words become the main visual.',
    use: 'Launches, events, announcements',
    image: 'typographic.svg',
  },
  {
    id: 'festive',
    name: 'Festive celebration',
    note: 'Occasion-led atmosphere around a clear offer.',
    use: 'Seasonal promotions and gifts',
    image: 'festive.svg',
  },
  {
    id: 'informational',
    name: 'Informational',
    note: 'Features and inclusions with clear hierarchy.',
    use: 'Packages, comparisons, courses',
    image: 'informational.svg',
  },
];
function initialStep(p: PosterProject) {
  return p.content.versions?.length
    ? 4
    : p.content.briefApproved
      ? 3
      : p.content.selectedConcept
        ? 2
        : p.content.concepts?.length
          ? 1
          : 0;
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal-card pf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-dialog-title"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Tab') {
            const controls = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'button,a[href],input,textarea,select,[tabindex="0"]',
              ),
            ).filter((x) => !x.hasAttribute('disabled'));
            const first = controls[0],
              last = controls.at(-1);
            if (
              e.shiftKey &&
              (document.activeElement === first || document.activeElement === e.currentTarget)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last || document.activeElement === e.currentTarget)
            ) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="pf-row">
          <h2 id="pf-dialog-title">{title}</h2>
          <button className="pf-icon" aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function PosterFlow({
  campaignId,
  projectId,
  initialDescription = '',
  locked = false,
  onApplied,
  beforeAction,
}: {
  campaignId?: string;
  projectId?: string;
  initialDescription?: string;
  locked?: boolean;
  onApplied?: () => Promise<void>;
  beforeAction?: () => Promise<boolean>;
}) {
  const { base } = useWorkspace();
  const cache = useQueryClient();
  const [localId, setLocalId] = useState(projectId || '');
  const projectQuery = useQuery({
    queryKey: [base, 'guided-poster', campaignId || localId],
    queryFn: async () => {
      if (localId) return api<PosterProject>(`${base}/studio/${localId}`);
      if (campaignId) {
        try {
          return await api<PosterProject>(`${base}/studio/by-campaign/${campaignId}`);
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }
      }
      return null;
    },
  });
  const p = projectQuery.data;
  const c = p?.content;
  const [step, setStep] = useState(0),
    [description, setDescription] = useState(initialDescription),
    [style, setStyle] = useState('blended'),
    [size, setSize] = useState('1024x1024'),
    [resolution, setResolution] = useState('1K');
  const [words, setWords] = useState(''),
    [direction, setDirection] = useState(''),
    [hierarchy, setHierarchy] = useState(''),
    [preferences, setPreferences] = useState(''),
    [reference, setReference] = useState(''),
    [change, setChange] = useState(''),
    [feedback, setFeedback] = useState(''),
    [previous, setPrevious] = useState('');
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [modal, setModal] = useState<'prompt' | 'style' | null>(null),
    [moreStyles, setMoreStyles] = useState(false),
    [selectedVersion, setSelectedVersion] = useState(''),
    [beforeWords, setBeforeWords] = useState('');
  const hydrated = useRef('');
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!p || hydrated.current === p.id) return;
    hydrated.current = p.id;
    setDescription(p.content.prompt || initialDescription);
    setWords(p.content.brief?.posterText || '');
    setDirection(p.content.brief?.visualDirection || '');
    setHierarchy(p.content.brief?.hierarchy || '');
    setStep(initialStep(p));
    setSelectedVersion(p.content.selectedAssetId || p.content.versions?.at(-1)?.assetId || '');
    const saved = p.content.preparedPrompt?.settings;
    if (saved) {
      setStyle(styles.some((item) => item.id === saved.style) ? saved.style : 'blended');
      setSize(saved.size || '1024x1024');
      setResolution(saved.imageResolution || '1K');
      setPreferences(saved.designInstructions || '');
      setReference(saved.styleReferenceAssetId || '');
      setFeedback(saved.feedback || '');
      setPrevious(saved.previousAssetId || '');
    }
  }, [p, initialDescription]);
  const settings = {
    style,
    size,
    imageResolution: resolution,
    visualApproach: 'auto',
    styleReferenceAssetId: reference,
    designInstructions: preferences.trim(),
    feedback,
    previousAssetId: previous,
  };
  const cleanCopy =
    !!c?.briefApproved &&
    words === c.brief?.posterText &&
    direction === c.brief?.visualDirection &&
    hierarchy === (c.brief?.hierarchy || '');
  const promptReady = !!(
    cleanCopy &&
    c?.preparedPrompt?.promptVersion === 'poster-v8-concise-poster-ideas' &&
    Object.entries(settings).every(([key, value]) => c.preparedPrompt?.settings[key] === value)
  );
  async function run(label: string, job: () => Promise<void>) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      if (beforeAction && !(await beforeAction())) return;
      await job();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  function accept(next: PosterProject) {
    cache.setQueryData([base, 'guided-poster', campaignId || localId], next);
    void cache.invalidateQueries({ queryKey: [base, 'studio-by-campaign', campaignId] });
  }
  async function discuss() {
    await run('Developing five ideas', async () => {
      let id = p?.id;
      if (!id) {
        const next = await api<PosterProject>(base + '/studio', 'POST', {
          prompt: description,
          campaignId,
        });
        id = next.id;
        setLocalId(id);
        hydrated.current = id;
      }
      const next = await api<PosterProject>(`${base}/studio/${id}/discuss`, 'POST', {
        message: description,
        styleReferenceAssetId: reference,
      });
      cache.setQueryData([base, 'guided-poster', campaignId || id], next);
      setWords(next.content.brief?.posterText || '');
      setDirection(next.content.brief?.visualDirection || '');
      setHierarchy(next.content.brief?.hierarchy || '');
      setStep(1);
    });
  }
  async function choose(idea: Concept) {
    if (!p) return;
    await run('Selecting your idea', async () => {
      const next = await api<PosterProject>(`${base}/studio/${p.id}/concept`, 'POST', {
        revision: p.revision,
        conceptId: idea.id,
      });
      accept(next);
      setWords(next.content.brief?.posterText || '');
      setDirection(next.content.brief?.visualDirection || '');
      setHierarchy(next.content.brief?.hierarchy || '');
      setStep(2);
      setPrevious('');
      setFeedback('');
    });
  }
  async function refine() {
    if (!p) return;
    await run('Refining your selected idea', async () => {
      setBeforeWords(words);
      const next = await api<PosterProject>(`${base}/studio/${p.id}/refine`, 'POST', {
        revision: p.revision,
        message: change,
        posterText: words,
        visualDirection: direction,
        hierarchy,
      });
      accept(next);
      setWords(next.content.brief?.posterText || '');
      setDirection(next.content.brief?.visualDirection || '');
      setHierarchy(next.content.brief?.hierarchy || '');
      setChange('');
      setNotice(
        next.content.refinementMessage || 'Your brief has been updated. Review the changes below.',
      );
    });
  }
  async function prepare() {
    if (!p) return;
    await run('Preparing your poster direction', async () => {
      let next = p;
      if (!cleanCopy) {
        next = await api<PosterProject>(`${base}/studio/${p.id}/brief`, 'PUT', {
          revision: p.revision,
          brief: { ...c?.brief, posterText: words, visualDirection: direction, hierarchy },
        });
        accept(next);
      }
      await api(`${base}/studio/${next.id}/prompt-preview`, 'POST', {
        ...settings,
        revision: next.revision,
      });
      const saved = await api<PosterProject>(`${base}/studio/${next.id}`);
      accept(saved);
      setStep(4);
      setNotice('Your wording and direction are saved. Ready to generate.');
    });
  }
  async function generate() {
    if (!p) return;
    await run('Generating and reviewing your poster', async () => {
      const next = await api<PosterProject>(`${base}/studio/${p.id}/generate`, 'POST', {
        ...settings,
        revision: p.revision,
      });
      accept(next);
      setSelectedVersion(
        next.content.selectedAssetId || next.content.versions.at(-1)?.assetId || '',
      );
      setNotice('Poster ready. Check wording, price and branding before using it.');
    });
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a PNG or JPEG under 10 MB.');
      return;
    }
    await run('Uploading reference', async () => {
      const data = new FormData();
      data.append('file', file);
      const asset = await api<{ id: string }>(base + '/assets', 'POST', data);
      setReference(asset.id);
      setNotice(
        'Reference saved. Its design will guide the poster; its claims will not be copied.',
      );
    });
  }
  const current = c?.versions?.find((v) => v.assetId === selectedVersion) || c?.versions?.at(-1);
  const styleInfo = styles.find((x) => x.id === style);
  const disabled = !!busy || locked || !!projectQuery.error;
  const linkedCampaign = campaignId || c?.campaignId;
  if (projectQuery.isLoading) return <Loading />;
  return (
    <section className="poster-flow" aria-label="Guided poster creation">
      <header className="pf-header">
        <div>
          <span className="pf-eyebrow">POSTER WORKSPACE</span>
          <h2>One idea. A poster worth noticing.</h2>
          <p>Shape the message, choose a look, then bring it to life.</p>
        </div>
        <span className="pf-save">
          {busy ? (
            <>
              <LoaderCircle size={15} className="spin" />
              {busy}…
            </>
          ) : p ? (
            'Campaign workspace'
          ) : (
            'New workspace'
          )}
        </span>
      </header>
      <nav className="pf-progress" aria-label="Poster creation steps">
        {steps.map((title, i) => {
          const available =
            i === 0 || (i === 1 && !!c?.concepts?.length) || (i >= 2 && !!c?.selectedConcept);
          return (
            <button
              key={title}
              disabled={!available || disabled}
              aria-current={step === i ? 'step' : undefined}
              className={step === i ? 'current' : i < step ? 'complete' : ''}
              onClick={() => setStep(i)}
            >
              <span>{i < step ? <Check size={14} /> : i + 1}</span>
              {title}
            </button>
          );
        })}
      </nav>
      {projectQuery.error && (
        <Notice error>
          {projectQuery.error.message}{' '}
          <button className="pf-text-button" onClick={() => void projectQuery.refetch()}>
            Try again
          </button>
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {locked && (
        <Notice>
          This published campaign is read-only. Create a new campaign to design another poster.
        </Notice>
      )}
      {step >= 2 && c?.selectedConcept && (
        <details className="pf-selected-plan">
          <summary>Selected poster idea: {c.selectedConcept.title}</summary>
          <div>
            <p className="pf-exact-copy">{words}</p>
            <p>
              <strong>Hero:</strong> {direction}
            </p>
            {hierarchy && (
              <p>
                <strong>Attention order:</strong> {hierarchy}
              </p>
            )}
          </div>
        </details>
      )}
      <div className="pf-stage" key={step}>
        {step === 0 && (
          <>
            <div className="pf-step-title">
              <span>01 / THE STARTING POINT</span>
              <h3>What would you like to advertise?</h3>
              <p>Tell us the offer, who it’s for, and what customers should do next.</p>
            </div>
            <label className="pf-field">
              <span>Your campaign description</span>
              <textarea
                rows={6}
                value={description}
                maxLength={3000}
                disabled={disabled}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="For example: Promote our weekend restaurant brunch at ₹699. Reach nearby families and encourage table bookings."
              />
            </label>
            <p className="pf-helper">
              Include exact prices and claims you can stand behind. Your saved business details and
              logo are used automatically.
            </p>
            <div className="pf-reference">
              <label className="button secondary">
                <Upload size={16} /> Add inspiration
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  hidden
                  disabled={disabled}
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <span>Optional · A poster whose look you like</span>
              {reference && (
                <>
                  <img src={`/api${base}/assets/${reference}`} alt="Uploaded design reference" />
                  <button
                    className="pf-icon"
                    aria-label="Remove reference"
                    onClick={() => setReference('')}
                    disabled={disabled}
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </div>
            <div className="pf-actions">
              <span>Next: five creative directions tailored to your campaign</span>
              <button
                className="button"
                disabled={disabled || !description.trim()}
                onClick={() => void discuss()}
              >
                <Sparkles size={16} /> {busy || 'Explore creative ideas'}
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="pf-step-title">
              <span>02 / FIND YOUR ANGLE</span>
              <h3>Which idea feels right?</h3>
              <p>
                Compare the hook, offer, visual story and action. Each card is a different creative
                direction.
              </p>
            </div>
            {!!c?.questions?.length && (
              <div className="pf-questions">
                <strong>A few details to clarify</strong>
                {c.questions.map((q) => (
                  <p key={q}>{q}</p>
                ))}
                <button className="button secondary" disabled={disabled} onClick={() => setStep(0)}>
                  Update campaign description
                </button>
              </div>
            )}
            <div className="pf-rail-controls">
              <span>{c?.concepts?.length || 0} ideas · scroll to compare</span>
              <div>
                <button
                  className="pf-icon"
                  aria-label="Previous ideas"
                  onClick={() => rail.current?.scrollBy({ left: -380, behavior: 'smooth' })}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="pf-icon"
                  aria-label="Next ideas"
                  onClick={() => rail.current?.scrollBy({ left: 380, behavior: 'smooth' })}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <div className="pf-idea-rail" ref={rail} tabIndex={0} aria-label="Creative ideas">
              {c?.concepts?.map((idea, i) => (
                <article
                  className={'pf-idea ' + (c.selectedConcept?.id === idea.id ? 'selected' : '')}
                  key={idea.id}
                >
                  <div className="pf-idea-top">
                    <span>IDEA {String(i + 1).padStart(2, '0')}</span>
                    {c.selectedConcept?.id === idea.id && <Check size={18} />}
                  </div>
                  <h4>{idea.title}</h4>
                  <p className="pf-angle">{idea.angle}</p>
                  <dl className="pf-poster-outline">
                    <dt>Headline · printed</dt>
                    <dd className="pf-hook">{idea.hook || idea.posterText.split('\n')[0]}</dd>
                    <dt>Hero image · not printed</dt>
                    <dd>{idea.heroVisual || idea.visualDirection}</dd>
                    <dt>Offer · printed</dt>
                    <dd className="pf-offer">{idea.offer || idea.mainMessage || c.brief?.offer}</dd>
                    {idea.supportingDetails && (
                      <>
                        <dt>Supporting words · printed</dt>
                        <dd>{idea.supportingDetails}</dd>
                      </>
                    )}
                    <dt>Call to action · printed</dt>
                    <dd>
                      <span className="pf-cta-preview">
                        {idea.cta || c.brief?.cta || idea.posterText.split('\n').at(-1)}
                      </span>
                    </dd>
                  </dl>
                  {idea.hierarchy && (
                    <div className="pf-priority">
                      <strong>What catches the eye first</strong>
                      <p>{idea.hierarchy}</p>
                    </div>
                  )}
                  <details>
                    <summary>See all poster wording</summary>
                    <p className="pf-exact-copy">{idea.posterText}</p>
                    <p>{idea.rationale}</p>
                  </details>
                  <button className="button" disabled={disabled} onClick={() => void choose(idea)}>
                    Choose this poster idea
                    <ArrowRight size={16} />
                  </button>
                </article>
              ))}
            </div>
            <div className="pf-actions">
              <button className="button secondary" disabled={disabled} onClick={() => setStep(0)}>
                <ArrowLeft size={16} /> Change the brief
              </button>
              <button
                className="button secondary"
                disabled={disabled}
                onClick={() => void discuss()}
              >
                Explore another set
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="pf-step-title">
              <span>03 / CHOOSE THE LOOK</span>
              <h3>Give your idea a visual personality.</h3>
              <p>
                Selected idea: <strong>{c?.selectedConcept?.title}</strong>. These are illustrative
                samples, not previews of your campaign.
              </p>
            </div>
            <div className="pf-style-grid">
              {styles.slice(0, moreStyles ? styles.length : 6).map((s) => (
                <button
                  type="button"
                  aria-pressed={style === s.id}
                  className={'pf-style ' + (style === s.id ? 'selected' : '')}
                  key={s.id}
                  disabled={disabled}
                  onClick={() => setStyle(s.id)}
                >
                  <img
                    src={`/poster-styles/${s.image}`}
                    alt={`${s.name} illustrative poster sample`}
                  />
                  <span className="pf-style-label">
                    <strong>{s.name}</strong>
                    {style === s.id && <Check size={18} />}
                  </span>
                  <span>{s.note}</span>
                  <small>{s.use}</small>
                </button>
              ))}
            </div>
            <div className="pf-row">
              <button className="pf-text-button" onClick={() => setMoreStyles(!moreStyles)}>
                {moreStyles ? 'Fewer styles' : 'More styles'}
              </button>
              <button className="pf-text-button" onClick={() => setModal('style')}>
                View selected sample larger
              </button>
            </div>
            <label className="pf-field">
              <span>Where will this poster appear?</span>
              <select disabled={disabled} value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="1024x1024">Square · 1:1 · Facebook & Instagram feed</option>
                <option value="1024x1280">Portrait · 4:5 · Instagram feed</option>
                <option value="1152x2048">Vertical · 9:16 · Stories & Reels</option>
              </select>
            </label>
            <div className="pf-actions">
              <button className="button secondary" disabled={disabled} onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> Ideas
              </button>
              <button className="button" disabled={disabled} onClick={() => setStep(3)}>
                Review this idea
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="pf-step-title">
              <span>04 / MAKE IT YOURS</span>
              <h3>Get the words and direction right.</h3>
              <p>
                Nothing is generated until you approve this brief. Changes to prices or MRP belong
                here.
              </p>
            </div>
            <div className="pf-review-summary">
              <span>{c?.selectedConcept?.title}</span>
              <span>
                {styleInfo?.name || style} ·{' '}
                {size === '1024x1024' ? 'Square' : size === '1024x1280' ? 'Portrait' : 'Vertical'}
              </span>
              <button className="pf-text-button" disabled={disabled} onClick={() => setStep(2)}>
                Change look
              </button>
            </div>
            <div className="pf-review-grid">
              <label className="pf-field">
                <span>Exact words on the poster</span>
                <textarea
                  value={words}
                  rows={10}
                  maxLength={1800}
                  disabled={disabled}
                  onChange={(e) => setWords(e.target.value)}
                />
                <small>
                  {words.trim() ? words.trim().split(/\s+/).length : 0} words · Check price,
                  inclusions and action. Keep extra explanation in your ad caption.
                </small>
                {words.trim().split(/\s+/).length > 45 && (
                  <small className="pf-copy-warning">
                    This may feel crowded on a phone. Consider shortening supporting details.
                  </small>
                )}
              </label>
              <div>
                <label className="pf-field">
                  <span>Hero image / scene</span>
                  <textarea
                    value={direction}
                    rows={3}
                    maxLength={3000}
                    disabled={disabled}
                    onChange={(e) => setDirection(e.target.value)}
                  />
                </label>
                <label className="pf-field">
                  <span>What should stand out first?</span>
                  <textarea
                    rows={2}
                    value={hierarchy}
                    maxLength={600}
                    disabled={disabled}
                    onChange={(e) => setHierarchy(e.target.value)}
                    placeholder="Offer price → hero image → headline → CTA → small brand"
                  />
                  <small>Visual priority only. These instructions won’t be printed.</small>
                </label>
                <label className="pf-field">
                  <span>Additional design preferences (optional)</span>
                  <textarea
                    rows={2}
                    value={preferences}
                    maxLength={3000}
                    disabled={disabled}
                    onChange={(e) => setPreferences(e.target.value)}
                    placeholder="For example: warm lighting, playful energy, a larger price."
                  />
                </label>
              </div>
            </div>
            {(feedback || previous) && (
              <label className="pf-field">
                <span>Visual changes for this version</span>
                <textarea
                  rows={3}
                  disabled={disabled}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
                <small>
                  {previous
                    ? 'The selected poster is included as an image reference.'
                    : 'A fresh image will be generated without the previous poster as a reference.'}{' '}
                  Change printable words in the copy above.
                </small>
              </label>
            )}
            <div className="pf-refine">
              <label className="pf-field">
                <span>What would you like to change?</span>
                <input
                  value={change}
                  maxLength={3000}
                  disabled={disabled}
                  onChange={(e) => setChange(e.target.value)}
                  placeholder="Add an MRP of ₹999, shorten the hook, or focus on families…"
                />
              </label>
              <button
                className="button secondary"
                disabled={disabled || !change.trim()}
                onClick={() => void refine()}
              >
                <Sparkles size={16} /> Update my brief
              </button>
            </div>
            {beforeWords && beforeWords !== words && (
              <details className="pf-changes" open>
                <summary>Wording changed · compare before and after</summary>
                <div className="pf-review-grid">
                  <pre>{beforeWords}</pre>
                  <pre>{words}</pre>
                </div>
              </details>
            )}
            {c?.questions?.map((q) => (
              <Notice key={q}>{q}</Notice>
            ))}
            <details className="pf-advanced">
              <summary>Output settings</summary>
              <label className="pf-field">
                <span>Resolution</span>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  disabled={disabled}
                >
                  <option value="1K">1K · Low-cost drafts</option>
                  <option value="2K">2K · Larger poster</option>
                  <option value="4K">4K · Large export</option>
                </select>
              </label>
              <p>Your workspace owner manages the image model.</p>
            </details>
            <div className="pf-actions">
              <button className="button secondary" disabled={disabled} onClick={() => setStep(2)}>
                <ArrowLeft size={16} /> Visual style
              </button>
              <button
                className="button"
                disabled={disabled || !words.trim() || !direction.trim()}
                onClick={() => void prepare()}
              >
                {busy || 'Approve & prepare poster'}
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <div className="pf-step-title">
              <span>05 / BRING IT TO LIFE</span>
              <h3>{current ? 'Review your poster.' : 'Your idea is ready to become a poster.'}</h3>
              <p>
                {current
                  ? 'Check the details at full size before using this creative.'
                  : 'AI will use your approved wording, selected idea, visual style and original brand assets.'}
              </p>
            </div>
            {!promptReady && (
              <Notice>
                Your wording or design settings changed. Review and prepare them before generating
                another poster.
              </Notice>
            )}
            <div className="pf-generation-bar">
              <span>
                {styleInfo?.name || style} · {resolution}
              </span>
              <button
                className="pf-text-button"
                disabled={!c?.preparedPrompt}
                onClick={() => setModal('prompt')}
              >
                <Eye size={16} /> View image prompt
              </button>
              <button
                className="button"
                disabled={disabled || !promptReady}
                onClick={() => void generate()}
              >
                <Sparkles size={16} />
                {busy || (current ? 'Generate another version' : 'Generate poster')}
              </button>
            </div>
            {busy && (
              <div className="pf-working" role="status">
                <LoaderCircle className="spin" />
                <strong>{busy}…</strong>
                <p>This can take a few minutes. Keep this workspace open.</p>
              </div>
            )}
            {current && (
              <>
                <div className="pf-result">
                  <img
                    src={`/api${base}/assets/${current.assetId}`}
                    alt="Generated campaign poster"
                  />
                  <div className="pf-result-side">
                    <h4>Your generated creative</h4>
                    <p>
                      Review the logo, spelling, offer and customer action. AI checks are advisory.
                    </p>
                    {current.quality && (
                      <div className="pf-quality">
                        <strong>
                          {current.quality.status === 'PASS'
                            ? 'AI check complete'
                            : 'Check these details'}
                        </strong>
                        {current.quality.issues.map((issue, i) => (
                          <p key={i}>{issue}</p>
                        ))}
                        {!!current.quality.issues.length && (
                          <button
                            className="pf-text-button"
                            disabled={disabled}
                            onClick={() => {
                              setPrevious(current.assetId);
                              setFeedback(
                                'Correct the flagged issues while preserving the exact approved copy and selected composition: ' +
                                  current.quality!.issues.join('; '),
                              );
                              setStep(3);
                              setNotice(
                                'The flagged issues have been added to your revision request. Review the brief, then prepare the correction.',
                              );
                            }}
                          >
                            Prepare a correction
                          </button>
                        )}
                      </div>
                    )}
                    <a
                      className="button secondary"
                      href={`/api${base}/assets/${current.assetId}`}
                      download="campaign-poster.png"
                    >
                      <Download size={16} /> Download poster
                    </a>
                    {linkedCampaign && (
                      <button
                        className="button"
                        disabled={disabled}
                        onClick={() =>
                          void run('Saving creative to campaign', async () => {
                            if (!p) return;
                            await api(`${base}/studio/${p.id}/select`, 'POST', {
                              assetId: current.assetId,
                            });
                            await api(
                              `${base}/studio/${p.id}/apply-to-campaign/${linkedCampaign}`,
                              'POST',
                            );
                            await projectQuery.refetch();
                            await onApplied?.();
                            setNotice('Poster and supporting ad copy saved to your campaign.');
                          })
                        }
                      >
                        Use in campaign
                        <Check size={16} />
                      </button>
                    )}
                    <label className="pf-field">
                      <span>Request visual changes</span>
                      <textarea
                        rows={3}
                        disabled={disabled}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Make the offer larger, warm up the scene, or change the composition…"
                      />
                    </label>
                    <div className="pf-revision-actions">
                      <button
                        className="button secondary"
                        disabled={disabled || !feedback.trim()}
                        onClick={() => {
                          setPrevious(current.assetId);
                          setStep(3);
                          setNotice(
                            'Existing poster selected as a reference. Review the brief, then prepare the revision.',
                          );
                        }}
                      >
                        Improve this design
                      </button>
                      <button
                        className="button secondary"
                        disabled={disabled}
                        onClick={() => {
                          setPrevious('');
                          setFeedback(
                            'Create a distinctly different composition for the same approved offer.',
                          );
                          setStep(3);
                          setNotice(
                            'A fresh composition will be created without the previous poster as a reference.',
                          );
                        }}
                      >
                        Try a new composition
                      </button>
                    </div>
                    <button
                      className="pf-text-button"
                      disabled={disabled}
                      onClick={() => setStep(3)}
                    >
                      Change poster wording
                    </button>
                  </div>
                </div>
                <div className="pf-version-rail" aria-label="Generated versions">
                  {c?.versions?.map((v, i) => (
                    <button
                      className={current.assetId === v.assetId ? 'selected' : ''}
                      aria-pressed={current.assetId === v.assetId}
                      key={v.assetId}
                      onClick={() => setSelectedVersion(v.assetId)}
                    >
                      <img
                        src={`/api${base}/assets/${v.assetId}`}
                        alt={`Poster version ${i + 1}`}
                      />
                      <span>Version {i + 1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="pf-actions">
              <button className="button secondary" disabled={disabled} onClick={() => setStep(3)}>
                <ArrowLeft size={16} /> Back to brief
              </button>
            </div>
          </>
        )}
      </div>
      {modal === 'style' && styleInfo && (
        <Modal title={styleInfo.name} close={() => setModal(null)}>
          <img
            className="pf-sample-large"
            src={`/poster-styles/${styleInfo.image}`}
            alt={styleInfo.name + ' illustrative sample'}
          />
          <p>
            This sample shows a visual approach. Your poster uses your own business, offer and
            branding.
          </p>
        </Modal>
      )}
      {modal === 'prompt' && (
        <Modal title="Image prompt preview" close={() => setModal(null)}>
          <p>
            Read-only · This saved prompt is sent with your logo and selected references. Edit the
            brief to change it.
          </p>
          <pre className="image-prompt-content" tabIndex={0}>
            {(() => {
              try {
                return JSON.stringify(JSON.parse(c?.preparedPrompt?.prompt || '{}'), null, 2);
              } catch {
                return c?.preparedPrompt?.prompt;
              }
            })()}
          </pre>
        </Modal>
      )}
    </section>
  );
}
