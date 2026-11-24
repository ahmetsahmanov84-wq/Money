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

// Общий массив: все экраны импортируют его и видят изменения без перезапуска
export const EXPENSE_CATEGORIES = [...BASE_CATEGORIES];

// Иконки, из которых можно выбрать значок своей категории
export const CATEGORY_ICONS = ['cart', 'house', 'car', 'fuel', 'health', 'family', 'shirt', 'book', 'outing', 'wallet', 'cash', 'cap', 'sale', 'briefcase', 'user', 'target', 'trend', 'dots'];

export const isCustom = id => !BASE_CATEGORIES.some(c => c.id === id);

function apply(custom) {
  EXPENSE_CATEGORIES.length = 0;
  EXPENSE_CATEGORIES.push(...BASE_CATEGORIES, ...(custom || []).map(c => ({ ...c, custom: true })));
}
export async function loadCategories() { apply(await getSetting('customCategories')); }

async function saveCustom(list) {
  apply(list);
  await setSetting('customCategories', list);
}
const customList = () => EXPENSE_CATEGORIES.filter(c => c.custom).map(({ id, name, icon }) => ({ id, name, icon }));
const norm = s => s.trim().replace(/\s+/g, ' ');

/** Добавляет свою категорию. Возвращает её или текст ошибки. */
export async function addCategory(name, iconName = 'dots') {
  const n = norm(name || '');
  if (!n) return { error: 'Введите название категории' };
  if (EXPENSE_CATEGORIES.some(c => c.name.toLowerCase() === n.toLowerCase())) return { error: 'Такая категория уже есть' };
  const cat = { id: 'c-' + uid(), name: n, icon: CATEGORY_ICONS.includes(iconName) ? iconName : 'dots' };
  await saveCustom([...customList(), cat]);
  return { cat };
}
export async function updateCategory(id, name, iconName) {
  const n = norm(name || '');
  if (!n) return { error: 'Введите название категории' };
  if (EXPENSE_CATEGORIES.some(c => c.id !== id && c.name.toLowerCase() === n.toLowerCase())) return { error: 'Такая категория уже есть' };
  await saveCustom(customList().map(c => c.id === id ? { ...c, name: n, icon: iconName || c.icon } : c));
  return {};
}
export async function removeCategory(id) {
  await saveCustom(customList().filter(c => c.id !== id));
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
  return EXPENSE_CATEGORIES.find(c => c.id === op.categoryId) || { id: op.categoryId, name: 'Без категории', icon: 'dots' };
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
