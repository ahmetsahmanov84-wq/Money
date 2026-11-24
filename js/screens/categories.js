// Экран «Категории» (только расходы; вкладка «Доходы» убрана по решению пользователя 24.11.2026)
import { db, STORES } from '../db.js';
import { icon, logo } from '../icons.js';
import { EXPENSE_CATEGORIES } from '../categories.js';
import { money, dayRange, financialDay, pct } from '../format.js';
import { esc } from '../ui.js';
import { expenseForm, categoryForm, deleteCategory } from '../forms.js';
import { toast } from '../ui.js';

let editMode = false;

function expenseRow(c, spent = 0, limit = 0, share = '0%') {
  const over = limit > 0 && spent > limit;
  return `<li><button class="crow" data-cat="${c.id}">
    <span class="op-ico">${icon(c.icon)}</span>
    <span class="op-main"><div class="op-title">${esc(c.name)}</div><div class="op-sub${over ? ' over' : ''}">${limit ? `Лимит ${money(limit)}` : 'Лимит не задан'}${over ? ' · превышен' : ''}</div></span>
    <span class="op-amt neg">${money(spent, '-')}</span>
    <span class="pct">${share}</span>
    ${editMode ? `<span class="crow-del" aria-label="Удалить">${icon('trash')}</span>` : `<span class="op-chev">${icon('chevR')}</span>`}
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
      <div class="cat-actions">
        <button class="btn-ghost add-cat" type="button" data-addcat>${icon('plus')}<span>Добавить</span></button>
        <button class="btn-ghost add-cat del-mode" type="button" data-delmode>${icon('trash')}<span>Удалить</span></button>
      </div>
      <p class="hint cat-hint" data-delhint hidden>Нажмите на категорию, затем ещё раз для подтверждения. Расходы удалённой категории останутся в истории и отчётах.</p>
    </section>`;
    host.querySelector('.back').onclick = () => ctx.back();
    host.querySelector('[data-list]').addEventListener('click', e => {
      const row = e.target.closest('.crow');
      if (!row) return;
      if (!editMode) return expenseForm(financialDay(), null, { categoryId: row.dataset.cat, compact: true });
      if (!row.classList.contains('confirm')) {
        host.querySelectorAll('.crow.confirm').forEach(r => r.classList.remove('confirm'));
        row.classList.add('confirm'); toast('Нажмите ещё раз, чтобы удалить');
        setTimeout(() => row.isConnected && row.classList.remove('confirm'), 3500);
        return;
      }
      const name = row.querySelector('.op-title').textContent;
      deleteCategory(row.dataset.cat).then(() => toast(`Категория удалена: ${name}`));
    });
    host.querySelector('[data-addcat]').onclick = () => categoryForm();
    const dm = host.querySelector('[data-delmode]');
    const syncMode = () => {
      dm.classList.toggle('on', editMode);
      dm.querySelector('span').textContent = editMode ? 'Готово' : 'Удалить';
      host.querySelector('[data-delhint]').hidden = !editMode;
    };
    dm.onclick = () => { editMode = !editMode; syncMode(); this.refresh(host); };
    editMode = false; syncMode();
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
    list.innerHTML = !EXPENSE_CATEGORIES.length ? '<li class="empty compact">Категорий нет. Нажмите «Добавить»</li>' : EXPENSE_CATEGORIES.map(c => expenseRow(c, spent[c.id] || 0, limitOf(c.id), pct(spent[c.id] || 0, total))).join('');
  },

  tick(host) { this.refresh(host); },
};
