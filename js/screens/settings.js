// Экран «Настройки» и отдельный экран «Бюджеты и лимиты»
import { db, STORES, getSetting, setSetting } from '../db.js';
import { icon, logo } from '../icons.js';
import { EXPENSE_CATEGORIES } from '../categories.js';
import { money, parseAmount, formatAmountInput, setDayStart } from '../format.js';
import { esc, h, openSheet, closeSheet, toast } from '../ui.js';
import { exportCsv, exportPdf, analyzeImport, applyImport } from '../export.js';
import { setPassword, checkPassword, disableLock, faceIdAvailable, enrollFaceId } from '../security.js';

const LOCK_AFTER = [[0, 'Сразу'], [60, 'Через 1 минуту'], [300, 'Через 5 минут']];
const pad = n => String(n).padStart(2, '0');
const minToHHMM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function row(ic, label, value, attrs = '', extra = '') {
  return `<button type="button" class="srow" ${attrs}><span class="srow-ico">${ic}</span><span class="srow-l">${label}</span>${extra || `<span class="srow-v">${value}</span><span class="op-chev">${icon('chevR')}</span>`}</button>`;
}

export const settings = {
  id: 'settings',
  async render(host, ctx) {
    host.innerHTML = `<section class="screen settings">
      <header class="hero">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1>Настройки</h1>
        <p class="sub">Управление приложением и данными</p>
        <img class="hero-img gear" src="assets/img/hero-settings.png" alt="" width="868" height="340">
      </header>
      <div data-body></div>
    </section>`;
    host.querySelector('.back').onclick = () => ctx.back();
    this.ctx = ctx;
    return this.refresh(host);
  },

  async refresh(host) {
    const body = host.querySelector('.settings [data-body]');
    if (!body) return;
    const [dayStart, budget, lockEnabled, lockAfter, faceCred] = await Promise.all([
      getSetting('dayStartMinutes'), getSetting('monthlyBudget'), getSetting('lockEnabled'), getSetting('lockAfter'), getSetting('faceIdCred')]);
    const limits = await db.all(STORES.limits);
    const lockLabel = (LOCK_AFTER.find(([v]) => v === Number(lockAfter)) || LOCK_AFTER[1])[1];
    body.innerHTML = `
      <div class="card sgroup">
        <div class="sg-head"><span class="sg-ico">${icon('coins')}</span>Учёт и валюта</div>
        ${row('<b class="lira">₺</b>', 'Валюта', 'Турецкая лира (₺)', 'data-a="currency"')}
        ${row(icon('calendar'), 'Начало финансового дня', `<b>${minToHHMM(Number(dayStart) || 0)}</b>`, 'data-a="daystart"')}
      </div>
      <div class="card sgroup">
        <div class="sg-head"><span class="sg-ico">${icon('target')}</span>Бюджеты и лимиты</div>
        ${row(icon('bars'), 'Лимиты по категориям', limits.length ? `Задано: ${limits.length} из 8` : 'Настроить лимиты', 'data-a="limits"')}
        ${row(icon('wallet'), 'Ежемесячный бюджет', budget ? `<b class="org">${money(budget)}</b>` : 'Не задан', 'data-a="limits"')}
      </div>
      <div class="card sgroup">
        <div class="sg-head"><span class="sg-ico">${icon('coins')}</span>Данные</div>
        ${row(icon('download'), 'Экспорт отчётов', 'Excel (CSV) / PDF', 'data-a="export"')}
        ${row(icon('upload'), 'Импорт данных', '', 'data-a="import"')}
      </div>
      <div class="card sgroup">
        <div class="sg-head"><span class="sg-ico">${icon('lock')}</span>Безопасность</div>
        ${row(icon('faceid'), faceCred ? 'Пароль / Face ID' : 'Пароль приложения', '', 'data-a="pass"', `<span class="switch-row bare"><input type="checkbox" ${lockEnabled ? 'checked' : ''} tabindex="-1"><span class="switch"></span></span>`)}
        ${row(icon('lock'), 'Блокировка приложения', lockEnabled ? lockLabel : 'Выключена', 'data-a="lockafter"')}
      </div>
      <input type="file" accept=".csv,text/csv" data-file hidden>`;
    body.querySelectorAll('[data-a]').forEach(b => b.onclick = () => this.action(b.dataset.a, host));
    body.querySelector('[data-file]').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
  },

  action(a, host) {
    if (a === 'currency') return currencySheet();
    if (a === 'daystart') return dayStartSheet();
    if (a === 'limits') return this.ctx.open('limits');
    if (a === 'export') return exportSheet();
    if (a === 'import') return host.querySelector('[data-file]').click();
    if (a === 'pass') return passSheet();
    if (a === 'lockafter') return lockAfterSheet();
  },
};

