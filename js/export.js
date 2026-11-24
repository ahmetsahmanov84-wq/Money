// Экспорт (CSV, PDF) и импорт данных. Работает офлайн, без внешних библиотек.
import { db, STORES, uid } from './db.js';
import { EXPENSE_CATEGORIES, ALL_CATEGORIES, addCategory } from './categories.js';
import { money, longDate, hhmm, toDateInput, monthRange, monthTitle, pct } from './format.js';

const CSV_HEAD = ['id', 'type', 'date', 'time', 'title', 'category', 'amount', 'status', 'from', 'to', 'note', 'currency', 'original'];
const CSV_HEAD_OLD = 11; // файлы прошлой версии без столбцов валюты тоже принимаются
const TYPE_RU = { income: 'Доход', expense: 'Расход', transfer: 'Перевод' };

const catName = id => (ALL_CATEGORIES.find(c => c.id === id) || {}).name || '';
const catIdByName = n => (ALL_CATEGORIES.find(c => c.name === n || c.id === n) || {}).id;

/** Сохранить файл: «Поделиться» на iPhone (Файлы, Почта, AirDrop) или обычное скачивание */
export async function saveFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

/* ---------- CSV ---------- */
const q = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function exportCsv() {
  const ops = (await db.all(STORES.operations)).sort((a, b) => a.ts - b.ts);
  const rows = [CSV_HEAD.join(';')];
  for (const o of ops) {
    const d = new Date(o.ts);
    rows.push([o.id, TYPE_RU[o.type] || o.type, toDateInput(d), hhmm(d), o.title || '', o.type === 'expense' ? catName(o.categoryId) : '',
      String(o.amount).replace('.', ','), o.type === 'income' ? (o.status === 'expected' ? 'Ожидается' : 'Получен') : '',
      o.from || '', o.to || '', o.note || '', o.currency || 'TRY', String(o.origAmount ?? o.amount).replace('.', ',')].map(q).join(';'));
  }
  // BOM, чтобы Excel правильно открыл кириллицу
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const name = `money-tracker-${toDateInput(new Date())}.csv`;
  return { result: await saveFile(blob, name), count: ops.length };
}

function parseCsv(text) {
  const rows = []; let row = [], cur = '', inQ = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

/** Проверка файла импорта. Возвращает записи, ошибки и дубликаты. */
export async function analyzeImport(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('Файл пустой');
  const head = rows[0].map(h => h.trim());
  if (CSV_HEAD.slice(0, CSV_HEAD_OLD).some((h, i) => head[i] !== h)) throw new Error('Неверная структура файла. Используйте CSV, выгруженный из Money Tracker.');
  const existing = await db.all(STORES.operations);
  const ids = new Set(existing.map(o => o.id));
  const sig = o => `${o.type}|${o.ts}|${o.amount}|${(o.title || '').trim().toLowerCase()}`;
  const sigs = new Set(existing.map(sig));
  const TYPE = { 'Доход': 'income', 'Расход': 'expense', 'Перевод': 'transfer', income: 'income', expense: 'expense', transfer: 'transfer' };
  const ok = [], errors = [], dupes = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const [id, type, date, time, title, category, amount, status, from, to, note, currency, original] = r;
    const t = TYPE[(type || '').trim()];
    const a = Math.round(parseFloat(String(amount).replace(/\s/g, '').replace(',', '.')) * 100) / 100;
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec((date || '').trim());
    const tm = /^(\d{1,2}):(\d{2})$/.exec((time || '00:00').trim());
    if (!t) return errors.push(`Строка ${line}: неизвестный тип «${type}»`);
    if (!(a > 0)) return errors.push(`Строка ${line}: неверная сумма`);
    if (!dm || !tm) return errors.push(`Строка ${line}: неверная дата или время`);
    const ts = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]).getTime();
    const op = { id: (id || '').trim() || uid(), type: t, ts, amount: a, title: (title || '').trim() || (TYPE_RU[t]), note: (note || '').trim() };
    const cur = (currency || '').trim().toUpperCase(); const orig = parseFloat(String(original || '').replace(/\s/g, '').replace(',', '.'));
    if (cur && cur !== 'TRY' && orig > 0) { op.currency = cur; op.origAmount = Math.round(orig * 100) / 100; } else { op.currency = 'TRY'; op.origAmount = a; }
    if (t === 'expense') {
      op.categoryId = catIdByName((category || '').trim());
      // Неизвестная категория станет своей категорией при импорте
      if (!op.categoryId) { if (!(category || '').trim()) return errors.push(`Строка ${line}: не указана категория`); op.newCategory = category.trim(); op.categoryId = 'new:' + op.newCategory; }
    }
    if (t === 'income') op.status = (status || '').trim() === 'Ожидается' ? 'expected' : 'received';
    if (t === 'transfer') { op.from = (from || '').trim() || 'main'; op.to = (to || '').trim() || 'savings'; }
    if (ids.has(op.id) || sigs.has(sig(op))) dupes.push(op); else ok.push(op);
  });
  return { ok, dupes, errors };
}

