import test from 'node:test';
import assert from 'node:assert/strict';

import { readSupabaseConfig, sessionStorageKey, shippedConfig } from '../dist/src/supabase.js';
import { CONSENT_SOURCE, CONSENT_TEXT, consentRecord, hasOptedIn } from '../dist/src/consent.js';

test('an empty pair means no account service; a half-set pair is a mistake', () => {
  assert.equal(readSupabaseConfig({}), null);
  assert.equal(readSupabaseConfig({ url: '', publishableKey: ' ' }), null);
  assert.throws(() => readSupabaseConfig({ url: 'https://x.supabase.co' }), /both/);
  assert.throws(() => readSupabaseConfig({ publishableKey: 'sb_publishable_x' }), /both/);
});

test('plain http is only allowed for local development', () => {
  assert.throws(() => readSupabaseConfig({ url: 'http://x.supabase.co', publishableKey: 'sb_publishable_x' }), /HTTPS/);
  assert.deepEqual(
    readSupabaseConfig({ url: 'http://localhost:54321/', publishableKey: 'sb_publishable_x' }),
    { url: 'http://localhost:54321', publishableKey: 'sb_publishable_x' },
  );
  assert.throws(() => readSupabaseConfig({ url: 'not a url', publishableKey: 'sb_publishable_x' }), /valid URL/);
});

test('a secret key never reaches a browser bundle', () => {
  const url = 'https://x.supabase.co';
  assert.throws(() => readSupabaseConfig({ url, publishableKey: 'sb_secret_abc' }), /secret/);
  assert.throws(() => readSupabaseConfig({ url, publishableKey: 'service_role_key' }), /secret/);
  const serviceJwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('{"role":"service_role"}').toString('base64url')}.sig`;
  assert.throws(() => readSupabaseConfig({ url, publishableKey: serviceJwt }), /secret/);
  const anonJwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('{"role":"anon"}').toString('base64url')}.sig`;
  assert.equal(readSupabaseConfig({ url, publishableKey: anonJwt })?.publishableKey, anonJwt);
});

test('the shipped configuration is the shared project and its storage key follows the ref', () => {
  const config = shippedConfig();
  assert.ok(config);
  assert.match(config.url, /^https:\/\/[a-z]+\.supabase\.co$/);
  assert.match(config.publishableKey, /^sb_publishable_/);
  assert.equal(sessionStorageKey(config), `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`);
});

test('consent is recorded with its wording, time and source; opting out clears the time', () => {
  const at = new Date('2026-09-14T12:00:00Z');
  assert.deepEqual(consentRecord(true, at), {
    marketing_opt_in: true,
    marketing_opt_in_at: '2026-09-14T12:00:00.000Z',
    marketing_source: CONSENT_SOURCE,
    marketing_consent_text: CONSENT_TEXT,
  });
  assert.equal(consentRecord(false, at).marketing_opt_in_at, null);
  assert.equal(CONSENT_SOURCE, 'cropasap');
  assert.match(CONSENT_TEXT, /Get updates on new Strange Systems apps/);
});

test('an opt-in is read from metadata written by any sibling app', () => {
  assert.equal(hasOptedIn({ marketing_opt_in: true }), true);
  assert.equal(hasOptedIn({ marketing_opt_in: 'true' }), true);
  assert.equal(hasOptedIn({ marketing_opt_in: false }), false);
  assert.equal(hasOptedIn({}), false);
  assert.equal(hasOptedIn(null), false);
});

test('a broken emailed link is explained in plain words, from the query or the hash', async () => {
  const { linkProblem, withoutLinkProblem } = await import('../dist/src/account.js');
  const expired = 'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  assert.match(linkProblem(`?${expired}`, ''), /already used or has expired.*sign in with your password/);
  assert.match(linkProblem('', `#${expired}`), /already used or has expired/);
  assert.match(linkProblem('?error=server_error&error_code=unexpected_failure', ''), /could not be used/);
  assert.equal(linkProblem('', ''), null);
  assert.equal(linkProblem('?code=abc', '#access_token=x'), null);
  assert.deepEqual(withoutLinkProblem(`?${expired}`, `#${expired}`), { search: '', hash: '' });
  assert.deepEqual(withoutLinkProblem('?keep=1&error_code=otp_expired', '#type=recovery&error=x'), { search: '?keep=1', hash: '#type=recovery' });
});
