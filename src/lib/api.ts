export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let csrf: { token: string; headerName: string } | undefined;
export async function api<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  if (method !== 'GET' && !csrf) {
    const r = await fetch('/api/auth/csrf', { credentials: 'include' });
    csrf = await r.json();
  }
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrf) headers[csrf.headerName] = csrf.token;
  const r = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  if (!r.ok) {
    const error = await r
      .json()
      .catch(() => ({ message: 'Server unavailable. Check that the backend is running.' }));
    if (r.status === 403) csrf = undefined;
    throw new ApiError(error.message || 'Request failed', r.status);
  }
  if (r.status === 204) return undefined as T;
  const text = await r.text();
  return text ? JSON.parse(text) : (undefined as T);
}
export function clearCsrf() {
  csrf = undefined;
}
export type Row = Record<string, unknown>;
export type Business = {
  id: string;
  name: string;
  industry: string;
  currency: string;
  timezone: string;
  role: 'OWNER' | 'MARKETER';
};
export type Profile = {
  user: { id: string; email: string; display_name: string };
  businesses: Business[];
};
export type Card = {
  title: string;
  subtitle: string;
  price: string;
  cta: string;
  backgroundColor: string;
  textColor: string;
  backgroundAssetId: string;
  logoAssetId: string;
  fontSize: number;
  textY: number;
};
export type Content = {
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  dailyBudget: number;
  location: string;
  startDate: string;
  endDate: string;
  whatsapp: string;
  format: 'square' | 'portrait' | 'story';
  targetCountry?: string;
  geoCities?: { key: string; name: string }[];
  ageMin?: number;
  ageMax?: number;
  renderedAssetIds?: string[];
  cards: Card[];
  studioProjectId?: string;
  selectedAssetId?: string;
  developmentContent?: boolean;
};
export type Campaign = {
  id: string;
  name: string;
  revision: number;
  review_state: string;
  delivery_state: string;
  approved_revision?: number;
  applied_budget?: number;
  provider_id?: string;
  content: Content;
  updated_at: string;
};
export const emptyCard = (): Card => ({
  title: 'Your next great offer',
  subtitle: 'Make something worth sharing.',
  price: '',
  cta: 'Chat with us',
  backgroundColor: '#6d5efc',
  textColor: '#ffffff',
  backgroundAssetId: '',
  logoAssetId: '',
  fontSize: 64,
  textY: 32,
});
export const emptyContent = (): Content => ({
  headline: '',
  primaryText: '',
  description: '',
  cta: 'WHATSAPP_MESSAGE',
  dailyBudget: 300,
  location: '',
  startDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10),
  whatsapp: '',
  format: 'square',
  targetCountry: 'IN',
  cards: [emptyCard()],
});
export const money = (value: unknown, currency = 'INR', fractionDigits = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));
