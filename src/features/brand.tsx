import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, money, type Row } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Field, AsyncForm, Loading, Notice, Empty } from '../components/ui';
export function BrandPage() {
  const { base } = useWorkspace();
  const query = useQueryClient();
  const [saved, setSaved] = useState(false);
  const brand = useQuery({ queryKey: [base, 'brand'], queryFn: () => api<Row>(base + '/brand') });
  const assets = useQuery({
    queryKey: [base, 'assets'],
    queryFn: () => api<Row[]>(base + '/assets'),
  });
  if (brand.isLoading) return <Loading />;
  if (brand.error) return <Notice error>{brand.error.message}</Notice>;
  const b = brand.data!;
  return (
    <>
      <Heading
        eyebrow="YOUR BRAND, CONSISTENTLY"
        title="Make every ad feel like you."
        description="Give your workspace the facts, personality, and visual identity of your business."
      />
      <div className="grid two">
        <section className="panel">
          <h3>Brand essentials</h3>
          {saved && <Notice>Brand saved.</Notice>}
          <AsyncForm
            onSubmit={async (d) => {
              await api(base + '/brand', 'PUT', Object.fromEntries(d));
              setSaved(true);
              query.invalidateQueries({ queryKey: [base, 'brand'] });
            }}
          >
            <Field label="About your business">
              <textarea
                name="description"
                rows={4}
                defaultValue={String(b.description || '')}
                placeholder="What do you offer? What should customers know?"
              />
            </Field>
            <Field label="Brand voice">
              <input name="tone" defaultValue={String(b.tone || '')} />
            </Field>
            <div className="grid two">
              <Field label="Brand colour">
                <input
                  name="primaryColor"
                  type="color"
                  defaultValue={String(b.primaryColor || '#6d5efc')}
                />
              </Field>
              <Field label="Logo">
                <select name="logoAssetId" defaultValue={String(b.logoAssetId || '')}>
                  <option value="">No logo selected</option>
                  {assets.data?.map((a) => (
                    <option key={String(a.id)} value={String(a.id)}>
                      {String(a.filename)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Website">
              <input
                name="website"
                type="url"
                defaultValue={String(b.website || '')}
                placeholder="https://your-business.com"
              />
            </Field>
            <Field label="WhatsApp number (with country code)">
              <input
                name="whatsapp"
                defaultValue={String(b.whatsapp || '')}
                placeholder="919876543210"
              />
            </Field>
            <Field label="Approved facts and claims">
              <textarea
                name="facts"
                rows={3}
                defaultValue={String(b.facts || '')}
                placeholder="Only verified facts that can appear in your advertising."
              />
            </Field>
          </AsyncForm>
        </section>
        <section className="panel">
          <h3>Your asset library</h3>
          <p className="muted">Upload original logos and photos. PNG or JPEG, up to 10 MB.</p>
          <AsyncForm
            submit="Upload image"
            onSubmit={async (d) => {
              await api(base + '/assets', 'POST', d);
              query.invalidateQueries({ queryKey: [base, 'assets'] });
            }}
          >
            <Field label="Choose image">
              <input name="file" type="file" accept="image/png,image/jpeg" required />
            </Field>
          </AsyncForm>
          <div className="asset-grid">
            {assets.data?.map((a) => (
              <figure key={String(a.id)}>
                <img src={'/api' + base + '/assets/' + a.id} alt={String(a.filename)} />
                <figcaption>{String(a.filename)}</figcaption>
              </figure>
            ))}
          </div>
          {!assets.data?.length && (
            <Empty
              title="A home for your brand assets"
              description="Upload your logo first, then add product or service photos."
            />
          )}
        </section>
      </div>
    </>
  );
}
export function OffersPage() {
  const { base, business } = useWorkspace();
  const query = useQueryClient();
  const offers = useQuery({
    queryKey: [base, 'offers'],
    queryFn: () => api<Row[]>(base + '/offers'),
  });
  return (
    <>
      <Heading
        eyebrow="WHAT YOU’RE PROMOTING"
        title="Good offers. Great starting points."
        description="Save products, services, and packages to reuse in your campaigns."
      />
      <div className="grid two">
        <section className="panel">
          <h3>Add an offer</h3>
          <AsyncForm
            submit="Save offer"
            onSubmit={async (d) => {
              await api(base + '/offers', 'POST', {
                ...Object.fromEntries(d),
                price: Number(d.get('price')),
                directCost: d.get('directCost') ? Number(d.get('directCost')) : null,
              });
              query.invalidateQueries({ queryKey: [base, 'offers'] });
            }}
          >
            <Field label="Offer name">
              <input name="name" required maxLength={160} />
            </Field>
            <Field label="Description">
              <textarea name="description" rows={4} />
            </Field>
            <div className="grid two">
              <Field label={'Price · ' + business.currency}>
                <input name="price" type="number" min="0" step="0.01" required />
              </Field>
              <Field label="Direct cost (optional)">
                <input name="directCost" type="number" min="0" step="0.01" />
              </Field>
            </div>
          </AsyncForm>
        </section>
        <section className="panel">
          <h3>Saved offers</h3>
          {offers.error && <Notice error>{offers.error.message}</Notice>}
          {offers.data?.map((o) => (
            <div className="offer-row" key={String(o.id)}>
              <div>
                <strong>{String(o.name)}</strong>
                <p>{String(o.description)}</p>
              </div>
              <b>{money(o.price, business.currency)}</b>
            </div>
          ))}
          {!offers.data?.length && (
            <Empty
              title="What will you promote first?"
              description="Add an offer to give your campaigns a clear starting point."
            />
          )}
        </section>
      </div>
    </>
  );
}
