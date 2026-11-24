// Общие элементы интерфейса: нижняя шторка, уведомление, подгонка текста.
import { icon } from './icons.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let current = null;

/** Открыть шторку. body — HTML-элемент. Возвращает функцию закрытия. */
export function openSheet(title, body) {
  closeSheet(true);
  const root = document.getElementById('sheet-root');
  const wrap = h(`<div>
    <div class="backdrop"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grip"></div>
      <div class="sheet-head"><h3>${esc(title)}</h3><button class="sheet-close" aria-label="Закрыть">${icon('close')}</button></div>
      <div class="sheet-body"></div>
    </div></div>`);
  wrap.querySelector('.sheet-body').append(body);
  root.replaceChildren(...wrap.childNodes);
  root.querySelector('.backdrop').addEventListener('click', () => closeSheet());
  root.querySelector('.sheet-close').addEventListener('click', () => closeSheet());
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
  current = root;
  return closeSheet;
}

export function closeSheet(immediate = false) {
  const root = document.getElementById('sheet-root');
  if (!root.firstChild) return;
  if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
  root.classList.remove('open');
  if (immediate) { root.replaceChildren(); return; }
  setTimeout(() => { if (!root.classList.contains('open')) root.replaceChildren(); }, 260);
  current = null;
}

let toastTimer;
export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/** Уменьшает шрифт, если текст не помещается (длинные суммы) */
export function fitText(el, minScale = 0.6) {
  if (!el) return;
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize);
  let size = base;
  let guard = 20;
  while (guard-- > 0 && el.scrollWidth > el.clientWidth + 1 && size > base * minScale) {
    size -= base * 0.05;
    el.style.fontSize = size + 'px';
  }
}
