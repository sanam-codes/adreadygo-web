import { money } from '../lib/api';
export type OutcomeMetrics = Record<string, number | null> & { actions?: Record<string, number> };
export type OutcomeKind =
  | 'messages'
  | 'installs'
  | 'purchases'
  | 'leads'
  | 'appRegistrations'
  | 'pixelRegistrations'
  | 'linkClicks';
export const outcomeLabels: Record<OutcomeKind, string> = {
  messages: 'Conversations',
  installs: 'App installs',
  purchases: 'Purchases',
  leads: 'Leads',
  appRegistrations: 'App registrations',
  pixelRegistrations: 'Website registrations',
  linkClicks: 'Link clicks',
};
export type OutcomeEntity = {
  id: string;
  campaign_id?: string;
  adset_id?: string;
  objective?: string;
  destination_type?: string;
  optimization_goal?: string;
  metrics: OutcomeMetrics;
  previous?: OutcomeMetrics;
};
const actionKeys = {
  leads: 'lead',
  appRegistrations: 'app_custom_event.fb_mobile_complete_registration',
  pixelRegistrations: 'offsite_conversion.fb_pixel_complete_registration',
};
export function outcomeCount(m: OutcomeMetrics | undefined, k: OutcomeKind): number {
  if (!m) return 0;
  if (k === 'linkClicks') return Number(m.inline_link_clicks || 0);
  if (k in actionKeys) return Number(m.actions?.[actionKeys[k as keyof typeof actionKeys]] || 0);
  return Number(m[k] || 0);
}
export function outcomeCost(m: OutcomeMetrics | undefined, k: OutcomeKind) {
  const count = outcomeCount(m, k);
  return count ? Number(m?.spend || 0) / count : null;
}
export function primaryOutcome(e: OutcomeEntity): OutcomeKind {
  const t =
    `${e.objective || ''} ${e.destination_type || ''} ${e.optimization_goal || ''}`.toUpperCase();
  if (/WHATSAPP|MESSENGER|INSTAGRAM_DIRECT|CONVERSATION|MESSAGES/.test(t)) return 'messages';
  if (/COMPLETE_REGISTRATION|REGISTRATION/.test(t))
    return /APP/.test(t) ? 'appRegistrations' : 'pixelRegistrations';
  if (/APP_PROMOTION|APP_INSTALL|MOBILE_APP/.test(t)) return 'installs';
  if (/SALES|PURCHASE/.test(t)) return 'purchases';
  if (/TRAFFIC|LINK_CLICK/.test(t)) return 'linkClicks';
  if (/LEADS|LEAD_GENERATION/.test(t))
    return outcomeCount(e.metrics, 'messages') || outcomeCount(e.previous, 'messages')
      ? 'messages'
      : 'leads';
  const kinds: OutcomeKind[] = [
    'messages',
    'installs',
    'purchases',
    'leads',
    'appRegistrations',
    'pixelRegistrations',
  ];
  return (
    kinds.find((k) => outcomeCount(e.metrics, k) > 0 || outcomeCount(e.previous, k) > 0) ||
    'linkClicks'
  );
}
export function entityOutcomes(
  e: OutcomeEntity,
  levels: { campaign: OutcomeEntity[]; adset: OutcomeEntity[]; ad: OutcomeEntity[] },
): OutcomeKind[] {
  const c = levels.campaign.find((x) => x.id === e.campaign_id);
  const a = levels.adset.find((x) => x.id === (e.adset_id || e.id));
  const inherited = {
    ...c,
    ...a,
    ...e,
    objective: e.objective || c?.objective,
    destination_type: e.destination_type || a?.destination_type,
    optimization_goal: e.optimization_goal || a?.optimization_goal,
  };
  const children = levels.adset.filter((x) => x.campaign_id === e.id);
  // Distinct ad-set goals are shown separately for mixed campaigns, never added into one result.
  const kinds = children.length
    ? children.map((x) =>
        primaryOutcome({ ...c, ...e, ...x, objective: x.objective || e.objective }),
      )
    : [primaryOutcome(inherited)];
  return [...new Set(kinds)];
}
export function entityOutcomeMetrics(
  e: OutcomeEntity,
  levels: { campaign: OutcomeEntity[]; adset: OutcomeEntity[]; ad: OutcomeEntity[] },
  kind: OutcomeKind,
  previous = false,
): OutcomeMetrics {
  if (entityOutcomes(e, levels).length < 2) return (previous ? e.previous : e.metrics) || {};
  const children = levels.adset.filter(
    (x) =>
      x.campaign_id === e.id &&
      primaryOutcome({ ...e, ...x, objective: x.objective || e.objective }) === kind,
  );
  const actions: Record<string, number> = {};
  let spend = 0,
    count = 0;
  for (const child of children) {
    const m = (previous ? child.previous : child.metrics) || {};
    spend += Number(m.spend || 0);
    count += outcomeCount(m, kind);
    for (const [key, value] of Object.entries(m.actions || {}))
      actions[key] = (actions[key] || 0) + value;
  }
  // Only the spend belonging to this goal is used for a mixed campaign's cost.
  return {
    spend,
    [kind === 'linkClicks' ? 'inline_link_clicks' : kind]: count,
    actions,
  } as OutcomeMetrics;
}
export function observedOutcomes(m: OutcomeMetrics): OutcomeKind[] {
  const kinds: OutcomeKind[] = [
    'messages',
    'installs',
    'purchases',
    'leads',
    'appRegistrations',
    'pixelRegistrations',
  ];
  const found = kinds.filter((k) => outcomeCount(m, k) > 0);
  return found.length ? found : ['messages'];
}
export function OutcomeValues({
  metrics,
  previous,
  kinds,
  currency,
  mode = 'result',
  byKind,
  previousByKind,
}: {
  metrics: OutcomeMetrics;
  previous?: OutcomeMetrics;
  kinds: OutcomeKind[];
  currency: string;
  mode?: 'result' | 'cost' | 'previousCost' | 'change';
  byKind?: (kind: OutcomeKind) => OutcomeMetrics;
  previousByKind?: (kind: OutcomeKind) => OutcomeMetrics;
}) {
  return (
    <span className="meta-outcome-values">
      {kinds.map((k) => {
        const currentMetrics = byKind ? byKind(k) : metrics;
        const previousMetrics = previousByKind ? previousByKind(k) : previous;
        const now = outcomeCost(currentMetrics, k),
          before = outcomeCost(previousMetrics, k);
        let text = outcomeCount(currentMetrics, k).toLocaleString('en-IN');
        if (mode === 'cost' || mode === 'previousCost') {
          const v = mode === 'cost' ? now : before;
          text = v == null ? '—' : money(v, currency, 2);
        }
        if (mode === 'change')
          text =
            now == null || !before
              ? 'No baseline'
              : `${now > before ? '+' : ''}${(((now - before) / before) * 100).toFixed(1)}%`;
        return (
          <span key={k}>
            <strong>{text}</strong>
            <small>{outcomeLabels[k]}</small>
          </span>
        );
      })}
    </span>
  );
}
