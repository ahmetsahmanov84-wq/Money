// Формы: доход, расход, долг; карточка перевода. Поля и порядок — по ТЗ модуля «Главная».
import { db, STORES } from './db.js';
import { icon } from './icons.js';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, addCategory, updateCategory, removeCategory } from './categories.js';
import { money, parseAmount, formatAmountInput, toDateInput, hhmm, fromInputs, longDate, financialDay, isOpenDay, CURRENCIES, baseCurrency, toTry, origLabel } from './format.js';
import { openSheet, closeSheet, toast, h, esc } from './ui.js';

function fv(form, n) { return form.querySelector(`[name=${n}]`); }

/** Выбор валюты рядом с суммой: ₺ ₽ $ € */
export function curSelect(cur = baseCurrency(), name = 'cur') {
  return `<select class="cur-sel" name="${name}" aria-label="Валюта">${Object.entries(CURRENCIES).map(([k, c]) =>
    `<option value="${k}"${k === cur ? ' selected' : ''}>${c.sym}</option>`).join('')}</select>`;
}
/** Поле суммы. rec — существующая запись: показываем исходную сумму и валюту. */
export function amountField(rec = null, label = 'Сумма') {
  const cur = rec ? (rec.currency || 'TRY') : baseCurrency();
  const value = rec ? (rec.origAmount ?? rec.amount) : '';
  return `<div class="field"><label>${label}</label>
    <div class="amount-wrap"><input class="input" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${value ? esc(formatAmountInput(String(value).replace('.', ','))) : ''}">${curSelect(cur)}</div></div>`;
}
/** Читает сумму и валюту, переводит в лиры. При неизменной сумме и валюте сохраняет прежний пересчёт. */
export function readMoney(form, rec = null) {
  const orig = parseAmount(form.querySelector('[name=amount]').value);
  const currency = form.querySelector('[name=cur]').value;
  if (!(orig > 0)) return { amount: NaN };
  const same = rec && (rec.currency || 'TRY') === currency && (rec.origAmount ?? rec.amount) === orig;
  return { amount: same ? rec.amount : (currency === 'TRY' ? orig : toTry(orig, currency)), origAmount: orig, currency };
}
function titleField(value, placeholder) {
  return `<div class="field"><label>Название</label>
    <input class="input" name="title" maxlength="60" placeholder="${esc(placeholder)}" value="${esc(value || '')}"></div>`;
}
function dateFields(d, label = 'Дата') {
  return `<div class="field row2">
    <div><label class="field-label">${label}</label><input class="input" type="date" name="date" value="${toDateInput(d)}" required></div>
    <div><label class="field-label">Время</label><input class="input" type="time" name="time" value="${hhmm(d)}"></div></div>`;
}
function noteField(value) {
  return `<div class="field"><label>Комментарий</label><textarea class="input" name="note" maxlength="300" placeholder="Необязательно">${esc(value || '')}</textarea></div>`;
}
function seg(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options.map(([v, l]) =>
    `<button type="button" data-v="${v}"${v === value ? ' class="on"' : ''}>${l}</button>`).join('')}</div>`;
}
function wireSeg(form, name) {
  const box = form.querySelector(`[data-seg="${name}"]`);
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  }));
  return () => box.querySelector('.on').dataset.v;
}
export function wireAmount(form) {
  const inp = fv(form, 'amount');
  inp.addEventListener('input', () => {
    const pos = inp.value.length - inp.selectionStart;
    inp.value = formatAmountInput(inp.value);
    const p = Math.max(0, inp.value.length - pos);
    try { inp.setSelectionRange(p, p); } catch (_) {}
  });
  return inp;
}
/** Дата + текущее время */
function stampFor(day) {
  const now = new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), now.getHours(), now.getMinutes());
}
function readStamp(form) {
  const d = fv(form, 'date').value;
  return d ? fromInputs(d, fv(form, 'time').value).getTime() : NaN;
}

/* ---------- Доход ---------- */
export function incomeForm(day, existing = null, opts = {}) {
  const d = existing ? new Date(existing.ts) : stampFor(day);
  const form = h(`<form novalidate>
    ${titleField(existing?.title || opts.title, 'Например: Аренда (Бейликдюзю)')}
    ${amountField(existing)}
    ${dateFields(d)}
    <div class="field"><span class="field-label">Статус</span>${seg('status', [['received', 'Получен'], ['expected', 'Ожидается']], existing?.status || 'received')}</div>
    ${noteField(existing?.note)}
    <p class="form-error"></p>
    <button class="btn-primary" type="submit">Сохранить</button>
    ${existing ? `<button class="btn-danger" type="button" data-del>Удалить операцию</button>` : ''}
  </form>`);
  const amountInp = wireAmount(form);
  const getStatus = wireSeg(form, 'status');
  const err = form.querySelector('.form-error');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const title = fv(form, 'title').value.trim();
    const m = readMoney(form, existing); const amount = m.amount;
    const ts = readStamp(form);
    if (!title) { err.textContent = 'Укажите название'; fv(form, 'title').focus(); return; }
    if (!(amount > 0)) { err.textContent = 'Введите сумму больше нуля'; amountInp.focus(); return; }
    if (isNaN(ts)) { err.textContent = 'Укажите дату'; return; }
    await db.put(STORES.operations, {
      ...(existing || {}), type: 'income', title, ...m, ts,
      status: getStatus(), note: fv(form, 'note').value.trim(),
    });
    closeSheet();
    toast(existing ? 'Изменения сохранены' : 'Доход сохранён');
  });
  wireDelete(form, existing, STORES.operations);
  openSheet(existing ? 'Доход' : 'Новый доход', form);
}

/* ---------- Расход ---------- */
// Расходы добавляются и редактируются только в текущем финансовом дне.
// В 00:00 (начало финансового дня) прошлый день закрывается и доступен только для просмотра.
export function expenseForm(day, existing = null, opts = {}) {
  const readOnly = !!existing && !isOpenDay(existing.ts);
  const ts0 = existing ? existing.ts : Date.now();
  const d = new Date(ts0);
  const sel = existing ? existing.categoryId : (opts.categoryId || EXPENSE_CATEGORIES[0].id);
  const dis = readOnly ? ' disabled' : '';
  const form = h(`<form novalidate class="${readOnly ? 'readonly' : ''}">
    ${readOnly ? `<div class="detail-amt neg">${money(existing.amount, '-')}</div>${origLabel(existing) ? `<p class="ro-note">Введено: ${origLabel(existing)}</p>` : ''}<p class="ro-note">День закрыт — расход доступен только для просмотра</p>` : ''}
    <div class="field" style="margin-top:.2rem"><span class="field-label">Категория</span><div class="cat-grid">
      ${EXPENSE_CATEGORIES.map(c => `<button type="button" class="cat${c.id === sel ? ' sel' : ''}" data-cat="${c.id}"${dis}><span class="op-ico">${icon(c.icon)}</span>${esc(c.name)}</button>`).join('')}
    </div></div>
    <div class="field"><label>Название / описание</label>
      <input class="input" name="title" maxlength="60" placeholder="Например: Продукты на неделю" value="${esc(existing?.title || '')}"${dis}></div>
    ${amountField(existing).replace('autocomplete="off"', 'autocomplete="off"' + dis).replace('<select', '<select' + dis)}
    <div class="field"><span class="field-label">Дата</span><div class="input static">${isOpenDay(ts0) ? 'Сегодня, ' : ''}${longDate(financialDay(d))}${existing ? ', ' + hhmm(d) : ''}</div></div>
    ${noteField(existing?.note).replace('<textarea', '<textarea' + dis)}
    <p class="form-error"></p>
    ${readOnly ? '' : `<button class="btn-primary${opts.compact ? ' short' : ''}" type="submit">Сохранить</button>`}
    ${existing && !readOnly ? `<button class="btn-danger" type="button" data-del>Удалить операцию</button>` : ''}
    ${!existing && opts.compact && EXPENSE_CATEGORIES.find(c => c.id === sel)?.custom ? `<button class="btn-ghost wide" type="button" data-editcat>Изменить категорию</button>` : ''}
  </form>`);
  form.querySelector('[data-editcat]')?.addEventListener('click', () => categoryForm(EXPENSE_CATEGORIES.find(c => c.id === sel)));
  if (!readOnly) {
    form.querySelectorAll('.cat').forEach(b => b.addEventListener('click', () => {
      form.querySelectorAll('.cat').forEach(x => x.classList.toggle('sel', x === b));
    }));
    const amountInp = wireAmount(form);
    const err = form.querySelector('.form-error');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      // День мог закрыться, пока форма была открыта
      if (existing && !isOpenDay(existing.ts)) { err.textContent = 'День уже закрыт, изменения недоступны'; return; }
      const categoryId = form.querySelector('.cat.sel').dataset.cat;
      const cat = EXPENSE_CATEGORIES.find(c => c.id === categoryId);
      const m = readMoney(form, existing);
      if (!(m.amount > 0)) { err.textContent = 'Введите сумму больше нуля'; amountInp.focus(); return; }
      await db.put(STORES.operations, {
        ...(existing || {}), type: 'expense', categoryId, ...m,
        ts: existing ? existing.ts : Date.now(),
        title: fv(form, 'title').value.trim() || cat.name,
        note: fv(form, 'note').value.trim(),
      });
      closeSheet();
      toast(existing ? 'Изменения сохранены' : `Расход сохранён: ${cat.name}`);
    });
    wireDelete(form, existing, STORES.operations);
  }
  openSheet(existing ? 'Расход' : 'Новый расход', form);
}

/* ---------- Своя категория расхода ---------- */
export function categoryForm(existing = null) {
  let chosen = existing?.icon || 'dots';
  const form = h(`<form novalidate>
    <div class="field"><label>Название категории</label>
      <input class="input" name="cname" maxlength="40" placeholder="Например: Автомобиль" value="${esc(existing?.name || '')}"></div>
    <div class="field"><span class="field-label">Значок</span><div class="icon-grid">
      ${CATEGORY_ICONS.map(n => `<button type="button" class="ig${n === chosen ? ' sel' : ''}" data-ic="${n}" aria-label="${n}"><span class="op-ico">${icon(n)}</span></button>`).join('')}
    </div></div>
    <p class="form-error"></p>
    <button class="btn-primary" type="submit">${existing ? 'Сохранить' : 'Добавить категорию'}</button>
    ${existing ? `<button class="btn-danger" type="button" data-delcat>Удалить категорию</button>` : ''}
  </form>`);
  const err = form.querySelector('.form-error');
  form.querySelectorAll('.ig').forEach(b => b.addEventListener('click', () => {
    chosen = b.dataset.ic;
    form.querySelectorAll('.ig').forEach(x => x.classList.toggle('sel', x === b));
  }));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = fv(form, 'cname').value;
    const r = existing ? await updateCategory(existing.id, name, chosen) : await addCategory(name, chosen);
    if (r.error) { err.textContent = r.error; fv(form, 'cname').focus(); return; }
    closeSheet();
    toast(existing ? 'Категория сохранена' : `Категория добавлена: ${r.cat.name}`);
  });
  const del = form.querySelector('[data-delcat]');
  del?.addEventListener('click', async () => {
    const used = (await db.all(STORES.operations)).some(o => o.type === 'expense' && o.categoryId === existing.id);
    if (used) { err.textContent = 'В этой категории есть расходы. Удалить можно только пустую категорию.'; return; }
    if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'Нажмите ещё раз для удаления'; return; }
    await removeCategory(existing.id);
    await db.del(STORES.limits, existing.id).catch(() => {});
    closeSheet();
    toast('Категория удалена');
  });
  openSheet(existing ? 'Категория' : 'Новая категория', form);
  if (!existing) setTimeout(() => fv(form, 'cname').focus(), 350);
}

/* ---------- Перевод ---------- */
// Два внутренних счёта: «Основной» и «Накопление». Перевод не меняет доходы и расходы.
export const ACCOUNTS = { main: 'Основной', savings: 'Накопление' };

export async function savingsBalance() {
  const ops = await db.all(STORES.operations);
  let bal = 0;
  for (const o of ops) if (o.type === 'transfer') bal += o.to === 'savings' ? o.amount : -o.amount;
  return Math.round(bal * 100) / 100;
}

export async function transferForm() {
  const bal = await savingsBalance();
  const recent = (await db.all(STORES.operations)).filter(o => o.type === 'transfer').sort((a, b) => b.ts - a.ts).slice(0, 5);
  const form = h(`<form novalidate>
    <div class="detail-amt">${money(bal)}</div>
    <p class="ro-note">На счёте «Накопление»</p>
    <div class="field">${seg('dir', [['to-savings', 'В Накопление'], ['to-main', 'В Основной']], 'to-savings')}</div>
    ${amountField()}
    ${noteField()}
    <p class="form-error"></p>
    <button class="btn-primary" type="submit">${icon('swap')} Перевести</button>
    ${recent.length ? `<div class="day-head">Последние переводы</div><ul class="op-list card" style="padding:.2rem .8rem">${recent.map(t => `<li class="tr-row"><span>${t.to === 'savings' ? 'Основной → Накопление' : 'Накопление → Основной'}<small>${longDate(new Date(t.ts))}, ${hhmm(new Date(t.ts))}</small></span><b>${money(t.amount)}</b></li>`).join('')}</ul>` : ''}
  </form>`);
  const getDir = wireSeg(form, 'dir');
  const amountInp = wireAmount(form);
  const err = form.querySelector('.form-error');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const m = readMoney(form); const amount = m.amount;
    if (!(amount > 0)) { err.textContent = 'Введите сумму больше нуля'; amountInp.focus(); return; }
    const toSavings = getDir() === 'to-savings';
    if (!toSavings && amount > await savingsBalance()) { err.textContent = 'На счёте «Накопление» недостаточно средств'; return; }
    await db.put(STORES.operations, {
      type: 'transfer', ...m, ts: Date.now(),
      from: toSavings ? 'main' : 'savings', to: toSavings ? 'savings' : 'main',
      title: toSavings ? 'Перевод в Накопление' : 'Перевод в Основной',
      note: fv(form, 'note').value.trim(),
    });
    closeSheet();
    toast('Перевод выполнен');
  });
  openSheet('Перевод', form);
}

/* ---------- Долг ---------- */
// Долг хранится в STORES.debts, каждый возврат — отдельной записью в STORES.debtReturns.
// Ни долг, ни возвраты не попадают в доходы и расходы.
export function debtForm(day, existing = null, opts = {}) {
  const d = existing ? new Date(existing.ts) : stampFor(day);
  const dir = existing ? existing.direction : (opts.direction || 'given');
  const form = h(`<form novalidate>
    <div style="margin-top:.2rem">${seg('direction', [['given', 'Я дал'], ['taken', 'Я взял']], dir)}</div>
    <div class="field"><label>Имя</label><input class="input" name="name" maxlength="40" placeholder="Например: Али" autocomplete="off" value="${esc(existing?.name || '')}"></div>
    ${amountField(existing)}
    <div class="field row2" style="grid-template-columns:1fr 1fr">
      <div><label class="field-label">Дата выдачи</label><input class="input" type="date" name="date" value="${toDateInput(d)}"></div>
      <div><label class="field-label">Плановый возврат</label><input class="input" type="date" name="due" value="${existing?.dueTs ? toDateInput(new Date(existing.dueTs)) : ''}"></div>
    </div>
    <label class="switch-row field"><span>Деньги переданы</span><input type="checkbox" name="transferred"${!existing || existing.transferred ? ' checked' : ''}><span class="switch"></span></label>
    ${noteField(existing?.note)}
    <p class="form-error"></p>
    <button class="btn-primary" type="submit">Сохранить</button>
  </form>`);
  const getDir = wireSeg(form, 'direction');
  const amountInp = wireAmount(form);
  const err = form.querySelector('.form-error');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = fv(form, 'name').value.trim();
    const m = readMoney(form, existing); const amount = m.amount;
    const dateStr = fv(form, 'date').value;
    const dueStr = fv(form, 'due').value;
    const transferred = fv(form, 'transferred').checked;
    if (!name) { err.textContent = 'Укажите имя'; fv(form, 'name').focus(); return; }
    if (!(amount > 0)) { err.textContent = 'Введите сумму больше нуля'; amountInp.focus(); return; }
    if (!dateStr) { err.textContent = 'Укажите дату выдачи'; return; }
    const keepTime = existing ? hhmm(new Date(existing.ts)) : hhmm(new Date());
    const ts = fromInputs(dateStr, keepTime).getTime();
    const dueTs = dueStr ? fromInputs(dueStr, '00:00').getTime() : null;
    if (dueTs && dueTs < fromInputs(dateStr, '00:00').getTime()) { err.textContent = 'Дата возврата раньше даты выдачи'; return; }
    if (existing) {
      const returned = (await db.range(STORES.debtReturns, 'debtId', existing.id, existing.id + '￿')).filter(r => r.debtId === existing.id).reduce((s, r) => s + r.amount, 0);
      if (amount < returned) { err.textContent = `Сумма не может быть меньше уже возвращённой (${money(returned)})`; return; }
      if (!transferred && returned > 0) { err.textContent = 'По долгу уже есть возвраты'; return; }
    }
    const rec = {
      ...(existing || {}), direction: getDir(), name, ...m, ts, dueTs, transferred,
      transferredTs: transferred ? (existing?.transferredTs || Date.now()) : null,
      note: fv(form, 'note').value.trim(),
    };
    delete rec.status; delete rec.returned;
    await db.put(STORES.debts, rec);
    closeSheet();
    toast(existing ? 'Изменения сохранены' : 'Долг сохранён');
    if (opts.onSaved) opts.onSaved(rec);
  });
  openSheet(existing ? 'Изменить долг' : 'Новый долг', form);
}

function wireDelete(form, existing, store) {
  const btn = form.querySelector('[data-del]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'Нажмите ещё раз для удаления';
      setTimeout(() => { if (btn.isConnected) { btn.classList.remove('confirm'); btn.textContent = 'Удалить операцию'; } }, 3500);
      return;
    }
    await db.del(store, existing.id);
    closeSheet();
    toast('Операция удалена');
  });
}

/** Детали операции (просмотр и правка) */
export function openOperation(op) {
  if (op.type === 'income') return incomeForm(new Date(op.ts), op);
  if (op.type === 'expense') return expenseForm(new Date(op.ts), op);
}

/* ---------- Полная история ---------- */
export async function allOperationsSheet(renderRow) {
  const ops = (await db.all(STORES.operations))
    .filter(o => o.type === 'income' || o.type === 'expense')
    .sort((a, b) => b.ts - a.ts);
  const body = h(`<div></div>`);
  if (!ops.length) {
    body.innerHTML = `<div class="empty"><b>Операций пока нет</b></div>`;
  } else {
    let lastDay = '';
    const parts = [];
    for (const op of ops) {
      const day = longDate(financialDay(new Date(op.ts)));
      if (day !== lastDay) {
        if (parts.length) parts.push('</ul>');
        parts.push(`<div class="day-head">${day}</div><ul class="op-list card" style="padding:0 .6rem">`);
        lastDay = day;
      }
      parts.push(renderRow(op));
    }
    parts.push('</ul>');
    body.innerHTML = parts.join('');
    body.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => {
      const op = ops.find(o => o.id === b.dataset.op);
      if (op) openOperation(op);
    }));
  }
  openSheet('Все операции', body);
}
