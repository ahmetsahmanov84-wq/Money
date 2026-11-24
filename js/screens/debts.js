// Экран «Долги»: выданные и полученные долги, частичные и полные возвраты.
import { db, STORES } from '../db.js';
import { icon, logo } from '../icons.js';
import { money, shortDate, longDate, hhmm, parseAmount, formatAmountInput, financialDay, origLabel } from '../format.js';
import { esc, h, openSheet, closeSheet, toast } from '../ui.js';
import { debtForm, curSelect, readMoney } from '../forms.js';

const state = { tab: 'given' };

const TXT = {
  given: { issued: 'Выдан', total: 'Всего выдано', empty: 'Вы пока никому не давали в долг' },
  taken: { issued: 'Взят', total: 'Всего получено', empty: 'Вы пока ни у кого не брали в долг' },
};

/** Остаток = сумма долга − сумма всех возвратов */
export function debtState(debt, returns) {
  const rs = returns.filter(r => r.debtId === debt.id).sort((a, b) => a.ts - b.ts);
  const returned = Math.round(rs.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const remaining = Math.max(0, Math.round((debt.amount - returned) * 100) / 100);
  let status;
  if (!debt.transferred) status = 'notsent';
  else if (remaining <= 0) status = 'returned';
  else if (returned > 0) status = 'partial';
  else status = 'pending';
  return { returns: rs, returned, remaining, status };
}

const STATUS = {
  pending: ['st-pend', 'clock', 'Ожидается'],
  partial: ['st-part', 'clock', 'Частично возвращён'],
  returned: ['st-done', 'check', 'Возвращён'],
  notsent: ['st-none', 'clock', 'Не передан'],
};
const pill = st => { const [c, i, l] = STATUS[st]; return `<span class="pill ${c}">${icon(i)}<span>${l}</span></span>`; };

async function loadAll() {
  const [debts, returns] = await Promise.all([db.all(STORES.debts), db.all(STORES.debtReturns)]);
  return { debts, returns };
}

export const debts = {
  id: 'debts',
  render(host, ctx) {
    host.innerHTML = `<section class="screen debts">
      <header class="hero">
        <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
        <h1>Долги</h1>
        <p class="sub">Учёт долгов: выданные и полученные</p>
        <img class="hero-img hands" src="assets/img/hero-debts.png" alt="" width="600" height="312">
      </header>
      <div class="seg tabs">
        <button type="button" data-t="given">Я дал</button>
        <button type="button" data-t="taken">Я взял</button>
      </div>
      <div class="debt-add"><button class="btn-primary short" type="button" data-add>${icon('plus')} Добавить долг</button></div>
      <ul class="debt-list" data-list></ul>
      <div class="card debt-sum">
        <div><div class="ds-l" data-total-l></div><div class="ds-v" data-total></div></div>
        <span class="sep"></span>
        <div><div class="ds-l">Возвращено</div><div class="ds-v pos" data-ret></div></div>
        <span class="sep"></span>
        <div><div class="ds-l">Остаток</div><div class="ds-v rest" data-rest></div></div>
      </div>
    </section>`;
    const $ = s => host.querySelector(s);
    $('.back').onclick = () => ctx.back();
    host.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { state.tab = b.dataset.t; this.refresh(host); });
    $('[data-add]').onclick = () => debtForm(financialDay(), null, { direction: state.tab, onSaved: r => { state.tab = r.direction; } });
    $('[data-list]').addEventListener('click', e => { const b = e.target.closest('[data-debt]'); if (b) openDebt(b.dataset.debt); });
    return this.refresh(host);
  },

  async refresh(host) {
    const $ = s => host.querySelector(s);
    if (!$('.debts')) return;
    host.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === state.tab));
    const { debts: all, returns } = await loadAll();
    const list = all.filter(d => d.direction === state.tab).sort((a, b) => b.ts - a.ts);
    let total = 0, ret = 0, rest = 0;
    const rows = list.map(d => {
      const s = debtState(d, returns);
      if (d.transferred) { total += d.amount; ret += s.returned; rest += s.remaining; } // не переданные не учитываются
      return `<li><button class="card debt-card" data-debt="${d.id}">
        <span class="debt-ico">${icon('user')}</span>
        <span class="debt-main"><div class="debt-name">${esc(d.name)}</div><div class="op-sub">${TXT[state.tab].issued}: ${shortDate(new Date(d.ts))}</div></span>
        <span class="debt-amt"><b>${money(d.amount)}</b><small>Остаток ${money(s.remaining)}</small></span>
        ${pill(s.status)}
        <span class="op-chev">${icon('chevR')}</span>
      </button></li>`;
    });
    $('[data-list]').innerHTML = rows.length ? rows.join('') : `<li class="card empty compact">${TXT[state.tab].empty}</li>`;
    $('[data-total-l]').textContent = TXT[state.tab].total;
    $('[data-total]').textContent = money(total);
    $('[data-ret]').textContent = money(ret);
    $('[data-rest]').textContent = money(rest);
  },

  tick(host) { this.refresh(host); },
};

