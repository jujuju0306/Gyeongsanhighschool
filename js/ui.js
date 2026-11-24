// 화면 라이브러리(Preact + htm, 빌드 과정 없이 사용)와 공용 UI 부품
import {
  html, render, h, createContext, useState, useEffect, useMemo, useRef, useCallback, useContext,
} from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';

export { html, render, h, createContext, useState, useEffect, useMemo, useRef, useCallback, useContext };

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  phone: '<path d="M5 3h3.5l2 5-2.5 1.5a11 11 0 0 0 6.5 6.5L16 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  sms: '<path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z"/><path d="M8 9h8M8 13h5"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v3h16v-3"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.8 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  wand: '<path d="m4 20 11-11"/><path d="m14 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  phoneapp: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  share: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M7 10H5.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H17"/>',
  addsq: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18z"/>',
  shuffle: '<path d="M3 6h3.5c2 0 3.2 1 4.3 2.8l2.4 4.4C14.3 15 15.5 18 17.5 18H21"/><path d="M3 18h3.5c1.4 0 2.4-.6 3.2-1.6M14.3 7.6C15 6.6 16 6 17.5 6H21"/><path d="m18 3 3 3-3 3M18 15l3 3-3 3"/>',
};

export const Icon = ({ name, size = 22, cls = '' }) => html`<svg
  class="ic ${cls}" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  dangerouslySetInnerHTML=${{ __html: PATHS[name] || '' }}></svg>`;

const AV_COLORS = ['#2563eb', '#0ea5e9', '#4f46e5', '#0891b2', '#3b82f6', '#6366f1', '#0284c7', '#1d4ed8'];
export function Avatar({ member, size = 36 }) {
  const name = member?.name || '?';
  let hsh = 0;
  for (const c of member?.id || name) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  const bg = AV_COLORS[hsh % AV_COLORS.length];
  const label = name.length >= 3 ? name.slice(1, 3) : name.slice(0, 2);
  return html`<span class="avatar" style=${`width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * 0.36)}px`}>${label}</span>`;
}

let lockCount = 0;
export function Sheet({ title, onClose, children, footer, full }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    if (lockCount++ === 0) document.body.classList.add('noscroll');
    return () => {
      removeEventListener('keydown', onKey);
      if (--lockCount === 0) document.body.classList.remove('noscroll');
    };
  }, []);
  return html`<div class="sheet-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet ${full ? 'full' : ''}" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="sheet-grip"></div>
      <div class="sheet-head">
        <h3>${title}</h3>
        <button class="icon-btn" onClick=${onClose} aria-label="닫기"><${Icon} name="x" /></button>
      </div>
      <div class="sheet-body">${children}</div>
      ${footer && html`<div class="sheet-foot">${footer}</div>`}
    </div>
  </div>`;
}

export const Empty = ({ text, icon = 'calendar' }) =>
  html`<div class="empty"><${Icon} name=${icon} size=${28} /><p>${text}</p></div>`;

export const Field = ({ label, hint, children }) =>
  html`<label class="field"><span class="field-label">${label}</span>${children}${hint && html`<span class="field-hint">${hint}</span>`}</label>`;

export function Toggle({ checked, onChange, label, desc }) {
  return html`<label class="toggle-row">
    <span><span class="toggle-label">${label}</span>${desc && html`<span class="toggle-desc">${desc}</span>`}</span>
    <input type="checkbox" class="switch" checked=${checked} onChange=${(e) => onChange(e.target.checked)} />
  </label>`;
}

export function useNow(interval = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

// 비동기 버튼: 처리 중 중복 클릭 방지 + 오류를 토스트로 표시
export function useBusy() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      console.error(e);
      app?.toast(e.message || '오류가 발생했어요.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}