/* ---------- Учёт и валюта ---------- */
function currencySheet() {
  const b = h(`<div>
    <div class="card choice-list"><button class="choice on" type="button">${icon('check')}<span>Турецкая лира (₺) · TRY</span></button></div>
    <p class="hint">Все суммы хранятся и показываются в турецких лирах. Другие валюты не подключены: без отдельного механизма обменных курсов существующие суммы не пересчитываются.</p>
  </div>`);
  b.querySelector('.choice').onclick = () => closeSheet();
  openSheet('Валюта', b);
}

async function dayStartSheet() {
  const cur = Number(await getSetting('dayStartMinutes')) || 0;
  const b = h(`<form novalidate>
    <div class="field"><label>Время начала дня</label><input class="input" type="time" name="t" value="${minToHHMM(cur)}"></div>
    <p class="hint">Финансовый день начинается в это время. В этот момент предыдущий день закрывается, и его расходы становятся доступны только для просмотра. По умолчанию 00:00.</p>
    <button class="btn-primary" type="submit">Сохранить</button>
  </form>`);
  b.addEventListener('submit', async e => {
    e.preventDefault();
    const [hh, mm] = (b.querySelector('[name=t]').value || '00:00').split(':').map(Number);
    const v = (hh || 0) * 60 + (mm || 0);
    setDayStart(v);
    await setSetting('dayStartMinutes', v);
    closeSheet(); toast(`Начало дня: ${minToHHMM(v)}`);
  });
  openSheet('Начало финансового дня', b);
}

/* ---------- Данные ---------- */
function exportSheet() {
  const b = h(`<div>
    <div class="card choice-list">
      <button class="choice" type="button" data-x="csv">${icon('download')}<span><b>Excel (CSV)</b><small>Все операции: тип, дата, время, название, категория, сумма, статус, комментарий</small></span></button>
    </div>
    <div class="day-head">PDF-отчёт</div>
    <div class="card choice-list">
      <button class="choice" type="button" data-x="pdf-month">${icon('download')}<span><b>За текущий месяц</b></span></button>
      <button class="choice" type="button" data-x="pdf-prev">${icon('download')}<span><b>За прошлый месяц</b></span></button>
      <button class="choice" type="button" data-x="pdf-all">${icon('download')}<span><b>За весь период</b></span></button>
    </div>
    <p class="hint">На iPhone откроется меню «Поделиться»: файл можно сохранить в «Файлы», отправить по почте или в мессенджер.</p>
  </div>`);
  b.querySelectorAll('[data-x]').forEach(x => x.onclick = async () => {
    x.disabled = true;
    try {
      if (x.dataset.x === 'csv') { const r = await exportCsv(); if (r.result !== 'cancelled') toast(`CSV готов: ${r.count} операций`); }
      else { const r = await exportPdf(x.dataset.x.slice(4)); if (r.result !== 'cancelled') toast(`PDF готов: ${r.pages} стр.`); }
    } catch (e) { console.error(e); toast('Не удалось сформировать файл'); }
    x.disabled = false;
  });
  openSheet('Экспорт отчётов', b);
}

