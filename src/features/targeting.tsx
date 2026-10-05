import { useState } from 'react';
import { api, type Row, type Content } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Field, Button, Notice } from '../components/ui';
export function TargetingFields({
  content,
  onChange,
}: {
  content: Content;
  onChange: (key: keyof Content, value: unknown) => void;
}) {
  const { base } = useWorkspace();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="grid two">
        <Field label="Minimum age">
          <input
            type="number"
            min="18"
            max="65"
            value={content.ageMin || 18}
            onChange={(e) => onChange('ageMin', Number(e.target.value))}
          />
        </Field>
        <Field label="Maximum age">
          <input
            type="number"
            min="18"
            max="65"
            value={content.ageMax || 65}
            onChange={(e) => onChange('ageMax', Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="City targeting (requires Meta authorization)">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cities, e.g. Mumbai"
        />
      </Field>
      <Button
        variant="secondary"
        disabled={busy || search.length < 2}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            setResults(
              await api<Row[]>(
                base +
                  '/meta/locations?q=' +
                  encodeURIComponent(search) +
                  '&country=' +
                  (content.targetCountry || 'IN'),
              ),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Searching…' : 'Find cities'}
      </Button>
      {error && <Notice error>{error}</Notice>}
      {results.slice(0, 8).map((r) => (
        <Button
          variant="ghost"
          key={String(r.key)}
          onClick={() => {
            const city = { key: String(r.key), name: String(r.name) };
            onChange('geoCities', [
              ...(content.geoCities || []).filter((c) => c.key !== city.key),
              city,
            ]);
            setResults([]);
          }}
        >
          Add {String(r.name)} · {String(r.region || r.country_name || '')}
        </Button>
      ))}
      {content.geoCities?.map((c) => (
        <div className="detail-row" key={c.key}>
          <span>{c.name} · 10 km radius</span>
          <Button
            variant="ghost"
            onClick={() =>
              onChange(
                'geoCities',
                content.geoCities?.filter((x) => x.key !== c.key),
              )
            }
          >
            Remove
          </Button>
        </div>
      ))}
      <p className="tiny muted">
        {content.geoCities?.length
          ? 'Delivery uses selected cities with a 10 km radius, subject to Meta eligibility.'
          : 'No cities selected: live delivery targets the entire selected country.'}{' '}
        Facebook and Instagram placements. Ages 18–65; Meta may apply account/objective
        restrictions.
      </p>
    </>
  );
}
