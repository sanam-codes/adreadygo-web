import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Layers,
  ChartNoAxesCombined,
  Building2,
  FileText,
  Palette,
  Tag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Phone,
  Globe,
  MapPin,
} from 'lucide-react';
import { api, clearCsrf } from '../lib/api';
import { AsyncForm, Field, Notice, Button } from '../components/ui';

export function AuthPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [accepted, setAccepted] = useState(false);
  const query = useQueryClient();

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link to="/" className="logo">
          <span>
            <Sparkles size={21} />
          </span>
          AdReadyGo<span className="logo-dot">.</span>
        </Link>
        <div>
          <div className="eyebrow">SMALL BUSINESS. BIG POSSIBILITIES.</div>
          <h1>
            Your next
            <br />
            great campaign
            <br />
            <em>starts here.</em>
          </h1>
          <p>
            One place to turn your ideas into beautiful ads, launch with confidence, and see what’s
            working.
          </p>
          <div className="auth-features">
            <span>
              <Layers />
              Create with your brand
            </span>
            <span>
              <ChartNoAxesCombined />
              Connect effort to results
            </span>
          </div>
        </div>
        <small>Made for businesses ready for their next chapter.</small>
      </section>
      <section className="auth-form">
        <span className="pill">INVITE-ONLY PREVIEW</span>
        <h2>{token && !accepted ? 'Your workspace is waiting.' : 'Welcome back.'}</h2>
        <p>
          {token && !accepted
            ? 'Accept your invitation and start creating.'
            : 'Sign in to your marketing workspace.'}
        </p>
        {accepted && <Notice>Account created. Sign in with your email and password.</Notice>}
        <AsyncForm
          submit={token && !accepted ? 'Accept invitation' : 'Sign in →'}
          onSubmit={async (d) => {
            if (token && !accepted) {
              await api('/auth/accept-invite', 'POST', {
                token,
                name: d.get('name'),
                password: d.get('password'),
              });
              setAccepted(true);
            } else {
              await api('/auth/login', 'POST', {
                email: d.get('email'),
                password: d.get('password'),
              });
              clearCsrf();
              await query.invalidateQueries({ queryKey: ['profile'] });
              if (token) window.location.assign('/');
            }
          }}
        >
          {token && !accepted ? (
            <Field label="Your name">
              <input name="name" required autoComplete="name" />
            </Field>
          ) : (
            <Field label="Email address">
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </Field>
          )}
          <Field label="Password">
            <input
              name="password"
              type="password"
              required
              minLength={token && !accepted ? 12 : 1}
              maxLength={72}
              autoComplete={token && !accepted ? 'new-password' : 'current-password'}
            />
          </Field>
        </AsyncForm>
        <p className="muted tiny">
          Local pilot: ask your owner for access. Initial owner credentials are configured on the
          backend.
        </p>
        <Link className="text-link" to="/reset">
          Forgot password?
        </Link>
        <div className="auth-foot">
          <ArrowRight size={16} /> Your ideas. Your brand. Your control.
        </div>
      </section>
    </main>
  );
}

