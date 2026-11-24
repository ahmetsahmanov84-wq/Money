// Пароль приложения, Face ID (WebAuthn, платформенный аутентификатор) и экран блокировки.
// Ограничение PWA: блокировка закрывает доступ к интерфейсу, но данные IndexedDB на устройстве не шифруются.
import { getSetting, setSetting } from './db.js';
import { icon, logo } from './icons.js';

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function hashPassword(pass, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}

export async function setPassword(pass) {
  const { hash, salt } = await hashPassword(pass);
  await setSetting('passHash', hash);
  await setSetting('passSalt', salt);
  await setSetting('lockEnabled', true);
}
export async function checkPassword(pass) {
  const [hash, salt] = await Promise.all([getSetting('passHash'), getSetting('passSalt')]);
  if (!hash || !salt) return false;
  return (await hashPassword(pass, salt)).hash === hash;
}
export async function disableLock() {
  await setSetting('lockEnabled', false);
  await setSetting('passHash', null);
  await setSetting('passSalt', null);
  await setSetting('faceIdCred', null);
}

/* ---------- Face ID через WebAuthn ---------- */
export async function faceIdAvailable() {
  try {
    return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (_) { return false; }
}
export async function enrollFaceId() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Money Tracker' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'money-tracker', displayName: 'Money Tracker' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  await setSetting('faceIdCred', b64(cred.rawId));
}
export async function verifyFaceId() {
  const id = await getSetting('faceIdCred');
  if (!id) return false;
  const res = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return !!res;
}

/* ---------- Экран блокировки ---------- */
let locked = false;
let hiddenAt = null;

export function isLocked() { return locked; }

export async function showLock() {
  if (locked) return;
  locked = true;
  const hasFace = !!(await getSetting('faceIdCred')) && await faceIdAvailable();
  const el = document.createElement('div');
  el.className = 'lock';
  el.innerHTML = `<div class="lock-box">
    <div class="lock-logo">${logo()}<span>Money Tracker</span></div>
    <div class="lock-ico">${icon('lock')}</div>
    <h2>Приложение заблокировано</h2>
    ${hasFace ? `<button class="btn-primary face-main" type="button" data-face>${icon('faceid')} Войти по Face ID</button><div class="lock-or">или введите пароль</div>` : ''}
    <form novalidate>
      <input class="input" type="password" name="pass" autocomplete="current-password" placeholder="Пароль" inputmode="text">
      <p class="form-error"></p>
      <button class="${hasFace ? 'btn-ghost wide' : 'btn-primary'}" type="submit">Войти по паролю</button>
    </form>
  </div>`;
  document.getElementById('app').append(el);
  const form = el.querySelector('form');
  const inp = el.querySelector('input');
  const err = el.querySelector('.form-error');
  const unlock = () => { locked = false; el.remove(); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (await checkPassword(inp.value)) unlock();
    else { err.textContent = 'Неверный пароль'; inp.value = ''; inp.focus(); }
  });
  const fb = el.querySelector('[data-face]');
  const tryFace = async () => {
    try { if (await verifyFaceId()) unlock(); } catch (_) { err.textContent = 'Face ID не подтверждён, введите пароль'; }
  };
  if (fb) {
    fb.addEventListener('click', tryFace);
    // Пробуем Face ID сразу; если iOS требует нажатия, остаётся кнопка и пароль
    setTimeout(() => { if (locked) verifyFaceId().then(ok => { if (ok) unlock(); }).catch(() => {}); }, 300);
  } else setTimeout(() => inp.focus(), 200);
}

/** Подключает блокировку при запуске и при возврате в приложение */
export async function initLock() {
  if (await getSetting('lockEnabled')) await showLock();
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (!(await getSetting('lockEnabled')) || hiddenAt === null) return;
    const after = Number(await getSetting('lockAfter')) || 0;
    if (Date.now() - hiddenAt >= after * 1000) showLock();
    hiddenAt = null;
  });
}
