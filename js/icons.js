// SVG-иконки приложения (линейные, 24×24). Никаких эмодзи.
const P = {
  home: '<path d="M3.5 10.6 12 3.6l8.5 7"/><path d="M5.6 9v10.4a1 1 0 0 0 1 1h3.6v-5.6h3.6v5.6h3.6a1 1 0 0 0 1-1V9"/>',
  grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="1.7"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.7"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.7"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.7"/>',
  coins: '<ellipse cx="12" cy="5.6" rx="7.6" ry="2.9"/><path d="M4.4 5.6v12.6c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9V5.6"/><path d="M4.4 9.8c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9"/><path d="M4.4 14c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9"/>',
  bars: '<circle cx="5.4" cy="17.6" r="2.4"/><rect x="10" y="8.6" width="4.2" height="11.4" rx="2.1"/><rect x="16.6" y="3.8" width="4.2" height="16.2" rx="2.1"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  calendar: '<rect x="3.6" y="5" width="16.8" height="15.4" rx="2.6"/><path d="M3.6 10h16.8M8 3v4M16 3v4"/>',
  arrowDown: '<path d="M12 4v15.5M5.8 13.4 12 19.6l6.2-6.2"/>',
  arrowUp: '<path d="M12 20V4.5M5.8 10.6 12 4.4l6.2 6.2"/>',
  scales: '<path d="M12 3.5v15.5M7.5 20.5h9M4.5 6.5h15"/><circle cx="12" cy="4.6" r="1.1"/><path d="M5.5 6.8 2.6 13.2h5.8z"/><path d="M2.6 13.2a2.9 2.9 0 0 0 5.8 0"/><path d="M18.5 6.8l-2.9 6.4h5.8z"/><path d="M15.6 13.2a2.9 2.9 0 0 0 5.8 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M6.5 12h11"/>',
  swap: '<path d="M5 9.2h12.6"/><path d="M14.2 5.6l3.6 3.6-3.6 3.6"/><path d="M19 14.8H6.4"/><path d="M9.8 11.2l-3.6 3.6 3.6 3.6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.3 4.3L19 7.2"/>',
  // категории расходов
  cart: '<path d="M2.8 4h2.4l2.3 10.4a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L20.8 8H6.1"/><circle cx="9.6" cy="19.3" r="1.4"/><circle cx="17.2" cy="19.3" r="1.4"/>',
  house: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5v10.3h12V9.5"/><path d="M10 19.8v-5h4v5"/>',
  car: '<path d="M4 16v-3.4l1.9-4.8A2 2 0 0 1 7.8 6.5h8.4a2 2 0 0 1 1.9 1.3L20 12.6V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4.4 12.4h15.2"/><path d="M7.2 14.6h1.2M15.6 14.6h1.2M6.2 17v2M17.8 17v2"/>',
  health: '<path d="M12 20.2s-7.6-4.6-7.6-10.2A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.6 2.8c0 5.6-7.6 10.2-7.6 10.2z"/><path d="M7.6 12.4h2.2l1.3-2.2 1.8 4.2 1.2-2h2.3"/>',
  family: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.6c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3"/><circle cx="16.9" cy="9" r="2.5"/><path d="M16.6 14.4c2.4.2 4 1.8 4.5 4.8"/>',
  shirt: '<path d="M8.6 4 3.8 6.6l1.9 4.1 2.1-1V20h8.4V9.7l2.1 1 1.9-4.1L15.4 4c-.6 1.4-1.9 2.3-3.4 2.3S9.2 5.4 8.6 4z"/>',
  dots: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  fuel: '<path d="M5 20.5V5.6A1.6 1.6 0 0 1 6.6 4h6a1.6 1.6 0 0 1 1.6 1.6v14.9M3.6 20.5h12M5 10.4h9.2"/><path d="M14.2 9h2a1.8 1.8 0 0 1 1.8 1.8v5.6a1.3 1.3 0 0 0 2.6 0V8.4L18.2 6"/>',
  book: '<path d="M4 5.6A1.6 1.6 0 0 1 5.6 4H11v15.5H5.6A1.6 1.6 0 0 0 4 21.1z"/><path d="M20 5.6A1.6 1.6 0 0 0 18.4 4H13v15.5h5.4a1.6 1.6 0 0 1 1.6 1.6z"/>',
  outing: '<circle cx="17" cy="6.5" r="2.6"/><path d="M3 20.5h18"/><path d="M4.5 20.5 10 11l3.4 5 2.2-2.8 3.9 7.3"/>',
  wallet: '<path d="M4 7.6A2.4 2.4 0 0 1 6.4 5.2h10.4v3.2"/><rect x="4" y="8.4" width="16.4" height="11.2" rx="2.4"/><path d="M20.4 12h-3.6a2 2 0 0 0 0 4h3.6"/><circle cx="16.9" cy="14" r=".6" fill="currentColor"/>',
  // категории доходов
  cash: '<rect x="3" y="6.5" width="18" height="12" rx="2.6"/><path d="M7.5 6.5V4.8M16.5 6.5V4.8"/><path d="M9.6 13.6l1.6 1.4 3.2-3.6"/>',
  cap: '<path d="M2.5 9.6 12 5l9.5 4.6L12 14.2z"/><path d="M6.4 11.6v4c0 1.4 2.5 2.8 5.6 2.8s5.6-1.4 5.6-2.8v-4M21.5 9.6v5"/>',
  sale: '<rect x="3.8" y="5.4" width="16.4" height="14.6" rx="2.6"/><path d="M3.8 10.2h16.4M8.4 3.6v3.6M15.6 3.6v3.6M8.6 14.6h6.8"/>',
  briefcase: '<rect x="3.2" y="7.2" width="17.6" height="12.6" rx="2.4"/><path d="M8.8 7.2V5.6a1.6 1.6 0 0 1 1.6-1.6h3.2a1.6 1.6 0 0 1 1.6 1.6v1.6M3.2 12.4h17.6"/>',
  trend: '<path d="M3 17l5.6-5.6 4 4L21 7"/><path d="M15 7h6v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-3.9 3.6-6.2 7.5-6.2s6.9 2.3 7.5 6.2z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calCheck: '<rect x="3.6" y="5" width="16.8" height="15.4" rx="2.6"/><path d="M3.6 10h16.8M8 3v4M16 3v4"/><path d="M8.6 15.2l2.3 2.2 4.6-4.6"/>',
  calToday: '<rect x="3.6" y="5" width="16.8" height="15.4" rx="2.6"/><path d="M3.6 10h16.8M8 3v4M16 3v4"/><path d="M14.5 13.5l-3.6 3.6"/><circle cx="9" cy="14.6" r=".9" fill="currentColor"/>',
  target: '<circle cx="11" cy="13" r="7.5"/><circle cx="11" cy="13" r="3.6"/><path d="M11 13l8-8M15.5 4.5 19 5l.5 3.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M4.5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  upload: '<path d="M12 15.5V4.5M7 9l5-5 5 5"/><path d="M4.5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  faceid: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.3 15.5a4 4 0 0 0 5.4 0"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7"/>',
};

export function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

/** Логотип «M» с оранжевым градиентом */
export function logo() {
  return `<svg class="logo" viewBox="0 0 30 22" aria-hidden="true">
    <defs><linearGradient id="lg-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb020"/><stop offset=".55" stop-color="#ff6a00"/><stop offset="1" stop-color="#f23b00"/></linearGradient></defs>
    <path fill="url(#lg-m)" d="M2.2 20.5 6.6 3.4c.5-1.9 3.1-2.1 3.9-.3L15 12.6l4.5-9.5c.8-1.8 3.4-1.6 3.9.3l4.4 17.1h-5.3l-2.4-9.7-3.3 7c-.8 1.7-3.2 1.7-4 0l-3.3-7-2.4 9.7z"/>
  </svg>`;
}
