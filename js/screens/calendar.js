// Экран «Календарь отчётов». Только просмотр истории, без добавления расходов.
// День закрывается в начале следующего финансового дня (00:00 по времени устройства).
// Закрытость вычисляется из текущей даты, поэтому после долгого отсутствия все прошедшие дни уже закрыты.
import { db, STORES } from '../db.js';
import { icon, logo } from '../icons.js';
import { money, longDate, hhmm, financialDay, dayRange, monthTitle, sameDay, origLabel } from '../format.js';
import { esc, h, openSheet } from '../ui.js';
import { opIcon } from '../categories.js';
import { openOperation } from '../forms.js';

const state = { month: null, selected: null };
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const isClosed = day => day < financialDay();

export const calendar = {
  id: 'calendar',
  render(host, ctx, params = {}) {
    const today = financialDay();
    if (params.day) state.selected = new Date(params.day);
    if (!state.selected) state.selected = today;
    state.month = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1);

    host.innerHTML = `<section class="screen calendar">
      <header class="hero">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1 class="h-long">Календарь отчётов</h1>
        <p class="sub">Просмотр и анализ по дням</p>
        <img class="hero-img cal" src="assets/img/hero-calendar.png" alt="" width="652" height="304">
      </header>
      <div class="datebar">
        <button class="nav-btn" data-prev aria-label="Предыдущий месяц">${icon('chevL')}</button>
        <div class="date-label">${icon('calendar')}<span data-month></span></div>
        <button class="nav-btn" data-next aria-label="Следующий месяц">${icon('chevR')}</button>
      </div>
      <div class="card cal-stats">
        <div><div class="cs-top"><span class="cs-ico ok">${icon('calCheck')}</span><b data-closed>0</b></div><span>Закрытых дней</span></div>
        <span class="sep"></span>
        <div><div class="cs-top"><span class="cs-ico now">${icon('calToday')}</span><b>${today.getDate()}</b></div><span>Сегодня</span></div>
      </div>
      <div class="card cal-grid">
        <div class="cal-wd">${WD.map((w, i) => `<span${i > 4 ? ' class="we"' : ''}>${w}</span>`).join('')}</div>
        <div class="cal-days" data-days></div>
      </div>
      <div class="card day-rep">
        <div class="dr-head"><span class="dr-date">${icon('calendar')}<b data-sel></b></span><span data-badge></span></div>
        <div class="dr-stats">
          <div><span class="sum-ico in">${icon('arrowDown')}</span><span><small>Доходы</small><b class="pos" data-in></b></span></div>
          <div><span class="sum-ico out">${icon('arrowUp')}</span><span><small>Расходы</small><b class="out-val" data-out></b></span></div>
          <div><span class="sum-ico bal">${icon('scales')}</span><span><small>Баланс</small><b data-bal></b></span></div>
        </div>
        <button class="dr-more" type="button" data-report><span class="dr-bars">${icon('bars')}</span><span>Подробный отчёт за день</span>${icon('chevR')}</button>
      </div>
    </section>`;
    const $ = s => host.querySelector(s);
    $('.back').onclick = () => ctx.back();
    $('[data-prev]').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); this.refresh(host); };
    $('[data-next]').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); this.refresh(host); };
    $('[data-days]').addEventListener('click', e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      const [y, m, d] = b.dataset.d.split('-').map(Number);
      state.selected = new Date(y, m, d);
      if (m !== state.month.getMonth()) state.month = new Date(y, m, 1);
      this.refresh(host);
    });
    $('[data-report]').onclick = () => openReport(state.selected);
    return this.refresh(host);
  },

  async refresh(host) {
    const $ = s => host.querySelector(s);
    if (!$('.calendar')) return;
    const today = financialDay();
    const y = state.month.getFullYear(), m = state.month.getMonth();
    $('[data-month]').textContent = monthTitle(state.month);

    // Сетка: с понедельника недели, в которую попадает 1-е число, до воскресенья последней недели
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
    const last = new Date(y, m + 1, 0);
    const end = new Date(y, m, last.getDate() + (6 - ((last.getDay() + 6) % 7)));
    const cells = [];
    let closedCount = 0;
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const inMonth = d.getMonth() === m;
      const isToday = sameDay(d, today);
      const closed = inMonth && isClosed(d);
      if (closed) closedCount++;
      const sel = sameDay(d, state.selected) && !isToday;
      cells.push(`<button type="button" class="cd${inMonth ? '' : ' out'}${isToday ? ' today' : ''}${sel ? ' sel' : ''}" data-d="${d.getFullYear()}-${d.getMonth()}-${d.getDate()}">
        <span>${d.getDate()}</span>${isToday ? `<i class="cd-ico">${icon('calToday')}</i>` : closed ? `<i class="cd-ok">${icon('check')}</i>` : ''}</button>`);
    }
    $('[data-days]').innerHTML = cells.join('');
    $('[data-closed]').textContent = closedCount;

    // Отчёт за выбранный день
    const day = state.selected;
    $('[data-sel]').textContent = longDate(day);
    $('[data-badge]').innerHTML = sameDay(day, today)
      ? `<span class="badge now">${icon('calToday')}Сегодня</span>`
      : isClosed(day) ? `<span class="badge closed">${icon('check')}Закрыт</span>` : '';
    const [from, to] = dayRange(day);
    const ops = await db.range(STORES.operations, 'ts', from, to);
    let inc = 0, exp = 0;
    for (const o of ops) {
      if (o.type === 'income' && o.status !== 'expected') inc += o.amount;
      if (o.type === 'expense') exp += o.amount;
    }
    const bal = Math.round((inc - exp) * 100) / 100;
    $('[data-in]').textContent = money(inc, '+');
    $('[data-out]').textContent = money(exp, '-');
    const be = $('[data-bal]');
    be.textContent = money(bal, bal > 0 ? '+' : bal < 0 ? '-' : '');
    be.className = bal < 0 ? 'neg' : 'pos';
  },

  tick(host) { this.refresh(host); },
};