export function Onboarding() {
  const query = useQueryClient();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Essentials
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('IN');
  const [whatsapp, setWhatsapp] = useState('');

  // Step 2: Context
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [usp, setUsp] = useState('');
  const [website, setWebsite] = useState('');

  // Step 3: Brand
  const [primaryColor, setPrimaryColor] = useState('#6d5efc');
  const [accentColor, setAccentColor] = useState('#059669');
  const [tone, setTone] = useState('Clear, warm and confident');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Step 4: Offer
  const [offerName, setOfferName] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [offerPrice, setOfferPrice] = useState('999');
  const [offerCost, setOfferCost] = useState('350');

  const tonePresets = [
    'Clear, warm and confident',
    'High energy, promotional & urgent',
    'Clinical, professional & trustworthy',
    'Friendly, conversational & local',
    'Premium, elegant & sophisticated',
  ];

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  }

  async function handleComplete() {
    setBusy(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        industry: industry.trim(),
        currency,
        timezone,
        city: city.trim(),
        country,
        whatsapp: whatsapp.trim(),
        website: website.trim(),
        description: description.trim(),
        targetAudience: targetAudience.trim(),
        usp: usp.trim(),
        primaryColor,
        accentColor,
        tone,
      };

      if (offerName.trim() && offerPrice) {
        payload.offerName = offerName.trim();
        payload.offerDescription = offerDescription.trim();
        payload.offerPrice = Number(offerPrice);
        if (offerCost) payload.offerCost = Number(offerCost);
      }

      const res = await api<{ id: string }>('/businesses', 'POST', payload);
      const businessId = res.id;

      if (logoFile) {
        const upload = new FormData();
        upload.append('file', logoFile);
        const assetRes = await api<{ id: string }>(
          `/businesses/${businessId}/assets`,
          'POST',
          upload,
        );
        await api(`/businesses/${businessId}/brand`, 'PUT', {
          ...payload,
          businessName: name,
          logoAssetId: assetRes.id,
          profileReviewed: true,
        });
      }

      await query.invalidateQueries({ queryKey: ['profile'] });
    } catch (e) {
      setError((e as Error).message || 'Failed to complete setup');
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { num: 1, label: 'Essentials', icon: Building2 },
    { num: 2, label: 'Business Context', icon: FileText },
    { num: 3, label: 'Brand & Logo', icon: Palette },
    { num: 4, label: 'Primary Offer', icon: Tag },
    { num: 5, label: 'Review & Launch', icon: CheckCircle2 },
  ];

  return (
    <div className="onboarding-stepper-wrap">
      <div className="onboarding-card">
        {/* Stepper Header */}
        <div className="stepper-header">
          <div className="stepper-brand">
            <Sparkles size={20} className="brand-sparkle" />
            <span>AdReadyGo Workspace Setup</span>
          </div>
          <div className="stepper-nav">
            {steps.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <div
                  key={s.num}
                  className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                  onClick={() => s.num < step && setStep(s.num)}
                >
                  <div className="step-circle">
                    {isDone ? <CheckCircle2 size={16} /> : <Icon size={15} />}
                  </div>
                  <span className="step-label">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {error && <Notice error>{error}</Notice>}

        {/* STEP 1: ESSENTIALS */}
        {step === 1 && (
          <div className="step-content">
            <span className="pill">STEP 1 OF 5 · BUSINESS ESSENTIALS</span>
            <h2>Let’s set up your business workspace.</h2>
            <p className="step-desc">
              These core details establish your local operating currency and ad destination.
            </p>

            <div className="form-stack">
              <Field label="Business name *">
                <input
                  required
                  placeholder="e.g. OZO Diagnostics, GreenLeaf Cafe, Peak Fitness"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={160}
                />
              </Field>

              <Field label="Industry or category *">
                <input
                  required
                  placeholder="e.g. Diagnostic Healthcare, Retail Bakery, Dental Clinic"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  maxLength={100}
                />
              </Field>

              <div className="grid two">
                <Field label="Billing / Ad Currency">
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="AED">AED (د.إ) - UAE Dirham</option>
                    <option value="CAD">CAD ($) - Canadian Dollar</option>
                    <option value="AUD">AUD ($) - Australian Dollar</option>
                    <option value="SGD">SGD ($) - Singapore Dollar</option>
                  </select>
                </Field>
                <Field label="Timezone">
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="UTC">UTC (Universal)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +4)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT +8)</option>
                  </select>
                </Field>
              </div>

              <div className="grid two">
                <Field label="Operating city / region">
                  <div className="input-with-icon">
                    <MapPin size={16} />
                    <input
                      placeholder="e.g. Bengaluru, Mumbai, London"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </Field>
                <Field label="Country code">
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="IN">India (IN)</option>
                    <option value="US">United States (US)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="AE">United Arab Emirates (AE)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="AU">Australia (AU)</option>
                    <option value="SG">Singapore (SG)</option>
                  </select>
                </Field>
              </div>

              <Field label="Business WhatsApp Number (Target Ad Destination)">
                <div className="input-with-icon">
                  <Phone size={16} />
                  <input
                    placeholder="+91 98765 43210 (include country code)"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </div>
                <small className="muted tiny">
                  Meta click-to-WhatsApp ads will send leads directly to this number.
                </small>
              </Field>
            </div>

            <div className="step-actions right">
              <Button disabled={!name.trim() || !industry.trim()} onClick={() => setStep(2)}>
                Continue to Business Context <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: BUSINESS CONTEXT */}
        {step === 2 && (
          <div className="step-content">
            <span className="pill">STEP 2 OF 5 · BUSINESS CONTEXT</span>
            <h2>Teach the AI about your business.</h2>
            <p className="step-desc">
              This is the foundational brain used whenever you create new campaigns, ad copy, and
              visuals.
            </p>

            <div className="form-stack">
              <Field label="What does your business do? (Plain-language description) *">
                <textarea
                  rows={4}
                  placeholder="e.g. We provide preventive diagnostic pathology health packages with 60-minute doorstep sample collection and same-day digital lab reports."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </Field>

              <Field label="Who is your target audience / ideal customer?">
                <textarea
                  rows={3}
                  placeholder="e.g. Health-conscious adults aged 28–55, working corporate professionals, and families looking for regular preventive health checks."
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </Field>

              <Field label="Key Value Proposition / USPs (Why choose you?)">
                <textarea
                  rows={3}
                  placeholder="e.g. 100% NABL accredited labs, painless barcode-tracked sample collection, reports on WhatsApp within 8 hours, 4.9-star rating."
                  value={usp}
                  onChange={(e) => setUsp(e.target.value)}
                />
              </Field>

              <Field label="Website URL (optional)">
                <div className="input-with-icon">
                  <Globe size={16} />
                  <input
                    type="url"
                    placeholder="https://yourbusiness.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <div className="step-actions between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Back
              </Button>
              <Button disabled={!description.trim()} onClick={() => setStep(3)}>
                Continue to Brand & Logo <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: BRAND IDENTITY */}
        {step === 3 && (
          <div className="step-content">
            <span className="pill">STEP 3 OF 5 · BRAND IDENTITY</span>
            <h2>Your brand colors, logo & voice.</h2>
            <p className="step-desc">
              Every generated ad poster, color palette, and copy headline adheres to these
              guidelines.
            </p>

            <div className="form-stack">
              <div className="logo-upload-card">
                <div className="logo-preview-box">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="logo-preview-img" />
                  ) : (
                    <div className="logo-placeholder">
                      <Upload size={28} />
                      <span>Upload Logo</span>
                    </div>
                  )}
                </div>
                <div className="logo-upload-meta">
                  <label className="button secondary file-btn">
                    <Upload size={16} /> Choose PNG or JPEG Logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleLogoChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <p className="tiny muted">
                    High-res logo with transparent background recommended.
                  </p>
                </div>
              </div>

              <div className="grid two">
                <Field label="Primary brand color">
                  <div className="color-field-wrap">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      maxLength={7}
                    />
                  </div>
                </Field>

                <Field label="Secondary accent color">
                  <div className="color-field-wrap">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      maxLength={7}
                    />
                  </div>
                </Field>
              </div>

              <Field label="Brand voice & tone">
                <div className="tone-pills">
                  {tonePresets.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`tone-pill ${tone === t ? 'active' : ''}`}
                      onClick={() => setTone(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Or type a custom tone..."
                  className="mt-2"
                />
              </Field>
            </div>

            <div className="step-actions between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                <ChevronLeft size={16} /> Back
              </Button>
              <Button onClick={() => setStep(4)}>
                Continue to Primary Offer <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: PRIMARY OFFER */}
        {step === 4 && (
          <div className="step-content">
            <span className="pill">STEP 4 OF 5 · FIRST OFFER / PRODUCT</span>
            <h2>What is your primary promotional offer?</h2>
            <p className="step-desc">
              Having at least one strong offer lets you launch high-converting Meta campaigns
              immediately.
            </p>

            <div className="form-stack">
              <Field label="Offer / Package name *">
                <input
                  placeholder="e.g. Comprehensive Full Body Checkup (84 Tests)"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                />
              </Field>

              <Field label="Offer details / What's included">
                <textarea
                  rows={3}
                  placeholder="e.g. CBC, Liver Function, Kidney Function, Thyroid Profile, Lipid Profile, Blood Sugar, and Free Doctor Consultation."
                  value={offerDescription}
                  onChange={(e) => setOfferDescription(e.target.value)}
                />
              </Field>

              <div className="grid two">
                <Field label={`Offer price (${currency}) *`}>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 999"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                  />
                </Field>
                <Field label={`Direct fulfillment cost (${currency})`}>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 350"
                    value={offerCost}
                    onChange={(e) => setOfferCost(e.target.value)}
                  />
                  <small className="tiny muted">
                    Used to calculate Contribution Margin before ad spend.
                  </small>
                </Field>
              </div>
            </div>

            <div className="step-actions between">
              <Button variant="secondary" onClick={() => setStep(3)}>
                <ChevronLeft size={16} /> Back
              </Button>
              <Button onClick={() => setStep(5)}>
                Review Summary <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & LAUNCH */}
        {step === 5 && (
          <div className="step-content">
            <span className="pill">STEP 5 OF 5 · READINESS SUMMARY</span>
            <h2>You’re all set to launch.</h2>
            <p className="step-desc">
              Here is everything configured for your AI marketing workspace. Review and start
              creating.
            </p>

            <div className="summary-cards-grid">
              <div className="summary-card">
                <div className="summary-card-top">
                  <strong>Business & Essentials</strong>
                  <button className="text-link" onClick={() => setStep(1)}>
                    Edit
                  </button>
                </div>
                <p>
                  <strong>{name}</strong> · {industry}
                </p>
                <p className="muted tiny">
                  {city ? `${city}, ` : ''}
                  {country} · {currency} ({timezone})
                </p>
                {whatsapp && (
                  <p className="tiny">
                    <Phone size={13} /> WhatsApp: {whatsapp}
                  </p>
                )}
              </div>

              <div className="summary-card">
                <div className="summary-card-top">
                  <strong>Core Context</strong>
                  <button className="text-link" onClick={() => setStep(2)}>
                    Edit
                  </button>
                </div>
                <p className="tiny summary-text-truncate">{description}</p>
                {targetAudience && <p className="tiny muted">Audience: {targetAudience}</p>}
              </div>

              <div className="summary-card">
                <div className="summary-card-top">
                  <strong>Brand Identity</strong>
                  <button className="text-link" onClick={() => setStep(3)}>
                    Edit
                  </button>
                </div>
                <div className="summary-brand-row">
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo" className="summary-mini-logo" />
                  )}
                  <div className="color-swatches">
                    <span className="swatch" style={{ background: primaryColor }} title="Primary" />
                    <span className="swatch" style={{ background: accentColor }} title="Accent" />
                  </div>
                </div>
                <p className="tiny muted mt-1">Tone: {tone}</p>
              </div>

              <div className="summary-card">
                <div className="summary-card-top">
                  <strong>Promotional Offer</strong>
                  <button className="text-link" onClick={() => setStep(4)}>
                    Edit
                  </button>
                </div>
                {offerName ? (
                  <>
                    <p>
                      <strong>{offerName}</strong>
                    </p>
                    <p className="tiny font-mono">
                      Price: {currency} {offerPrice}
                    </p>
                  </>
                ) : (
                  <p className="tiny muted">No initial offer configured (you can add one later).</p>
                )}
              </div>
            </div>

            <div className="step-actions between mt-6">
              <Button variant="secondary" onClick={() => setStep(4)} disabled={busy}>
                <ChevronLeft size={16} /> Back
              </Button>
              <Button onClick={handleComplete} disabled={busy}>
                {busy ? 'Setting up workspace…' : 'Launch Workspace & Start Campaign →'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
