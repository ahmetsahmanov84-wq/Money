// Экран «Аналитика» и подробный экран категории. Только просмотр, без добавления расходов.
import { db, STORES } from '../db.js';
import { icon, logo } from '../icons.js';
import { EXPENSE_CATEGORIES } from '../categories.js';
import { money, longDate, shortDate, hhmm, dayStartOf, financialDay, addDays, monthRange, monthTitle, pct } from '../format.js';
import { esc, fitText } from '../ui.js';

// Цвета категорий на круговой диаграмме (первые шесть — как в макете)
const COLORS = ['#ff7a12', '#ffbe3d', '#2f80ed', '#9b5de5', '#3cb043', '#a9a6a5', '#ff5c7a', '#1fb5a8'];
const MON_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MON_GEN_SHORT = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const ROMAN = ['I', 'II', 'III', 'IV'];

const state = { kind: 'month', anchor: null, cmp: 'month' };

/* ---------- Периоды ---------- */
const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7));
const t = (y, m, d) => dayStartOf(y, m, d).getTime();

export function periodRange(kind, a) {
  const y = a.getFullYear(), m = a.getMonth();
  if (kind === 'day') return [t(y, m, a.getDate()), t(y, m, a.getDate() + 1)];
  if (kind === 'week') { const s = startOfWeek(a); return [t(s.getFullYear(), s.getMonth(), s.getDate()), t(s.getFullYear(), s.getMonth(), s.getDate() + 7)]; }
  if (kind === 'month') return monthRange(a);
  return [t(y, 0, 1), t(y + 1, 0, 1)];
}
export function periodLabel(kind, a) {
  if (kind === 'day') return longDate(a);
  if (kind === 'week') {
    const s = startOfWeek(a), e = addDays(s, 6);
    if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MON_GEN_SHORT[e.getMonth()]} ${e.getFullYear()}`;
    return `${s.getDate()} ${MON_GEN_SHORT[s.getMonth()]} – ${e.getDate()} ${MON_GEN_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  }
  if (kind === 'month') return monthTitle(a);
  return String(a.getFullYear());
}
function shift(kind, a, n) {
  if (kind === 'day') return addDays(a, n);
  if (kind === 'week') return addDays(a, 7 * n);
  if (kind === 'month') return new Date(a.getFullYear(), a.getMonth() + n, 1);
  return new Date(a.getFullYear() + n, 0, 1);
}

/** Столбцы сравнения: [{label, from, to, current}] */
function bars(kind, a, cmp) {
  const y = a.getFullYear(), m = a.getMonth();
  const out = [];
  if (kind === 'day') {
    for (let i = 6; i >= 0; i--) { const d = addDays(a, -i); out.push({ label: String(d.getDate()), sub: WD[(d.getDay() + 6) % 7], from: t(d.getFullYear(), d.getMonth(), d.getDate()), to: t(d.getFullYear(), d.getMonth(), d.getDate() + 1), current: i === 0 }); }
  } else if (kind === 'week') {
    const s = startOfWeek(a);
    for (let i = 0; i < 7; i++) { const d = addDays(s, i); out.push({ label: WD[i], from: t(d.getFullYear(), d.getMonth(), d.getDate()), to: t(d.getFullYear(), d.getMonth(), d.getDate() + 1), current: d.getTime() === financialDay().getTime() }); }
  } else if (kind === 'year') {
    for (let i = 0; i < 12; i++) out.push({ label: MON_SHORT[i], from: t(y, i, 1), to: t(y, i + 1, 1), current: false });
  } else if (cmp === 'month') {
    for (let i = 3; i >= 0; i--) { const d = new Date(y, m - i, 1); out.push({ label: MON_SHORT[d.getMonth()], from: t(d.getFullYear(), d.getMonth(), 1), to: t(d.getFullYear(), d.getMonth() + 1, 1), current: i === 0 }); }
  } else if (cmp === 'quarter') {
    const q = Math.floor(m / 3);
    for (let i = 3; i >= 0; i--) { const d = new Date(y, (q - i) * 3, 1); const qq = Math.floor(d.getMonth() / 3); out.push({ label: `${ROMAN[qq]} кв.`, sub: String(d.getFullYear()), from: t(d.getFullYear(), d.getMonth(), 1), to: t(d.getFullYear(), d.getMonth() + 3, 1), current: i === 0 }); }
  } else {
    for (let i = 3; i >= 0; i--) out.push({ label: String(y - i), from: t(y - i, 0, 1), to: t(y - i + 1, 0, 1), current: i === 0 });
  }
  return out;
}
function chartTitle(kind, cmp) {
  if (kind === 'day' || kind === 'week') return 'Расходы по дням';
  if (kind === 'year') return 'Расходы по месяцам';
  return { month: 'Сравнение по месяцам (расходы)', quarter: 'Сравнение по кварталам (расходы)', year: 'Сравнение по годам (расходы)' }[cmp];
}
function short(v) {
  if (v >= 1e6) return (Math.round(v / 1e5) / 10).toString().replace('.', ',') + 'M';
  if (v >= 1000) return Math.round(v / 1000) + 'K';
  return String(Math.round(v));
}

