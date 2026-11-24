// Экран «Главная»
import { db, STORES } from '../db.js';
import { icon, logo } from '../icons.js';
import { opIcon } from '../categories.js';
import { money, longDate, relativeStamp, dayRange, addDays, financialDay, sameDay, origLabel } from '../format.js';
import { esc, fitText } from '../ui.js';
import { incomeForm, expenseForm, transferForm, debtForm, openOperation, allOperationsSheet } from '../forms.js';

const state = { day: null, followToday: true };

export function opRow(op) {
  const expected = op.type === 'income' && op.status === 'expected';
  const sign = op.type === 'income' ? '+' : '-';
  const cls = expected ? 'wait' : op.type === 'income' ? 'pos' : 'neg';
  return `<li><button class="op" data-op="${op.id}">
    <span class="op-ico">${icon(opIcon(op))}</span>
    <span class="op-main"><div class="op-title">${esc(op.title)}</div><div class="op-sub">${expected ? 'Ожидается · ' : ''}${relativeStamp(op.ts)}${origLabel(op) ? ' · ' + origLabel(op) : ''}</div></span>
    <span class="op-amt ${cls}">${money(op.amount, sign)}</span>
    <span class="op-chev">${icon('chevR')}</span>
  </button></li>`;
}

export const home = {
  id: 'home',
  render(host, ctx) {
    if (!state.day) state.day = financialDay();
    host.innerHTML = `<section class="screen home">
      <header class="hero">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1>Главная</h1>
        <p class="sub">Обзор финансов</p>
        <img class="hero-img" src="assets/img/hero-home.png" alt="" width="668" height="320">
      </header>

      <div class="datebar">
        <button class="nav-btn" data-prev aria-label="Предыдущий день">${icon('chevL')}</button>
        <button class="date-label" data-cal aria-label="Календарь отчётов">${icon('calendar')}<span data-date></span></button>
        <button class="nav-btn" data-next aria-label="Следующий день">${icon('chevR')}</button>
      </div>

      <div class="card summary">
        <div class="sum-col"><span class="sum-ico in">${icon('arrowDown')}</span><span class="sum-label">Доходы</span><span class="sum-val pos" data-in></span></div>
        <span class="sep"></span>
        <div class="sum-col"><span class="sum-ico out">${icon('arrowUp')}</span><span class="sum-label">Расходы</span><span class="sum-val neg" data-out></span></div>
        <span class="sep"></span>
        <div class="sum-col"><span class="sum-ico bal">${icon('scales')}</span><span class="sum-label">Баланс</span><span class="sum-val" data-bal></span></div>
      </div>

      <div class="card section">
        <h2>Быстрые действия</h2>
        <div class="qa-grid">
          <button class="qa" data-qa="income"><span class="qa-ico plus">${icon('plus')}</span>Доход</button>
          <button class="qa" data-qa="expense"><span class="qa-ico minus">${icon('minus')}</span>Расход</button>
          <button class="qa" data-qa="transfer"><span class="qa-ico swap">${icon('swap')}</span>Перевод</button>
          <button class="qa" data-qa="debt"><span class="qa-ico coins">${icon('coins')}</span>Долг</button>
        </div>
      </div>

      <div class="card ops">
        <div class="ops-head"><h2>Последние операции</h2><button class="link-more" data-all>См. все ${icon('chevR')}</button></div>
        <ul class="op-list" data-list></ul>
      </div>
    </section>`;

    const $ = s => host.querySelector(s);
    $('[data-prev]').onclick = () => { state.day = addDays(state.day, -1); state.followToday = false; this.refresh(host); };
    $('[data-next]').onclick = () => { state.day = addDays(state.day, 1); state.followToday = false; this.refresh(host); };
    $('[data-cal]').onclick = () => ctx.open('calendar', { day: state.day });
    $('[data-all]').onclick = () => allOperationsSheet(opRow);
    host.querySelectorAll('[data-qa]').forEach(b => b.onclick = () => {
      const t = b.dataset.qa;
      if (t === 'income') incomeForm(state.day);
      else if (t === 'expense') expenseForm(state.day);
      else if (t === 'transfer') transferForm();
      else debtForm(state.day);
    });
    $('[data-list]').addEventListener('click', async e => {
      const b = e.target.closest('[data-op]');
      if (!b) return;
      const op = await db.get(STORES.operations, b.dataset.op);
      if (op) openOperation(op);
    });
    return this.refresh(host);
  },

  /** Переход на новый финансовый день (полночь), если пользователь смотрит «сегодня» */
  tick(host) {
    const today = financialDay();
    if (state.followToday && !sameDay(today, state.day)) { state.day = today; this.refresh(host); }
  },

  setDay(day) { state.day = day; state.followToday = sameDay(day, financialDay()); },

  async refresh(host) {
    const $ = s => host.querySelector(s);
    if (!$('[data-date]')) return;
    if (sameDay(state.day, financialDay())) state.followToday = true;
    $('[data-date]').textContent = longDate(state.day);
    const [from, to] = dayRange(state.day);
    const ops = (await db.range(STORES.operations, 'ts', from, to))
      .filter(o => o.type === 'income' || o.type === 'expense')
      .sort((a, b) => b.ts - a.ts);
    // Баланс = полученные доходы − расходы; ожидаемые доходы не учитываются
    let inc = 0, exp = 0;
    for (const o of ops) {
      if (o.type === 'income' && o.status !== 'expected') inc += o.amount;
      else if (o.type === 'expense') exp += o.amount;
    }
    const bal = Math.round((inc - exp) * 100) / 100;
    $('[data-in]').textContent = money(inc, '+');
    $('[data-out]').textContent = money(exp, '-');
    const balEl = $('[data-bal]');
    balEl.textContent = money(bal, bal > 0 ? '+' : bal < 0 ? '-' : '');
    balEl.className = 'sum-val ' + (bal < 0 ? 'neg' : 'pos');
    host.querySelectorAll('.sum-val').forEach(el => fitText(el));

    const list = $('[data-list]');
    list.innerHTML = ops.length
      ? ops.slice(0, 3).map(opRow).join('')
      : `<li class="empty compact">Операций пока нет</li>`;
  },
};
