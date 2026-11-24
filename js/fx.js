// Курсы валют: загружаются из интернета (open.er-api.com, база — лира) и сохраняются на устройстве.
// Без интернета используется последний сохранённый курс.
import { getSetting, setSetting } from './db.js';
import { setFx, CURRENCIES } from './format.js';

const URL_FX = 'https://open.er-api.com/v6/latest/TRY';
const MAX_AGE = 6 * 3600e3; // обновляем не чаще раза в 6 часов

export async function loadFx() {
  const [base, saved] = await Promise.all([getSetting('currency'), getSetting('fxRates')]);
  setFx(base || 'TRY', saved?.rates);
  return saved;
}

/** Обновляет курс; force — даже если сохранённый ещё свежий. Возвращает {ok, date}. */
export async function refreshFx(force = false) {
  const saved = await getSetting('fxRates');
  if (!force && saved && Date.now() - saved.fetchedAt < MAX_AGE) return { ok: true, date: saved.date, cached: true };
  if (!navigator.onLine) return { ok: false, date: saved?.date };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(URL_FX, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    const j = await res.json();
    if (j.result !== 'success' || !j.rates) throw new Error('bad response');
    const rates = {};
    for (const k of Object.keys(CURRENCIES)) rates[k] = Number(j.rates[k]);
    if (Object.values(rates).some(v => !(v > 0))) throw new Error('missing rate');
    const rec = { rates, date: (j.time_last_update_unix || Date.now() / 1000) * 1000, fetchedAt: Date.now() };
    setFx(null, rates);
    await setSetting('fxRates', rec);
    return { ok: true, date: rec.date };
  } catch (e) {
    console.warn('FX:', e.message);
    return { ok: false, date: saved?.date };
  }
}
