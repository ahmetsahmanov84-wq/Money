// Форматирование сумм и дат. Все даты — по местному времени устройства.
const NBSP = ' ';
const MINUS = '−';

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 125000 → «125 000 ₺»; sign: '+', '-' или '' */
export function money(value, sign = '') {
  const abs = Math.abs(Math.round(value * 100) / 100);
  const body = (Number.isInteger(abs) ? nf0 : nf2).format(abs).replace(/ |\s/g, NBSP);
  const s = abs === 0 ? '' : sign === '+' ? '+' : sign === '-' ? MINUS : '';
  return `${s}${body}${NBSP}₺`;
}

/** Строку пользователя («1 250,50») → число */
export function parseAmount(str) {
  if (typeof str !== 'string') return Number(str) || 0;
  const clean = str.replace(/[\s  ₺]/g, '').replace(',', '.');
  if (!/^\d*\.?\d{0,2}$/.test(clean) || clean === '' || clean === '.') return NaN;
  return Math.round(parseFloat(clean) * 100) / 100;
}

/** Живое форматирование поля суммы при вводе */
export function formatAmountInput(str) {
  let s = str.replace(/[^\d,.]/g, '').replace('.', ',');
  const parts = s.split(',');
  let int = parts[0].replace(/^0+(?=\d)/, '');
  let frac = parts.length > 1 ? ',' + parts.slice(1).join('').slice(0, 2) : '';
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return int + frac;
}

/** 24 ноября 2026 */
export function longDate(d) {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}
/** 20 нояб. 2026 */
export function shortDate(d) {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
export function hhmm(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---- Финансовый день ---- */
let dayStartMinutes = 0;
export function setDayStart(minutes) { dayStartMinutes = Number(minutes) || 0; }

/** Начало финансового дня для календарной даты (y, m, d) */
export function dayStartOf(y, m, d) {
  return new Date(y, m, d, 0, dayStartMinutes, 0, 0);
}
/** Календарная дата (полночь), к которой относится момент времени */
export function financialDay(date = new Date()) {
  const t = new Date(date);
  let day = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  if (t < dayStartOf(day.getFullYear(), day.getMonth(), day.getDate())) {
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
  }
  return day;
}
/** [начало, конец) финансового дня в миллисекундах */
export function dayRange(day) {
  const from = dayStartOf(day.getFullYear(), day.getMonth(), day.getDate());
  const to = dayStartOf(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return [from.getTime(), to.getTime()];
}
export function addDays(day, n) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
}
export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** «Сегодня, 18:24», «Вчера, 15:10», «20 нояб. 2026, 12:00» */
export function relativeStamp(ts) {
  const d = new Date(ts);
  const fd = financialDay(d);
  const today = financialDay();
  if (sameDay(fd, today)) return `Сегодня, ${hhmm(d)}`;
  if (sameDay(fd, addDays(today, -1))) return `Вчера, ${hhmm(d)}`;
  return `${shortDate(d)}, ${hhmm(d)}`;
}

/** Значения для <input type=date/time> по местному времени */
export function toDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fromInputs(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

/** [начало, конец) финансового месяца, к которому относится день */
export function monthRange(day) {
  return [dayStartOf(day.getFullYear(), day.getMonth(), 1).getTime(), dayStartOf(day.getFullYear(), day.getMonth() + 1, 1).getTime()];
}
/** Относится ли момент к текущему (открытому) финансовому дню */
export function isOpenDay(ts) {
  return sameDay(financialDay(new Date(ts)), financialDay());
}
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export function monthTitle(d) { return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`; }
export function pct(part, total) { return total > 0 ? Math.round(part / total * 100) + '%' : '0%'; }
