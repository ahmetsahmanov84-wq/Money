// Справочник категорий: восемь утверждённых категорий расходов (ТЗ модуля 2)
// плюс свои категории пользователя без ограничения количества (хранятся в settings.customCategories).
import { getSetting, setSetting, uid } from './db.js';

export const BASE_CATEGORIES = [
  { id: 'utilities', name: 'Коммунальные / квартира', icon: 'house' },
  { id: 'food', name: 'Еда', icon: 'cart' },
  { id: 'knowledge', name: 'Знания', icon: 'book' },
  { id: 'outing', name: 'Выход на улицу', icon: 'outing' },
  { id: 'sick', name: 'Больничные', icon: 'health' },
  { id: 'pocket-ahmed', name: 'Карманные — Ахмед', icon: 'wallet' },
  { id: 'pocket-jamila', name: 'Карманные — Джамиля', icon: 'wallet' },
  { id: 'pocket-usman', name: 'Карманные — Усман', icon: 'wallet' },
];

// Общие массивы: все экраны импортируют их и видят изменения без перезапуска.
// EXPENSE_CATEGORIES — активные категории (список, форма расхода, лимиты).
// ALL_CATEGORIES — вместе с удалёнными: нужны, чтобы старые расходы сохранили название в истории и отчётах.
export const EXPENSE_CATEGORIES = [...BASE_CATEGORIES];
export const ALL_CATEGORIES = [...BASE_CATEGORIES];

// Иконки, из которых можно выбрать значок своей категории
export const CATEGORY_ICONS = ['cart', 'house', 'car', 'fuel', 'health', 'family', 'shirt', 'book', 'outing', 'wallet', 'cash', 'cap', 'sale', 'briefcase', 'user', 'target', 'trend', 'dots'];

export const isCustom = id => !BASE_CATEGORIES.some(c => c.id === id);
export const findCategory = id => ALL_CATEGORIES.find(c => c.id === id);

let custom = [];      // свои категории {id, name, icon, hidden?}
let hiddenBase = [];  // id удалённых стандартных категорий

function apply() {
  const all = [
    ...BASE_CATEGORIES.map(c => ({ ...c, hidden: hiddenBase.includes(c.id) })),
    ...custom.map(c => ({ ...c, custom: true, hidden: !!c.hidden })),
  ];
  ALL_CATEGORIES.length = 0; ALL_CATEGORIES.push(...all);
  EXPENSE_CATEGORIES.length = 0; EXPENSE_CATEGORIES.push(...all.filter(c => !c.hidden));
}
export async function loadCategories() {
  custom = (await getSetting('customCategories')) || [];
  hiddenBase = (await getSetting('hiddenCategories')) || [];
  apply();
}
async function save() {
  apply();
  await setSetting('hiddenCategories', hiddenBase);
  await setSetting('customCategories', custom);
}
const norm = s => s.trim().replace(/\s+/g, ' ');
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** Добавляет категорию. Если так называлась удалённая — возвращает её обратно вместе с историей. */
export async function addCategory(name, iconName = 'dots') {
  const n = norm(name || '');
  if (!n) return { error: 'Введите название категории' };
  if (EXPENSE_CATEGORIES.some(c => same(c.name, n))) return { error: 'Такая категория уже есть' };
  const old = ALL_CATEGORIES.find(c => c.hidden && same(c.name, n));
  if (old) {
    if (old.custom) custom = custom.map(c => c.id === old.id ? { ...c, hidden: false, icon: CATEGORY_ICONS.includes(iconName) && iconName !== 'dots' ? iconName : c.icon } : c);
    else hiddenBase = hiddenBase.filter(id => id !== old.id);
    await save();
    return { cat: findCategory(old.id), restored: true };
  }
  const cat = { id: 'c-' + uid(), name: n, icon: CATEGORY_ICONS.includes(iconName) ? iconName : 'dots' };
  custom = [...custom, cat];
  await save();
  return { cat: findCategory(cat.id) };
}
export async function updateCategory(id, name, iconName) {
  const n = norm(name || '');
  if (!n) return { error: 'Введите название категории' };
  if (EXPENSE_CATEGORIES.some(c => c.id !== id && same(c.name, n))) return { error: 'Такая категория уже есть' };
  custom = custom.map(c => c.id === id ? { ...c, name: n, icon: iconName || c.icon } : c);
  await save();
  return {};
}
/** Удаляет категорию из списка. Расходы не удаляются: в истории и отчётах остаётся её название. */
export async function removeCategory(id, hasExpenses = false) {
  if (!isCustom(id)) { if (!hiddenBase.includes(id)) hiddenBase = [...hiddenBase, id]; }
  else if (hasExpenses) custom = custom.map(c => c.id === id ? { ...c, hidden: true } : c);
  else custom = custom.filter(c => c.id !== id);
  await save();
}

export const INCOME_CATEGORIES = [
  { id: 'rent', name: 'Аренда', icon: 'cash' },
  { id: 'salary', name: 'Зарплата', icon: 'briefcase' },
  { id: 'education', name: 'Обучение', icon: 'cap' },
  { id: 'sale', name: 'Продажа', icon: 'sale' },
  { id: 'other-income', name: 'Прочие доходы', icon: 'trend' },
];

export function categoryOf(op) {
  if (op.type === 'income') return INCOME_CATEGORIES.find(c => c.id === op.categoryId) || INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1];
  return findCategory(op.categoryId) || { id: op.categoryId, name: 'Без категории', icon: 'dots' };
}

/** Иконка операции: для «Топливо» — колонка, как в макете, иначе — иконка категории */
export function opIcon(op) {
  if (op.type === 'transfer') return 'swap';
  const t = op.title || '';
  if (op.type === 'expense') return /топлив|бензин|заправ/i.test(t) ? 'fuel' : categoryOf(op).icon;
  // Доход: иконка по названию
  if (/аренд/i.test(t)) return 'cash';
  if (/обучен|урок|курс/i.test(t)) return 'cap';
  if (/продаж/i.test(t)) return 'sale';
  if (/зарплат|оклад|преми/i.test(t)) return 'briefcase';
  return 'trend';
}
