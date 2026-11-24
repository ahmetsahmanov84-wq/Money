// Экран «Категории» (только расходы; вкладка «Доходы» убрана по решению пользователя 24.11.2026)
import { db, STORES } from '../db.js';
import { icon, logo } from '../icons.js';
import { EXPENSE_CATEGORIES } from '../categories.js';
import { money, dayRange, financialDay, pct } from '../format.js';
import { esc } from '../ui.js';
import { expenseForm, categoryForm } from '../forms.js';

function expenseRow(c, spent = 0, limit = 0, share = '0%') {
  const over = limit > 0 && spent > limit;
  return `<li><button class="crow" data-cat="${c.id}">
    <span class="op-ico">${icon(c.icon)}</span>
    <span class="op-main"><div class="op-title">${esc(c.name)}</div><div class="op-sub${over ? ' over' : ''}">${limit ? `Лимит ${money(limit)}` : 'Лимит не задан'}${over ? ' · превышен' : ''}</div></span>
    <span class="op-amt neg">${money(spent, '-')}</span>
    <span class="pct">${share}</span>
    <span class="op-chev">${icon('chevR')}</span>
  </button></li>`;
}

export const categories = {
  id: 'categories',
  render(host, ctx) {
    // Список из восьми категорий выводится сразу, до загрузки данных
    host.innerHTML = `<section class="screen categories">
      <header class="hero">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1>Категории</h1>
        <p class="sub">Управление расходами по категориям</p>
        <img class="hero-img bag" src="assets/img/hero-categories.png" alt="" width="532" height="308">
      </header>
      <div class="card cat-card"><ul class="op-list" data-list>${EXPENSE_CATEGORIES.map(c => expenseRow(c)).join('')}</ul></div>
      <button class="btn-ghost wide add-cat" type="button" data-addcat>${icon('plus')}<span>Добавить категорию</span></button>
    </section>`;
    host.querySelector('.back').onclick = () => ctx.back();
    host.querySelector('[data-list]').addEventListener('click', e => {
      const row = e.target.closest('.crow');
      if (row) expenseForm(financialDay(), null, { categoryId: row.dataset.cat, compact: true });
    });
    host.querySelector('[data-addcat]').onclick = () => categoryForm();
    return this.refresh(host);
  },

  async refresh(host) {
    const list = host.querySelector('[data-list]');
    if (!list || !host.querySelector('.categories')) return;
    // Период — текущий финансовый день; месячные итоги — во вкладке «Аналитика»
    const [from, to] = dayRange(financialDay());
    const ops = await db.range(STORES.operations, 'ts', from, to);
    const limits = await db.all(STORES.limits);
    const limitOf = id => (limits.find(l => l.id === id) || {}).amount || 0;
    const spent = {};
    let total = 0;
    for (const o of ops) if (o.type === 'expense') { spent[o.categoryId] = (spent[o.categoryId] || 0) + o.amount; total += o.amount; }
    list.innerHTML = EXPENSE_CATEGORIES.map(c => expenseRow(c, spent[c.id] || 0, limitOf(c.id), pct(spent[c.id] || 0, total))).join('');
  },

  tick(host) { this.refresh(host); },
};
