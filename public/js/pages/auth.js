// Вход и регистрация покупателя.
import { html, $ } from '../util.js';
import { t } from '../i18n.js';
import { loginUser, registerUser } from '../api.js';
import { setUser } from '../store.js';
import { actions, parseHash, go } from '../router.js';

const state = { mode: 'login' };

const errorText = (err) => {
  const key = `err.${err.code}`;
  return t(key) !== key ? t(key) : t('common.error');
};

const nextPath = () => {
  const next = parseHash().params.get('next') ?? '/account';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/account';
};

export const authPage = {
  render() {
    state.mode = parseHash().params.get('mode') === 'register' ? 'register' : 'login';
    const reg = state.mode === 'register';
    return html`
      <div class="auth-wrap">
        <div class="card auth-card">
          <h1>${t('auth.title')}</h1>
          <p class="muted">${t('auth.sub')}</p>
          <div class="seg auth-tabs" role="tablist">
            <button role="tab" data-action="auth-mode" data-mode="login" class="${reg ? '' : 'active'}">${t('auth.login')}</button>
            <button role="tab" data-action="auth-mode" data-mode="register" class="${reg ? 'active' : ''}">${t('auth.register')}</button>
          </div>
          <form id="auth-form" novalidate>
            ${reg ? html`<label class="field"><span>${t('auth.name')}</span><input name="name" autocomplete="name" maxlength="60" required></label>` : ''}
            <label class="field"><span>${t('auth.email')}</span><input name="email" type="email" autocomplete="email" maxlength="254" required></label>
            <label class="field"><span>${t('auth.password')}</span><input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" maxlength="128" required>${reg ? html`<small class="muted">${t('auth.password_hint')}</small>` : ''}</label>
            <p id="auth-error" class="form-error" role="alert" hidden></p>
            <button type="submit" id="auth-submit" class="btn btn-primary">${reg ? t('auth.submit_register') : t('auth.submit_login')}</button>
          </form>
        </div>
      </div>`;
  },

  mount(root) {
    const form = $('#auth-form', root);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const btn = $('#auth-submit', root);
      const errBox = $('#auth-error', root);
      errBox.hidden = true;
      btn.disabled = true;
      btn.textContent = t('auth.wait');
      try {
        const user = state.mode === 'register' ? await registerUser(data) : await loginUser(data);
        setUser(user);
        go(nextPath());
      } catch (err) {
        errBox.textContent = errorText(err);
        errBox.hidden = false;
        btn.disabled = false;
        btn.textContent = state.mode === 'register' ? t('auth.submit_register') : t('auth.submit_login');
      }
    });
  },
};

actions['auth-mode'] = (el) => {
  const next = parseHash().params.get('next');
  const params = new URLSearchParams();
  if (el.dataset.mode === 'register') params.set('mode', 'register');
  if (next) params.set('next', next);
  const q = params.toString();
  go(`/login${q ? `?${q}` : ''}`);
};