export async function applyImport(ops) {
  for (const o of ops) {
    if (o.newCategory) {
      const id = catIdByName(o.newCategory) || (await addCategory(o.newCategory)).cat.id;
      o.categoryId = id; delete o.newCategory;
    }
    await db.put(STORES.operations, o);
  }
  return ops.length;
}

/* ---------- PDF (страницы рисуются на canvas и вставляются как JPEG) ---------- */
const PW = 595, PH = 842, SC = 2; // A4 в пунктах, масштаб 2x для чёткости

function pdfFromJpegs(pages) {
  const parts = []; const offsets = []; let len = 0;
  const te = new TextEncoder();
  const push = x => { const b = typeof x === 'string' ? te.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, cs = pg + 1, im = pg + 2;
    obj(pg, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${cs} 0 R >>`));
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im${i} Do Q`;
    obj(cs, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(im, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`); push(p.data); push('\nendstream'); });
  });
  const total = 3 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

async function canvasToJpeg(c) {
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  return { data: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
}

/** period: 'month' | 'prev' | 'all' */
export async function exportPdf(period = 'month') {
  const now = new Date();
  let from = 0, to = Number.MAX_SAFE_INTEGER, label = 'Весь период';
  if (period !== 'all') {
    const m = period === 'prev' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    [from, to] = monthRange(m); label = monthTitle(m);
  }
  const ops = (await db.all(STORES.operations)).filter(o => o.ts >= from && o.ts < to).sort((a, b) => a.ts - b.ts);
  const [debts, returns] = await Promise.all([db.all(STORES.debts), db.all(STORES.debtReturns)]);
  let inc = 0, wait = 0, exp = 0; const byCat = {};
  for (const o of ops) {
    if (o.type === 'income') { if (o.status === 'expected') wait += o.amount; else inc += o.amount; }
    if (o.type === 'expense') { exp += o.amount; byCat[o.categoryId] = (byCat[o.categoryId] || 0) + o.amount; }
  }
  const debtSum = dir => {
    let total = 0, ret = 0;
    for (const d of debts) if (d.direction === dir && d.transferred) { total += d.amount; ret += returns.filter(r => r.debtId === d.id).reduce((s, r) => s + r.amount, 0); }
    return [total, ret, Math.max(0, total - ret)];
  };

  const FONT = '-apple-system, "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif';
  const pages = []; let c, g, y;
  const M = 44;
  const newPage = () => {
    c = document.createElement('canvas'); c.width = PW * SC; c.height = PH * SC;
    g = c.getContext('2d'); g.scale(SC, SC); g.fillStyle = '#fff'; g.fillRect(0, 0, PW, PH);
    g.textBaseline = 'alphabetic'; y = M; pages.push(c);
  };
  const need = h => { if (y + h > PH - M) newPage(); };
  const text = (s, x, size = 11, weight = 400, color = '#141414', align = 'left') => {
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y);
  };
  const fit = (s, maxW, size, weight = 400) => {
    g.font = `${weight} ${size}px ${FONT}`;
    if (g.measureText(s).width <= maxW) return s;
    while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  };
  const line = () => { g.strokeStyle = '#eadcd5'; g.lineWidth = .6; g.beginPath(); g.moveTo(M, y); g.lineTo(PW - M, y); g.stroke(); };

  newPage();
  g.fillStyle = '#ff6a00'; g.fillRect(0, 0, PW, 6);
  y += 14; text('Money Tracker — финансовый отчёт', M, 20, 800);
  y += 20; text(`Период: ${label}`, M, 12, 500, '#6e6662');
  text(`Сформирован: ${longDate(now)}, ${hhmm(now)}`, PW - M, 10, 400, '#6e6662', 'right');
  y += 26; text('Итоги', M, 14, 800);
  const kv = (k, v, color) => { need(20); y += 18; text(k, M, 11, 400, '#3b3532'); text(v, PW - M, 11, 700, color, 'right'); y += 6; line(); };
  kv('Полученные доходы', money(inc, '+'), '#1d9a2c');
  if (wait) kv('Ожидаемые доходы (не входят в баланс)', money(wait, '+'), '#9a8f8a');
  kv('Расходы', money(exp, '-'), '#f0301c');
  kv('Баланс', money(inc - exp, inc - exp > 0 ? '+' : inc - exp < 0 ? '-' : ''), inc - exp < 0 ? '#f0301c' : '#1d9a2c');

  y += 26; need(40); text('Расходы по категориям', M, 14, 800);
  for (const cat of ALL_CATEGORIES.filter(c => !c.hidden || byCat[c.id])) kv(cat.name, `${money(byCat[cat.id] || 0)}   ${pct(byCat[cat.id] || 0, exp)}`, '#141414');

  y += 26; need(40); text('Долги (на дату отчёта)', M, 14, 800);
  const [gT, gR, gO] = debtSum('given'), [tT, tR, tO] = debtSum('taken');
  kv('Я дал: выдано / возвращено / остаток', `${money(gT)} / ${money(gR)} / ${money(gO)}`, '#141414');
  kv('Я взял: получено / возвращено / остаток', `${money(tT)} / ${money(tR)} / ${money(tO)}`, '#141414');

  y += 26; need(50); text(`Операции (${ops.filter(o => o.type !== 'transfer').length})`, M, 14, 800);
  y += 18; text('Дата', M, 9, 700, '#6e6662'); text('Название', M + 92, 9, 700, '#6e6662'); text('Категория / статус', M + 290, 9, 700, '#6e6662'); text('Сумма', PW - M, 9, 700, '#6e6662', 'right');
  y += 5; line();
  for (const o of ops) {
    if (o.type === 'transfer') continue;
    const d = new Date(o.ts);
    const h = o.note ? 30 : 18;
    if (y + h > PH - M) { newPage(); }
    y += 15;
    text(`${toDateInput(d).split('-').reverse().join('.')} ${hhmm(d)}`, M, 9.5, 400, '#3b3532');
    text(fit(o.title || '', 190, 10, 600), M + 92, 10, 600);
    text(fit(o.type === 'expense' ? catName(o.categoryId) : (o.status === 'expected' ? 'Доход · ожидается' : 'Доход · получен'), 120, 9.5), M + 290, 9.5, 400, '#6e6662');
    const inc = o.type === 'income';
    text(money(o.amount, inc ? '+' : '-'), PW - M, 10, 700, inc ? (o.status === 'expected' ? '#9a8f8a' : '#1d9a2c') : '#f0301c', 'right');
    if (o.note) { y += 12; text(fit(o.note, 400, 8.5), M + 92, 8.5, 400, '#8a807b'); }
    y += 5; line();
  }
  if (!ops.length) { y += 18; text('Операций за период нет', M, 11, 400, '#6e6662'); }
  pages.forEach((p, i) => { const gg = p.getContext('2d'); gg.font = `400 9px ${FONT}`; gg.fillStyle = '#9a8f8a'; gg.textAlign = 'center'; gg.fillText(`${i + 1} / ${pages.length}`, PW / 2, PH - 20); });

  const jpegs = [];
  for (const p of pages) jpegs.push(await canvasToJpeg(p));
  const blob = pdfFromJpegs(jpegs);
  const name = `money-tracker-otchet-${period === 'all' ? 'vse' : toDateInput(new Date(from)).slice(0, 7)}.pdf`;
  return { result: await saveFile(blob, name), pages: pages.length };
}
