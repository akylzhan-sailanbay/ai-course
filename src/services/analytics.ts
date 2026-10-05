import type { Lead } from '../db/leads';
import { insertEvent } from '../db/stats';
import type { AppContext } from './context';

/**
 * Server-side funnel events. Always written to our own DB (source of truth, unaffected by ad blockers);
 * forwarded to PostHog when configured so web + bot steps form one funnel per person.
 */
export function track(
  ctx: AppContext,
  name: string,
  opts: { lead?: Lead; anonId?: string | null; props?: Record<string, unknown>; path?: string | null } = {},
) {
  const { lead, props = {} } = opts;
  const ts = ctx.clock().toISOString();
  const anonId = opts.anonId ?? lead?.anon_id ?? null;
  insertEvent(ctx.db, {
    ts,
    name,
    anonId,
    leadId: lead?.id ?? null,
    src: lead?.src ?? null,
    med: lead?.med ?? null,
    cmp: lead?.cmp ?? null,
    path: opts.path ?? null,
    props,
  });

  const key = ctx.env.POSTHOG_KEY;
  if (!key) return;
  const distinctId = anonId ?? (lead ? `lead_${lead.id}` : null);
  if (!distinctId) return;
  const body = {
    api_key: key,
    event: name,
    distinct_id: distinctId,
    timestamp: ts,
    properties: {
      ...props,
      lead_id: lead?.id,
      tier: lead?.tier,
      utm_source: lead?.src,
      utm_medium: lead?.med,
      utm_campaign: lead?.cmp,
      channel: lead?.channel,
      $lib: 'server',
    },
  };
  ctx
    .fetch(`${ctx.env.POSTHOG_HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })
    .catch((err: unknown) => ctx.log.warn('posthog capture failed', { name, err: String(err) }));
}
