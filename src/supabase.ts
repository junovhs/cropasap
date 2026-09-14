// The account service.
//
// One Supabase project serves every Strange Systems app, so an account made
// here signs in to No Ceremony and AIfoodpal too, and one contact list covers
// all of them. The URL and publishable key below are the browser-safe pair
// that project hands out; a build can override them through SUPABASE_URL and
// SUPABASE_PUBLISHABLE_KEY (see scripts/build-static.mjs). Nothing here runs
// for a guest: the client is created on demand by account.ts.

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

const DEFAULTS = {
  url: 'https://fhedwkbaujiivemneefg.supabase.co',
  publishableKey: 'sb_publishable_rxiiV2EZyf0yqFfkcrj7DQ_bcoaOpkQ',
};

// Injected by esbuild at build time; absent (undefined) under tsc and in tests.
declare const __SUPABASE_URL__: string | undefined;
declare const __SUPABASE_PUBLISHABLE_KEY__: string | undefined;

const allowedUrl = (url: URL): boolean =>
  url.protocol === 'https:'
  || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));

const jwtRole = (key: string): string | null => {
  const payload = key.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const value = JSON.parse(atob(base64)) as { role?: unknown };
    return typeof value.role === 'string' ? value.role : null;
  } catch {
    return null;
  }
};

/**
 * Validate a URL and key pair. Empty means "no account service" (null);
 * half-set, plain-http or secret keys are configuration mistakes and throw,
 * because a secret key in a browser bundle is the one thing this must never
 * quietly accept.
 */
export function readSupabaseConfig(env: { url?: unknown; publishableKey?: unknown }): SupabaseConfig | null {
  const urlValue = String(env.url ?? '').trim();
  const publishableKey = String(env.publishableKey ?? '').trim();
  if (!urlValue && !publishableKey) return null;
  if (!urlValue || !publishableKey) {
    throw new Error('Supabase needs both a URL and a publishable key.');
  }
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error('The Supabase URL is not a valid URL.');
  }
  if (!allowedUrl(url)) throw new Error('The Supabase URL must use HTTPS outside local development.');
  if (
    /service[_-]?role/i.test(publishableKey)
    || publishableKey.startsWith('sb_secret_')
    || jwtRole(publishableKey) === 'service_role'
  ) {
    throw new Error('Use a browser publishable key, never a Supabase secret key.');
  }
  return { url: url.href.replace(/\/$/, ''), publishableKey };
}

/** The configuration this build ships with: the override if set, else the shared project. */
export function shippedConfig(): SupabaseConfig | null {
  const url = typeof __SUPABASE_URL__ === 'string' && __SUPABASE_URL__ ? __SUPABASE_URL__ : DEFAULTS.url;
  const publishableKey = typeof __SUPABASE_PUBLISHABLE_KEY__ === 'string' && __SUPABASE_PUBLISHABLE_KEY__
    ? __SUPABASE_PUBLISHABLE_KEY__
    : DEFAULTS.publishableKey;
  return readSupabaseConfig({ url, publishableKey });
}

/** Where supabase-js keeps a session, so a guest page can tell it has none without loading the library. */
export function sessionStorageKey(config: SupabaseConfig): string {
  const ref = new URL(config.url).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

export function hasStoredSession(config: SupabaseConfig): boolean {
  try {
    return localStorage.getItem(sessionStorageKey(config)) !== null;
  } catch {
    return false;
  }
}

/**
 * The client, loaded only when there is a reason to: a stored session, or a
 * click on Sign in. The library is split into its own chunk by the bundler,
 * so a guest never downloads it and the page makes no request on their behalf.
 */
export async function loadClient(config: SupabaseConfig) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', persistSession: true },
  });
}

export type Client = Awaited<ReturnType<typeof loadClient>>;
