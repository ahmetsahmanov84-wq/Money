// Справочник категорий: ровно восемь утверждённых категорий расходов (ТЗ модуля 2). Это не финансовые данные.
export const EXPENSE_CATEGORIES = [
  { id: 'utilities', name: 'Коммунальные / квартира', icon: 'house' },
  { id: 'food', name: 'Еда', icon: 'cart' },
  { id: 'knowledge', name: 'Знания', icon: 'book' },
  { id: 'outing', name: 'Выход на улицу', icon: 'outing' },
  { id: 'sick', name: 'Больничные', icon: 'health' },
  { id: 'pocket-ahmed', name: 'Карманные — Ахмед', icon: 'wallet' },
  { id: 'pocket-jamila', name: 'Карманные — Джамиля', icon: 'wallet' },
  { id: 'pocket-usman', name: 'Карманные — Усман', icon: 'wallet' },
];

export const INCOME_CATEGORIES = [
  { id: 'rent', name: 'Аренда', icon: 'cash' },
  { id: 'salary', name: 'Зарплата', icon: 'briefcase' },
  { id: 'education', name: 'Обучение', icon: 'cap' },
  { id: 'sale', name: 'Продажа', icon: 'sale' },
  { id: 'other-income', name: 'Прочие доходы', icon: 'trend' },
];

export function categoryOf(op) {
  const list = op.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find(c => c.id === op.categoryId) || list[list.length - 1];
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