/* ---------- Подробный отчёт за день ---------- */
async function openReport(day) {
  const today = financialDay();
  const readOnly = isClosed(day);
  const [from, to] = dayRange(day);
  const ops = (await db.range(STORES.operations, 'ts', from, to))
    .filter(o => o.type === 'income' || o.type === 'expense')
    .sort((a, b) => a.ts - b.ts);
  let inc = 0, exp = 0, wait = 0;
  for (const o of ops) {
    if (o.type === 'income') { if (o.status === 'expected') wait += o.amount; else inc += o.amount; }
    else exp += o.amount;
  }
  const bal = inc - exp;
  const body = h(`<div class="rep">
    <p class="ro-note">${sameDay(day, today) ? 'Сегодня — день открыт' : readOnly ? 'День закрыт — только просмотр' : 'Будущий день'}</p>
    <div class="card rep-sum">
      <div><span>Полученные доходы</span><b class="pos">${money(inc, '+')}</b></div>
      ${wait ? `<div><span>Ожидаемые доходы</span><b class="wait">${money(wait, '+')}</b></div>` : ''}
      <div><span>Расходы</span><b class="neg">${money(exp, '-')}</b></div>
      <div><span>Баланс за день</span><b class="${bal < 0 ? 'neg' : 'pos'}">${money(bal, bal > 0 ? '+' : bal < 0 ? '-' : '')}</b></div>
      <div><span>Операций</span><b>${ops.length}</b></div>
    </div>
    <div class="day-head">Операции</div>
    <ul class="op-list card rep-list">${ops.length ? ops.map(o => {
      const expected = o.type === 'income' && o.status === 'expected';
      return `<li><button class="rep-row" data-op="${o.id}" type="button">
        <span class="op-ico">${icon(opIcon(o))}</span>
        <span class="op-main"><div class="op-title">${esc(o.title)}</div><div class="op-sub">${hhmm(new Date(o.ts))}${expected ? ' · Ожидается' : ''}${origLabel(o) ? ' · ' + origLabel(o) : ''}</div>${o.note ? `<div class="cd-note">${esc(o.note)}</div>` : ''}</span>
        <span class="op-amt ${expected ? 'wait' : o.type === 'income' ? 'pos' : 'neg'}">${money(o.amount, o.type === 'income' ? '+' : '-')}</span>
      </button></li>`;
    }).join('') : '<li class="empty compact">Операций за этот день нет</li>'}</ul>
  </div>`);
  body.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => {
    const op = ops.find(o => o.id === b.dataset.op);
    // Расходы закрытого дня откроются только для просмотра (это проверяет сама форма расхода)
    if (op) openOperation(op);
  }));
  openSheet(`Отчёт: ${longDate(day)}`, body);
}
