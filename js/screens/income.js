// Экран «Доходы»
import { db, STORES } from '../db.js';
import { icon, logo } from '../icons.js';
import { money, monthRange, monthTitle, financialDay, shortDate, hhmm, origLabel } from '../format.js';
import { esc } from '../ui.js';
import { incomeForm, openOperation } from '../forms.js';

const state = { month: null };

/** Иконка дохода на этом экране — как в макете: аренда — дом, обучение — шапочка, остальное — кейс */
function incomeIcon(title) {
  const t = title || '';
  if (/аренд/i.test(t)) return 'house';
  if (/обучен|урок|курс/i.test(t)) return 'cap';
  return 'briefcase';
}

function row(op) {
  const d = new Date(op.ts);
  const expected = op.status === 'expected';
  return `<li><button class="op" data-op="${op.id}">
    <span class="op-ico">${icon(incomeIcon(op.title))}</span>
    <span class="op-main"><div class="op-title">${esc(op.title)}</div>
      <div class="op-sub">${shortDate(d)}, ${hhmm(d)}${origLabel(op) ? ' · ' + origLabel(op) : ''}</div></span>
    <span class="amt-col"><span class="op-amt ${expected ? 'wait' : 'pos'}">${money(op.amount, '+')}</span><span class="st ${expected ? 'st-wait' : 'st-ok'}">${expected ? 'Ожидается' : 'Получен'}</span></span>
    <span class="op-chev">${icon('chevR')}</span>
  </button></li>`;
}

export const income = {
  id: 'income',
  render(host, ctx) {
    if (!state.month) { const t = financialDay(); state.month = new Date(t.getFullYear(), t.getMonth(), 1); }
    host.innerHTML = `<section class="screen income">
      <header class="hero">
        <div class="brand brand-indent">${logo()}<span>Money Tracker</span></div>
        <h1>Доходы</h1>
        <p class="sub">Учёт всех поступлений</p>
        <img class="hero-img coins" src="assets/img/hero-income.png" alt="" width="640" height="312">
      </header>

      <div class="datebar">
        <button class="nav-btn" data-prev aria-label="Предыдущий месяц">${icon('chevL')}</button>
        <div class="date-label">${icon('calendar')}<span data-month></span></div>
        <button class="nav-btn" data-next aria-label="Следующий месяц">${icon('chevR')}</button>
      </div>

      <div class="card inc-total">
        <span class="inc-ico">${icon('trend')}</span>
        <div class="inc-main">
          <div class="inc-label">Общий доход</div>
          <div class="inc-val pos" data-total>${money(0)}</div>
          <div class="inc-exp" data-expected></div>
        </div>
      </div>

      <button class="btn-primary inc-add" type="button" data-add>${icon('plus')} Добавить доход</button>

      <div class="card ops inc-list"><ul class="op-list" data-list></ul></div>
    </section>`;
    const $ = s => host.querySelector(s);
    $('[data-prev]').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); this.refresh(host); };
    $('[data-next]').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); this.refresh(host); };
    $('[data-add]').onclick = () => {
      // По умолчанию — сегодня, если выбран текущий месяц, иначе 1-е число выбранного месяца
      const today = financialDay();
      const inMonth = today.getFullYear() === state.month.getFullYear() && today.getMonth() === state.month.getMonth();
      incomeForm(inMonth ? today : state.month);
    };
    $('[data-list]').addEventListener('click', async e => {
      const b = e.target.closest('[data-op]');
      if (!b) return;
      const op = await db.get(STORES.operations, b.dataset.op);
      if (op) openOperation(op);
    });
    return this.refresh(host);
  },

  async refresh(host) {
    const $ = s => host.querySelector(s);
    if (!$('.income')) return;
    $('[data-month]').textContent = monthTitle(state.month);
    const [from, to] = monthRange(state.month);
    const ops = (await db.range(STORES.operations, 'ts', from, to))
      .filter(o => o.type === 'income')
      .sort((a, b) => b.ts - a.ts);
    let received = 0, expected = 0;
    for (const o of ops) { if (o.status === 'expected') expected += o.amount; else received += o.amount; }
    $('[data-total]').textContent = money(received, '+');
    $('[data-expected]').innerHTML = `Ожидается: <b>${money(expected, '+')}</b>`;
    $('[data-list]').innerHTML = ops.length
      ? ops.map(row).join('')
      : `<li class="empty compact">Доходов за этот месяц пока нет</li>`;
  },

  tick(host) { this.refresh(host); },
};
