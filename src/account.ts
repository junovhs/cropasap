// The optional account.
//
// Cropping never asks for one (DEC-05). An account is for people who want the
// sizes they saved to be there on the next machine, and — separately, with its
// own unchecked box — for people who want to hear about the next app. The
// account service (Supabase) is loaded only when it is needed: a session in
// storage, a sign-in link in the URL, or a click on the button. A guest page
// makes no request.

import type { Session } from '@supabase/supabase-js';
import { requiredElement } from './infrastructure/dom.js';
import { consentRecord, hasOptedIn } from './consent.js';
import { hasStoredSession, loadClient, shippedConfig, type Client, type SupabaseConfig } from './supabase.js';

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'new-password' | 'home';

export interface AccountController {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** The current session, or null for a guest. */
  session(): Session | null;
  /** The loaded client, or null until an account matters. */
  client(): Client | null;
}

export interface AccountOptions {
  /** Called on every sign-in and sign-out, including the restored one at load. */
  onSession?: (session: Session | null, client: Client) => void;
  announce?: (message: string) => void;
}

/** A sign-in or recovery link lands here with tokens the client must read. */
function urlCarriesAuth(): boolean {
  const { hash, search } = location;
  return /access_token=|refresh_token=|type=recovery|error_description=/.test(hash)
    || /[?&]code=/.test(search);
}

const $ = <T extends Element = HTMLElement>(selector: string): T => requiredElement<T>(selector);

/** The few sign-up refusals a person can act on, in their words rather than the API's. */
function signUpProblem(error: { code?: string; message: string }): string {
  switch (error.code) {
    case 'email_address_invalid': return 'That email address was not accepted. Check it for typos.';
    case 'user_already_exists':
    case 'email_exists': return 'There is already an account for that email. Sign in instead.';
    case 'weak_password': return `That password is too weak. ${error.message}`;
    case 'over_email_send_rate_limit': return 'Too many sign-ups from here just now. Try again in a few minutes.';
    default: return 'Could not create the account. Check the details and try again.';
  }
}