/* ---------- Круговая диаграмма ---------- */
function donut(parts, total) {
  const R = 40, C = 2 * Math.PI * R;
  let off = 0;
  const segs = total > 0 ? parts.filter(p => p.value > 0).map(p => {
    const len = p.value / total * C;
    const s = `<circle data-cat="${p.id}" cx="50" cy="50" r="${R}" fill="none" stroke="${p.color}" stroke-width="17" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)"/>`;
    off += len;
    return s;
  }).join('') : '';
  return `<svg class="donut" viewBox="0 0 100 100" role="img" aria-label="Расходы по категориям">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="#ece5e2" stroke-width="17"/>${segs}
    <circle cx="50" cy="50" r="31.5" fill="#fffaf7"/>
  </svg>`;
}

export const analytics = {
  id: 'analytics',
  render(host, ctx) {
    if (!state.anchor) state.anchor = financialDay();
    host.innerHTML = `<section class="screen analytics">
      <header class="hero">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1>Аналитика</h1>
        <p class="sub">Графики, структура и сравнение</p>
        <img class="hero-img chart" src="assets/img/hero-analytics.png" alt="" width="624" height="288">
      </header>
      <div class="seg tabs four" data-kind>
        ${[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']].map(([k, l]) => `<button type="button" data-k="${k}"${state.kind === k ? ' class="on"' : ''}>${l}</button>`).join('')}
      </div>
      <div class="datebar an-date">
        <button class="nav-btn" data-prev aria-label="Назад">${icon('chevL')}</button>
        <div class="date-label">${icon('calendar')}<span data-label></span></div>
        <button class="nav-btn" data-next aria-label="Вперёд">${icon('chevR')}</button>
      </div>
      <div class="card summary an-sum">
        <div class="sum-col"><span class="sum-ico in">${icon('arrowDown')}</span><span class="sum-label">Доходы</span><span class="sum-val pos" data-in></span></div>
        <span class="sep"></span>
        <div class="sum-col"><span class="sum-ico out">${icon('arrowUp')}</span><span class="sum-label">Расходы</span><span class="sum-val out-val" data-out></span></div>
        <span class="sep"></span>
        <div class="sum-col"><span class="sum-ico bal">${icon('scales')}</span><span class="sum-label">Баланс</span><span class="sum-val" data-bal></span></div>
      </div>
      <div class="card an-card">
        <h2>Расходы по категориям</h2>
        <div class="pie-wrap">
          <div class="pie" data-pie></div>
          <ul class="legend" data-legend></ul>
        </div>
      </div>
      <div class="card an-card">
        <div class="an-head"><h2 data-ctitle></h2><div class="mini-seg" data-cmp></div></div>
        <div class="bars" data-bars></div>
      </div>
    </section>`;
    const $ = s => host.querySelector(s);
    $('.back').onclick = () => ctx.back();
    host.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      state.kind = b.dataset.k;
      host.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b));
      this.refresh(host);
    });
    $('[data-prev]').onclick = () => { state.anchor = shift(state.kind, state.anchor, -1); this.refresh(host); };
    $('[data-next]').onclick = () => { state.anchor = shift(state.kind, state.anchor, 1); this.refresh(host); };
    const openCat = id => ctx.open('categoryDetail', { catId: id, kind: state.kind, anchor: state.anchor });
    $('[data-legend]').addEventListener('click', e => { const r = e.target.closest('[data-cat]'); if (r) openCat(r.dataset.cat); });
    $('[data-pie]').addEventListener('click', e => { const r = e.target.closest('[data-cat]'); if (r) openCat(r.dataset.cat); });
    $('[data-cmp]').addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      state.cmp = b.dataset.c; this.refresh(host);
    });
    return this.refresh(host);
  },

  async refresh(host) {
    const $ = s => host.querySelector(s);
    if (!$('.analytics')) return;
    const { kind, anchor, cmp } = state;
    $('[data-label]').textContent = periodLabel(kind, anchor);
    const [from, to] = periodRange(kind, anchor);
    const all = await db.all(STORES.operations);
    const inRange = all.filter(o => o.ts >= from && o.ts < to);

    let inc = 0, exp = 0;
    const byCat = {};
    for (const o of inRange) {
      if (o.type === 'income' && o.status !== 'expected') inc += o.amount;
      if (o.type === 'expense') { exp += o.amount; byCat[o.categoryId] = (byCat[o.categoryId] || 0) + o.amount; }
    }
    const bal = Math.round((inc - exp) * 100) / 100;
    $('[data-in]').textContent = money(inc, '+');
    $('[data-out]').textContent = money(exp, '-');
    const be = $('[data-bal]');
    be.textContent = money(bal, bal > 0 ? '+' : bal < 0 ? '-' : '');
    be.className = 'sum-val ' + (bal < 0 ? 'neg' : 'pos');
    host.querySelectorAll('.sum-val').forEach(el => fitText(el));

    const parts = EXPENSE_CATEGORIES.map((c, i) => ({ id: c.id, name: c.name, color: COLORS[i], value: byCat[c.id] || 0 }));
    $('[data-pie]').innerHTML = donut(parts, exp) + `<div class="pie-center" data-ptotal>${money(exp)}</div>`;
    fitText($('[data-ptotal]'), 0.55);
    $('[data-legend]').innerHTML = parts.map(p => `<li><button data-cat="${p.id}"><i style="background:${p.color}"></i><span class="lg-name">${esc(p.name)}</span><span class="lg-pct">${pct(p.value, exp)}</span></button></li>`).join('');

    $('[data-ctitle]').textContent = chartTitle(kind, cmp);
    $('[data-cmp]').innerHTML = kind === 'month'
      ? [['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год']].map(([c, l]) => `<button type="button" data-c="${c}"${cmp === c ? ' class="on"' : ''}>${l}</button>`).join('')
      : '';
    const bs = bars(kind, anchor, cmp).map(b => ({ ...b, value: all.reduce((s, o) => s + (o.type === 'expense' && o.ts >= b.from && o.ts < b.to ? o.amount : 0), 0) }));
    const max = Math.max(1, ...bs.map(b => b.value));
    $('[data-bars]').className = 'bars n' + bs.length;
    $('[data-bars]').innerHTML = bs.map(b => `<div class="bar${b.current ? ' cur' : ''}">
      <span class="bv">${b.value ? short(b.value) : '0'}</span>
      <span class="bb"><span style="height:${Math.max(3, b.value / max * 100)}%"></span></span>
      <span class="bl">${b.label}${b.sub ? `<small>${b.sub}</small>` : ''}</span></div>`).join('');
  },

  tick(host) { this.refresh(host); },
};

