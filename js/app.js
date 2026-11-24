// Точка входа: каркас, нижнее меню, переключение экранов.
import { openDB, onChange, getSetting, STORES } from './db.js';
import { icon, logo } from './icons.js';
import { setDayStart } from './format.js';
import { home } from './screens/home.js';
import { categories } from './screens/categories.js';
import { income } from './screens/income.js';
import { analytics, categoryDetail } from './screens/analytics.js';
import { debts } from './screens/debts.js';
import { calendar } from './screens/calendar.js';
import { settings, limits } from './screens/settings.js';
import { initLock } from './security.js';

// Порядок вкладок строго по ТЗ
const TABS = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'categories', label: 'Категории', icon: 'grid' },
  { id: 'income', label: 'Доходы', icon: 'coins' },
  { id: 'analytics', label: 'Аналитика', icon: 'bars' },
  { id: 'settings', label: 'Настройки', icon: 'gear' },
  { id: 'debts', label: 'Долги', icon: 'coins' },
];

// Экраны следующих модулей — временные заглушки
const STUB_INFO = {
};
function stub(id) {
  const [title, sub] = STUB_INFO[id];
  return {
    id,
    render(host, ctx) {
      host.innerHTML = `<section class="screen">
        <header class="hero">
          <div class="brand"><button class="back" aria-label="Назад">${icon('chevL')}</button>${logo()}<span>Money Tracker</span></div>
          <h1>${title}</h1><p class="sub">${sub}</p>
        </header>
        <div class="card stub"><b>Экран в работе</b>Этот раздел будет собран в одном из следующих модулей строго по утверждённому макету.</div>
      </section>`;
      host.querySelector('.back').onclick = () => ctx.back();
    },
  };
}

const SCREENS = { home, categories, income, analytics, categoryDetail, debts, calendar, settings, limits };
// Вложенные экраны подсвечивают вкладку-родителя
const PARENT = { categoryDetail: 'analytics', calendar: 'home', limits: 'settings' };
for (const id of Object.keys(STUB_INFO)) SCREENS[id] = stub(id);

const host = document.getElementById('host');
const tabbar = document.getElementById('tabbar');
let currentId = null;
const history = [];

const ctx = {
  open(id, params = {}) { go(id, params, true); },
  back() { const prev = history.pop(); go(prev || 'home', {}, false); },
};

function go(id, params = {}, push = true) {
  if (push && currentId && currentId !== id) history.push(currentId);
  if (history.length > 20) history.shift();
  currentId = id;
  const tabId = TABS.some(t => t.id === id) ? id : (PARENT[id] || 'home');
  tabbar.querySelectorAll('.tab').forEach(b => {
    const on = b.dataset.tab === tabId;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (id === 'home' && params.day) home.setDay(params.day);
  SCREENS[id].render(host, ctx, params);
  host.scrollTop = 0;
}

function buildTabbar() {
  tabbar.innerHTML = TABS.map(t =>
    `<button class="tab" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></button>`).join('');
  tabbar.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    history.length = 0;
    go(b.dataset.tab, {}, false);
  });
}

async function start() {
  buildTabbar();
  try {
    await openDB();
    setDayStart(await getSetting('dayStartMinutes'));
  } catch (e) {
    console.error(e);
    host.innerHTML = `<div class="card stub" style="margin:2rem 1rem"><b>Не удалось открыть хранилище</b>Проверьте, что в Safari не включён режим «Частный доступ».</div>`;
    return;
  }
  await initLock();
  go('home', {}, false);

  // Обновление экрана при любом изменении данных
  onChange(store => {
    if (store === STORES.settings) getSetting('dayStartMinutes').then(setDayStart);
    const s = SCREENS[currentId];
    if (s && s.refresh) s.refresh(host);
  });
  // Смена финансового дня в 00:00 без перезапуска
  const tick = () => { const s = SCREENS[currentId]; if (s && s.tick) s.tick(host); };
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

start();

// Офлайн-режим
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW:', err));
  });
}