export function createAccount(options: AccountOptions = {}): AccountController {
  const root = $('#account');
  const trigger = $<HTMLButtonElement>('#accountOpen');
  const triggerLabel = $('#accountOpenLabel');
  const title = $('#accountTitle');
  const notice = $('#accountNotice');
  const forms: Record<Mode, HTMLElement> = {
    'sign-in': $('#accountSignIn'),
    'sign-up': $('#accountSignUp'),
    forgot: $('#accountForgot'),
    'new-password': $('#accountNewPassword'),
    home: $('#accountHome'),
  };
  const titles: Record<Mode, string> = {
    'sign-in': 'Sign in',
    'sign-up': 'Create a free account',
    forgot: 'Reset your password',
    'new-password': 'New password',
    home: 'Your account',
  };
  const email = $('#accountEmail');
  const homeConsent = $<HTMLInputElement>('#homeConsent');
  const signUpConsent = $<HTMLInputElement>('#signUpConsent');

  let config: SupabaseConfig | null = null;
  try {
    config = shippedConfig();
  } catch (error) {
    console.error('[account]', error);
  }

  let client: Client | null = null;
  let loading: Promise<Client> | null = null;
  let session: Session | null = null;
  let mode: Mode = 'sign-in';
  let busy = false;
  let returnFocus: HTMLElement | null = null;

  // No service, no button: the app is complete without it.
  if (!config) return { open() {}, close() {}, isOpen: () => false, session: () => null, client: () => null };
  const service = config;
  trigger.hidden = false;

  const say = (message: string, error = false): void => {
    notice.textContent = message;
    notice.hidden = !message;
    notice.classList.toggle('is-error', error);
  };

  const setBusy = (value: boolean): void => {
    busy = value;
    for (const control of root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')) {
      if (control === $('#accountClose')) continue;
      control.disabled = value;
    }
  };

  const show = (next: Mode): void => {
    mode = next;
    title.textContent = titles[next];
    for (const [name, form] of Object.entries(forms)) form.hidden = name !== next;
    if (next === 'home' && session) {
      email.textContent = session.user.email ?? 'Signed in';
      homeConsent.checked = hasOptedIn(session.user.user_metadata);
    }
    const first = forms[next].querySelector<HTMLElement>('input:not([type=checkbox]), button');
    first?.focus();
  };

  const renderTrigger = (): void => {
    const address = session?.user.email;
    triggerLabel.textContent = address ? address.split('@')[0] ?? address : 'Sign in';
    trigger.title = address ?? 'Sign in or create an account';
    trigger.classList.toggle('is-signed-in', Boolean(address));
  };

  const ensureClient = (): Promise<Client> => {
    if (client) return Promise.resolve(client);
    loading ??= loadClient(service).then((loaded) => {
      client = loaded;
      loaded.auth.onAuthStateChange((event, next) => {
        session = next;
        renderTrigger();
        options.onSession?.(next, loaded);
        if (event === 'PASSWORD_RECOVERY') {
          show('new-password');
          open();
        } else if (event === 'SIGNED_OUT' && mode === 'home') {
          show('sign-in');
        }
      });
      return loaded;
    });
    return loading;
  };

  const open = (): void => {
    if (!root.hidden) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    say('');
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('open'));
    show(session ? 'home' : mode === 'home' ? 'sign-in' : mode);
    trigger.setAttribute('aria-expanded', 'true');
    // A click on the button is the moment to fetch the library, not before.
    void ensureClient().catch(() => say('The account service could not be reached. Try again in a moment.', true));
  };

  const close = (): void => {
    if (root.hidden) return;
    root.classList.remove('open');
    root.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    for (const form of root.querySelectorAll('form')) form.reset();
    returnFocus?.focus();
  };

  trigger.addEventListener('click', open);
  $('#accountClose').addEventListener('click', close);
  root.addEventListener('click', (event) => { if (event.target === root) close(); });
  // While the panel is up, no key reaches the framing shortcuts: a letter in
  // a password field must never cycle a view. Escape is the panel's own.
  document.addEventListener('keydown', (event) => {
    if (root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    event.stopImmediatePropagation();
  }, { capture: true });
  for (const link of root.querySelectorAll<HTMLButtonElement>('[data-account-mode]')) {
    link.addEventListener('click', () => { say(''); show(link.dataset.accountMode as Mode); });
  }

  root.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (busy) return;
    void submit(form);
  });

  async function submit(form: HTMLFormElement): Promise<void> {
    const kind = form.dataset.accountForm;
    const data = new FormData(form);
    const address = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    setBusy(true);
    say('');
    try {
      const auth = (await ensureClient()).auth;
      if (kind === 'sign-in') {
        const { error } = await auth.signInWithPassword({ email: address, password });
        if (error) say('That email and password were not accepted.', true);
        else { options.announce?.('Signed in'); close(); }
      } else if (kind === 'sign-up') {
        const { data: result, error } = await auth.signUp({
          email: address,
          password,
          options: {
            emailRedirectTo: `${location.origin}${location.pathname}`,
            data: consentRecord(signUpConsent.checked),
          },
        });
        if (error) say(signUpProblem(error), true);
        else if (result.session) { options.announce?.('Account created'); close(); }
        else say('Check your email for a link to confirm the account.');
      } else if (kind === 'forgot') {
        const { error } = await auth.resetPasswordForEmail(address, {
          redirectTo: `${location.origin}${location.pathname}`,
        });
        if (error) say('Could not send a reset link right now.', true);
        else say('If that account exists, a reset link is on its way.');
      } else if (kind === 'new-password') {
        if (password !== String(data.get('confirm') ?? '')) { say('The passwords do not match.', true); return; }
        const { error } = await auth.updateUser({ password });
        if (error) say('Could not save the new password.', true);
        else { say('Password saved.'); show('home'); }
      }
    } catch {
      say('The account service could not be reached. Try again in a moment.', true);
    } finally {
      setBusy(false);
    }
  }

  // Consent can change from the account card as easily as it was given.
  homeConsent.addEventListener('change', () => {
    if (!client || busy) return;
    const wanted = homeConsent.checked;
    setBusy(true);
    void client.auth.updateUser({ data: consentRecord(wanted) })
      .then(({ error }) => {
        if (error) { homeConsent.checked = !wanted; say('Could not save that preference.', true); }
        else say(wanted ? 'You are on the list.' : 'You are off the list.');
      })
      .finally(() => setBusy(false));
  });

  $('#accountSignOut').addEventListener('click', () => {
    if (!client || busy) return;
    setBusy(true);
    void client.auth.signOut({ scope: 'local' })
      .then(({ error }) => {
        if (error) { say('Could not sign out. Try again.', true); return; }
        session = null;
        renderTrigger();
        options.announce?.('Signed out');
        close();
      })
      .finally(() => setBusy(false));
  });

  renderTrigger();
  // A returning session or an emailed link is the only reason to load the
  // library before anyone clicks.
  if (hasStoredSession(service) || urlCarriesAuth()) {
    void ensureClient().catch(() => { /* offline: the button still works later */ });
  }

  return {
    open,
    close,
    isOpen: () => !root.hidden,
    session: () => session,
    client: () => client,
  };
}