/* ---------- Подробности долга ---------- */
async function openDebt(id) {
  const debt = await db.get(STORES.debts, id);
  if (!debt) return;
  const returns = (await db.all(STORES.debtReturns)).filter(r => r.debtId === id);
  const s = debtState(debt, returns);
  const t = TXT[debt.direction];
  const body = h(`<div class="debt-detail">
    <div class="dd-top">${pill(s.status)}</div>
    <div class="detail-amt rest">${money(s.remaining)}</div>
    <p class="ro-note">Осталось вернуть из ${money(debt.amount)}${origLabel(debt) ? ` (введено: ${origLabel(debt)})` : ''}</p>
    <div class="card dd-info">
      <div><span>Тип</span><b>${debt.direction === 'given' ? 'Я дал' : 'Я взял'}</b></div>
      <div><span>${t.issued}</span><b>${longDate(new Date(debt.ts))}</b></div>
      <div><span>Плановый возврат</span><b>${debt.dueTs ? longDate(new Date(debt.dueTs)) : '—'}</b></div>
      <div><span>Деньги переданы</span><b>${debt.transferred ? 'Да' : 'Нет'}</b></div>
      ${debt.note ? `<div class="dd-note">${esc(debt.note)}</div>` : ''}
    </div>
    ${!debt.transferred ? `<button class="btn-primary" type="button" data-sent>${icon('check')} Деньги переданы</button>` : ''}
    ${debt.transferred && s.remaining > 0 ? `
      <div class="dd-actions">
        <button class="btn-ghost" type="button" data-part>Частичный возврат</button>
        <button class="btn-primary" type="button" data-full>${icon('check')} Вернул всё</button>
      </div>
      <form class="dd-part" data-partform hidden novalidate>
        <div class="field"><label>Сумма возврата</label>
          <div class="amount-wrap"><input class="input" name="amount" inputmode="decimal" autocomplete="off" placeholder="0">${curSelect()}</div></div>
        <p class="form-error"></p>
        <button class="btn-primary short" type="submit">Сохранить возврат</button>
      </form>` : ''}
    <div class="day-head">История возвратов</div>
    <ul class="op-list card dd-hist">${s.returns.length ? s.returns.slice().reverse().map(r => {
      const d = new Date(r.ts);
      return `<li class="dd-ret"><span><b>${r.full ? 'Полный возврат' : 'Частичный возврат'}</b><small>${longDate(d)}, ${hhmm(d)}</small></span><span class="pos">${money(r.amount)}${origLabel(r) ? `<small>${origLabel(r)}</small>` : ''}</span><button type="button" class="dd-del" data-delret="${r.id}" aria-label="Удалить возврат">${icon('trash')}</button></li>`;
    }).join('') : '<li class="empty compact">Возвратов пока нет</li>'}</ul>
    <button class="btn-ghost wide" type="button" data-edit>Изменить долг</button>
    <button class="btn-danger" type="button" data-deldebt>Удалить долг</button>
  </div>`);
  const $ = sel => body.querySelector(sel);

  $('[data-sent]')?.addEventListener('click', async () => {
    await db.put(STORES.debts, { ...debt, transferred: true, transferredTs: Date.now() });
    toast('Отмечено: деньги переданы'); openDebt(id);
  });
  $('[data-part]')?.addEventListener('click', () => {
    const f = $('[data-partform]'); f.hidden = !f.hidden;
    if (!f.hidden) setTimeout(() => f.querySelector('input').focus(), 50);
  });
  const pf = $('[data-partform]');
  if (pf) {
    const inp = pf.querySelector('input');
    inp.addEventListener('input', () => { inp.value = formatAmountInput(inp.value); });
    pf.addEventListener('submit', async e => {
      e.preventDefault();
      const err = pf.querySelector('.form-error');
      const m = readMoney(pf);
      // перечитываем остаток прямо перед записью, чтобы не было двойного учёта
      const fresh = debtState(debt, (await db.all(STORES.debtReturns)));
      // погрешность пересчёта валюты (до 1%) не должна мешать закрыть долг
      if (m.amount > 0 && Math.abs(m.amount - fresh.remaining) <= Math.max(0.05, fresh.remaining * 0.01)) m.amount = fresh.remaining;
      const amount = m.amount;
      if (!(amount > 0)) { err.textContent = 'Введите сумму больше нуля'; return; }
      if (amount > fresh.remaining) { err.textContent = `Нельзя вернуть больше остатка (${money(fresh.remaining)})`; return; }
      await db.put(STORES.debtReturns, { debtId: id, ...m, amount, ts: Date.now(), full: amount === fresh.remaining });
      toast(amount === fresh.remaining ? 'Долг полностью возвращён' : 'Возврат сохранён');
      openDebt(id);
    });
  }
  $('[data-full]')?.addEventListener('click', async () => {
    const fresh = debtState(debt, (await db.all(STORES.debtReturns)));
    if (fresh.remaining <= 0) return openDebt(id);
    await db.put(STORES.debtReturns, { debtId: id, amount: fresh.remaining, ts: Date.now(), full: true });
    toast('Долг полностью возвращён');
    openDebt(id);
  });
  body.querySelectorAll('[data-delret]').forEach(b => b.addEventListener('click', async () => {
    if (!b.classList.contains('confirm')) { b.classList.add('confirm'); setTimeout(() => b.classList.remove('confirm'), 3000); toast('Нажмите ещё раз, чтобы удалить возврат'); return; }
    await db.del(STORES.debtReturns, b.dataset.delret);
    openDebt(id);
  }));
  $('[data-edit]').addEventListener('click', () => debtForm(financialDay(), debt));
  const del = $('[data-deldebt]');
  del.addEventListener('click', async () => {
    if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'Нажмите ещё раз для удаления'; return; }
    for (const r of returns) await db.del(STORES.debtReturns, r.id);
    await db.del(STORES.debts, id);
    closeSheet(); toast('Долг удалён');
  });
  openSheet(debt.name, body);
}