async function importFile(file) {
  let res;
  try { res = await analyzeImport(await file.text()); }
  catch (e) { const b = h(`<div><p class="hint err">${esc(e.message)}</p><button class="btn-primary" type="button">Понятно</button></div>`); b.querySelector('button').onclick = () => closeSheet(); return openSheet('Импорт данных', b); }
  const { ok, dupes, errors } = res;
  const b = h(`<div>
    <div class="card rep-sum">
      <div><span>Новых записей</span><b>${ok.length}</b></div>
      <div><span>Возможные дубликаты</span><b class="${dupes.length ? 'org' : ''}">${dupes.length}</b></div>
      <div><span>Строк с ошибками</span><b class="${errors.length ? 'neg' : ''}">${errors.length}</b></div>
    </div>
    ${dupes.length ? `<p class="hint warn">Найдено ${dupes.length} записей, которые уже есть в приложении (тот же ID или та же дата, сумма и название). Рекомендуем их пропустить, чтобы не было двойного учёта.</p>` : ''}
    ${errors.length ? `<p class="hint err">${errors.slice(0, 5).map(esc).join('<br>')}${errors.length > 5 ? '<br>…' : ''}</p>` : ''}
    ${ok.length ? `<button class="btn-primary" type="button" data-imp="new">Импортировать ${ok.length} новых</button>` : ''}
    ${dupes.length ? `<button class="btn-ghost wide" type="button" data-imp="all">Импортировать вместе с дубликатами</button>` : ''}
    ${!ok.length && !dupes.length ? '<p class="hint">Нечего импортировать.</p>' : ''}
  </div>`);
  b.querySelectorAll('[data-imp]').forEach(x => x.onclick = async () => {
    // «вместе с дубликатами» добавляет их как новые записи с новыми ID
    const list = x.dataset.imp === 'all' ? [...ok, ...dupes.map(d => ({ ...d, id: undefined }))] : ok;
    const n = await applyImport(list);
    closeSheet(); toast(`Импортировано: ${n}`);
  });
  openSheet('Импорт данных', b);
}

/* ---------- Безопасность ---------- */
async function passSheet() {
  const enabled = await getSetting('lockEnabled');
  const faceOk = await faceIdAvailable();
  const hasFace = !!(await getSetting('faceIdCred'));
  if (!enabled) {
    const b = h(`<form novalidate>
      <div class="field"><label>Новый пароль</label><input class="input" type="password" name="p1" autocomplete="new-password" minlength="4" placeholder="Минимум 4 символа"></div>
      <div class="field"><label>Повторите пароль</label><input class="input" type="password" name="p2" autocomplete="new-password"></div>
      <label class="switch-row field${faceOk ? '' : ' disabled'}"><span>Face ID${faceOk ? '' : ' — недоступно на этом устройстве'}</span><input type="checkbox" name="face" ${faceOk ? 'checked' : 'disabled'}><span class="switch"></span></label>
      <p class="hint">Пароль закрывает доступ к приложению на этом устройстве. Восстановить забытый пароль нельзя. Ограничение веб-приложения: данные хранятся на устройстве без шифрования.</p>
      <p class="form-error"></p>
      <button class="btn-primary" type="submit">Включить защиту</button>
    </form>`);
    b.addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = b.querySelector('[name=p1]').value, p2 = b.querySelector('[name=p2]').value;
      const err = b.querySelector('.form-error');
      if (p1.length < 4) { err.textContent = 'Пароль должен быть не короче 4 символов'; return; }
      if (p1 !== p2) { err.textContent = 'Пароли не совпадают'; return; }
      await setPassword(p1);
      let msg = 'Пароль включён';
      if (faceOk && b.querySelector('[name=face]').checked) {
        try { await enrollFaceId(); msg = 'Пароль и Face ID включены'; }
        catch (_) { msg = 'Пароль включён, Face ID не подключён'; }
      }
      closeSheet(); toast(msg);
    });
    return openSheet('Пароль приложения', b);
  }
  const b = h(`<form novalidate>
    <div class="field"><label>Текущий пароль</label><input class="input" type="password" name="p" autocomplete="current-password"></div>
    <p class="hint">Face ID: ${hasFace ? 'подключён' : faceOk ? 'не подключён' : 'недоступен на этом устройстве'}.</p>
    <p class="form-error"></p>
    ${faceOk && !hasFace ? `<button class="btn-ghost wide" type="button" data-face>${icon('faceid')} Подключить Face ID</button>` : ''}
    <button class="btn-danger" type="submit">Выключить защиту</button>
  </form>`);
  const err = b.querySelector('.form-error');
  b.querySelector('[data-face]')?.addEventListener('click', async () => {
    if (!(await checkPassword(b.querySelector('[name=p]').value))) { err.textContent = 'Введите текущий пароль'; return; }
    try { await enrollFaceId(); closeSheet(); toast('Face ID подключён'); } catch (_) { err.textContent = 'Face ID не подключён'; }
  });
  b.addEventListener('submit', async e => {
    e.preventDefault();
    if (!(await checkPassword(b.querySelector('[name=p]').value))) { err.textContent = 'Неверный пароль'; return; }
    await disableLock(); closeSheet(); toast('Защита выключена');
  });
  openSheet('Пароль / Face ID', b);
}