/* ---------- Подробный экран категории ---------- */
const detail = { catId: null, kind: 'month', anchor: null, scope: 'period' };

export const categoryDetail = {
  id: 'categoryDetail',
  render(host, ctx, params = {}) {
    if (params.catId) Object.assign(detail, params, { scope: 'period' });
    const cat = EXPENSE_CATEGORIES.find(c => c.id === detail.catId) || EXPENSE_CATEGORIES[0];
    host.innerHTML = `<section class="screen cat-detail">
      <header class="hero small">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1>${esc(cat.name)}</h1>
        <p class="sub" data-sub></p>
      </header>
      <div class="seg tabs" data-scope>
        <button type="button" data-s="period">За период</button>
        <button type="button" data-s="all">Вся история</button>
      </div>
      <div class="card cd-sum" style="margin-top:.75rem">
        <span class="op-ico big">${icon(cat.icon)}</span>
        <div><div class="inc-label" data-tlabel>Всего за период</div><div class="cd-total neg" data-total></div><div class="inc-exp" data-count></div></div>
      </div>
      <div class="card ops cd-list"><ul class="op-list" data-list><li class="empty compact">Загрузка…</li></ul></div>
    </section>`;
    host.querySelector('.back').onclick = () => ctx.back();
    host.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { detail.scope = b.dataset.s; this.refresh(host); });
    return this.refresh(host);
  },
  async refresh(host) {
    const $ = s => host.querySelector(s);
    if (!$('.cat-detail')) return;
    const all = detail.scope === 'all';
    host.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === detail.scope));
    $('[data-sub]').textContent = all ? 'Все расходы за всё время' : `Расходы за период: ${periodLabel(detail.kind, detail.anchor)}`;
    $('[data-tlabel]').textContent = all ? 'Всего за всё время' : 'Всего за период';
    const [from, to] = all ? [0, Number.MAX_SAFE_INTEGER] : periodRange(detail.kind, detail.anchor);
    const ops = (await db.range(STORES.operations, 'ts', from, to))
      .filter(o => o.type === 'expense' && o.categoryId === detail.catId)
      .sort((a, b) => b.ts - a.ts);
    const sum = ops.reduce((s, o) => s + o.amount, 0);
    $('[data-total]').textContent = money(sum, '-');
    const n = ops.length;
    $('[data-count]').textContent = `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'операция' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'операции' : 'операций'}`;
    $('[data-list]').innerHTML = n ? ops.map(o => {
      const d = new Date(o.ts);
      return `<li class="cd-row"><div class="cd-main"><div class="op-title">${esc(o.title)}</div><div class="op-sub">${shortDate(d)}, ${hhmm(d)}</div>${o.note ? `<div class="cd-note">${esc(o.note)}</div>` : ''}</div><span class="op-amt neg">${money(o.amount, '-')}</span></li>`;
    }).join('') : `<li class="empty compact">${all ? 'Расходов в этой категории пока нет' : 'Расходов за этот период нет'}</li>`;
  },
};
