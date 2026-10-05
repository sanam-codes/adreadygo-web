import { useState, type ReactNode, type FormEvent } from 'react';
import { LoaderCircle, Plus, ArrowUpRight } from 'lucide-react';
export function Button({
  children,
  onClick,
  type = 'button',
  variant = '',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button type={type} className={'button ' + variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Status({ value }: { value: unknown }) {
  const s = String(value || 'DRAFT');
  return <span className={'status ' + s.toLowerCase()}>{s.replaceAll('_', ' ')}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Plus size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" /> Loading workspace…
    </div>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div role={error ? 'alert' : 'status'} className={'notice ' + (error ? 'error' : '')}>
      {children}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="stat">
      <span>
        {label}
        <ArrowUpRight size={16} />
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function AsyncForm({
  children,
  onSubmit,
  submit = 'Save changes',
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  submit?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError('');
    try {
      await onSubmit(new FormData(form));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={send} className="form">
      {children}
      {error && <Notice error>{error}</Notice>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Working…' : submit}
      </Button>
    </form>
  );
}