async function lockAfterSheet() {
  if (!(await getSetting('lockEnabled'))) { toast('Сначала включите пароль приложения'); return passSheet(); }
  const cur = Number(await getSetting('lockAfter'));
  const b = h(`<div class="card choice-list">${LOCK_AFTER.map(([v, l]) => `<button class="choice${v === cur ? ' on' : ''}" type="button" data-v="${v}">${icon('check')}<span>${l}</span></button>`).join('')}</div>`);
  b.querySelectorAll('[data-v]').forEach(x => x.onclick = async () => { await setSetting('lockAfter', Number(x.dataset.v)); closeSheet(); toast('Сохранено'); });
  openSheet('Блокировка приложения', b);
}

/* ---------- Экран «Бюджеты и лимиты» ---------- */
export const limits = {
  id: 'limits',
  async render(host, ctx) {
    const [budget, list] = await Promise.all([getSetting('monthlyBudget'), db.all(STORES.limits)]);
    const lim = id => (list.find(l => l.id === id) || {}).amount || '';
    const val = v => v ? formatAmountInput(String(v).replace('.', ',')) : '';
    host.innerHTML = `<section class="screen limits">
      <header class="hero small">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1>Бюджеты и лимиты</h1>
        <p class="sub">Пустое поле — лимит не задан</p>
      </header>
      <form novalidate>
        <div class="card lim-card">
          <label class="lim-row"><span class="op-ico">${icon('wallet')}</span><span class="lim-l">Ежемесячный бюджет</span><span class="lim-in"><input class="input" name="budget" inputmode="decimal" placeholder="0" value="${val(budget)}"><i>₺</i></span></label>
        </div>
        <div class="day-head">Лимиты по категориям</div>
        <div class="card lim-card">
          ${EXPENSE_CATEGORIES.map(c => `<label class="lim-row"><span class="op-ico">${icon(c.icon)}</span><span class="lim-l">${esc(c.name)}</span><span class="lim-in"><input class="input" name="${c.id}" inputmode="decimal" placeholder="0" value="${val(lim(c.id))}"><i>₺</i></span></label>`).join('')}
        </div>
        <p class="form-error"></p>
        <button class="btn-primary short" type="submit">Сохранить</button>
      </form>
    </section>`;
    host.querySelector('.back').onclick = () => ctx.back();
    const form = host.querySelector('form');
    form.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { i.value = formatAmountInput(i.value); }));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      const read = n => { const v = form.querySelector(`[name="${n}"]`).value.trim(); return v ? parseAmount(v) : 0; };
      const vals = { budget: read('budget') };
      for (const c of EXPENSE_CATEGORIES) vals[c.id] = read(c.id);
      if (Object.values(vals).some(v => isNaN(v) || v < 0)) { err.textContent = 'Проверьте суммы'; return; }
      await setSetting('monthlyBudget', vals.budget || 0);
      for (const c of EXPENSE_CATEGORIES) {
        if (vals[c.id] > 0) await db.put(STORES.limits, { id: c.id, amount: vals[c.id] });
        else await db.del(STORES.limits, c.id);
      }
      toast('Бюджет и лимиты сохранены');
      ctx.back();
    });
  },
};
