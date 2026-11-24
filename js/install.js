// 앱 설치를 쉽게: 카카오톡 등 앱 안 브라우저 탈출, 원터치 설치(안드로이드), 아이폰 설치 안내, 초대 QR·링크
import { html, useState, useEffect, useApp, Icon, Sheet, useBusy } from './ui.js';
import { isIOS, isStandalone } from './utils.js';

const UA = navigator.userAgent;
export const publicUrl = () => self.APP_PUBLIC_URL || location.origin + location.pathname;
export const isAndroid = () => /android/i.test(UA);
const isMobile = () => isIOS() || isAndroid();
const isChrome = () => /Chrome\//.test(UA) && !/SamsungBrowser|Whale|EdgA|OPR|Firefox|; wv\)/i.test(UA);

// 앱 안 브라우저(설치 불가) 감지
export function inAppName() {
  if (/KAKAOTALK/i.test(UA)) return '카카오톡';
  if (/Instagram/i.test(UA)) return '인스타그램';
  if (/NAVER\(inapp|NAVER/i.test(UA) && !/Whale/i.test(UA)) return '네이버 앱';
  if (/FBAN|FBAV/i.test(UA)) return '페이스북';
  if (/\bLine\//i.test(UA)) return '라인';
  if (/everytimeApp/i.test(UA)) return '에브리타임';
  if (/; wv\)/.test(UA)) return '앱 안의 브라우저';
  return null;
}

const kakaoExternal = () => 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
const chromeIntent = () => {
  const u = new URL(location.href);
  return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
};

// 앱 시작 시 호출: 카카오톡 안이면 기본 브라우저로 자동 이동 (한 번만 시도)
export function escapeInAppBrowser() {
  try {
    if (!/KAKAOTALK/i.test(UA) || sessionStorage.getItem('patrol-kakao-escape')) return;
    sessionStorage.setItem('patrol-kakao-escape', '1');
    location.href = kakaoExternal();
  } catch {}
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(window.__installPrompt || null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const on = (e) => setPrompt(e.detail);
    const done = () => { setInstalled(true); setPrompt(null); };
    addEventListener('patrol:installable', on);
    addEventListener('appinstalled', done);
    return () => { removeEventListener('patrol:installable', on); removeEventListener('appinstalled', done); };
  }, []);
  return [prompt, installed];
}

// 설치 안내 카드 (로그인 화면·홈 화면 위쪽)
export function InstallCard({ dismissible }) {
  const [prompt, installed] = useInstallPrompt();
  const [hidden, setHidden] = useState(() => dismissible && localStorage.getItem('patrol-hide-install') === '1');
  const [copied, setCopied] = useState(false);
  if (isStandalone() || installed || hidden) return null;

  const close = dismissible && html`<button class="icon-btn sm" aria-label="닫기"
    onClick=${() => { localStorage.setItem('patrol-hide-install', '1'); setHidden(true); }}><${Icon} name="x" size=${18} /></button>`;
  const inApp = inAppName();

  // 1) 카카오톡·인스타그램 등 앱 안 브라우저
  if (inApp) {
    return html`<div class="install">
      <div class="install-head"><${Icon} name="globe" /><b>${inApp}에서는 앱을 설치할 수 없어요</b></div>
      <p>${isIOS() ? 'Safari' : 'Chrome'}에서 열어야 홈 화면에 설치할 수 있어요.</p>
      <div class="install-actions">
        ${/KAKAOTALK/i.test(UA)
          ? html`<a class="btn primary sm" href=${kakaoExternal()}>${isIOS() ? 'Safari' : '브라우저'}로 열기</a>`
          : isAndroid()
            ? html`<a class="btn primary sm" href=${chromeIntent()}>Chrome으로 열기</a>`
            : null}
        <button class="btn ghost sm" onClick=${async () => setCopied(await copyText(publicUrl()))}>
          <${Icon} name="copy" size=${15} />${copied ? '복사됨' : '링크 복사'}</button>
      </div>
      ${isIOS() && !/KAKAOTALK/i.test(UA) && html`<p class="small muted">오른쪽 아래(또는 위) ··· 메뉴 → "Safari로 열기"를 눌러도 돼요.</p>`}
    </div>`;
  }

  // 2) 안드로이드 Chrome 등: 버튼 한 번으로 설치
  if (prompt) {
    return html`<div class="install">
      <div class="install-head"><img src="icons/icon-192.png" width="40" height="40" alt="" /><span><b>학생부 순찰 앱 설치</b><small>홈 화면에서 바로 열고 알림을 받을 수 있어요</small></span>${close}</div>
      <button class="btn primary block" onClick=${async () => { prompt.prompt(); await prompt.userChoice; }}><${Icon} name="download" size=${18} />설치하기</button>
    </div>`;
  }

  // 3) 아이폰 Safari: 공유 → 홈 화면에 추가
  if (isIOS()) {
    return html`<div class="install">
      <div class="install-head"><img src="icons/icon-192.png" width="40" height="40" alt="" /><span><b>홈 화면에 앱 추가하기</b><small>설치해야 순찰 알림을 받을 수 있어요</small></span>${close}</div>
      <ol class="install-steps-inline">
        <li><span class="step-n">1</span>화면 아래 <span class="key"><${Icon} name="share" size=${16} /></span> 공유 버튼</li>
        <li><span class="step-n">2</span><span class="key"><${Icon} name="addsq" size=${16} /> 홈 화면에 추가</span></li>
        <li><span class="step-n">3</span>오른쪽 위 <span class="key">추가</span></li>
      </ol>
      <p class="small muted">Safari가 아닌 다른 앱에서 열었다면 먼저 Safari로 열어 주세요.</p>
    </div>`;
  }

  // 4) 안드로이드(설치 버튼이 안 뜨는 브라우저)
  if (isAndroid()) {
    return html`<div class="install">
      <div class="install-head"><img src="icons/icon-192.png" width="40" height="40" alt="" /><span><b>홈 화면에 앱 추가하기</b><small>설치해야 순찰 알림을 받을 수 있어요</small></span>${close}</div>
      <ol class="install-steps-inline">
        <li><span class="step-n">1</span>브라우저 메뉴 <span class="key">⋮</span> 또는 <span class="key">≡</span></li>
        <li><span class="step-n">2</span><span class="key">앱 설치</span> 또는 <span class="key">홈 화면에 추가</span></li>
      </ol>
      ${!isChrome() && html`<a class="btn ghost sm" href=${chromeIntent()}>Chrome으로 열기</a>`}
    </div>`;
  }

  // 5) 컴퓨터: 휴대폰으로 QR 찍기
  if (!isMobile() && dismissible !== false) {
    return html`<div class="install row">
      <img class="qr" src="icons/qr-app.png" width="96" height="96" alt="앱 주소 QR코드" />
      <span><b>휴대폰으로 설치하기</b><small>휴대폰 카메라로 QR코드를 찍으면 바로 열려요.</small></span>
      ${close}
    </div>`;
  }
  return null;
}

// 초대하기: QR코드 + 링크(+가입 코드) 공유
export function InviteSheet({ onClose }) {
  const app = useApp();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState('');
  const [busy, run] = useBusy();
  useEffect(() => { if (app.me.isAdmin) app.store.getJoinCode().then(setCode).catch(() => {}); }, []);
  const url = publicUrl();
  const text = `[${app.config.schoolName} 순찰 앱]\n아래 링크를 눌러 설치해 주세요. (카카오톡에서 열면 자동으로 브라우저로 넘어가요)\n${url}${code ? `\n\n가입 코드: ${code}` : ''}`;
  const copy = (what, value) => run(async () => { if (await copyText(value)) setCopied(what); else throw new Error('복사하지 못했어요. 길게 눌러 직접 복사해 주세요.'); });
  const share = () => run(async () => {
    if (navigator.share) {
      try { await navigator.share({ title: '학생부 순찰 앱', text }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else await copy('text', text);
  });

  return html`<${Sheet} title="앱 초대하기" onClose=${onClose}>
    <div class="invite-qr"><img src="icons/qr-app.png" alt="앱 주소 QR코드" /><span>카메라로 찍으면 바로 열려요</span></div>
    <div class="invite-url"><span>${url}</span></div>
    ${code && html`<div class="invite-url"><span>가입 코드 <b>${code}</b></span></div>`}
    <div class="stack">
      ${navigator.share && html`<button class="btn primary block" onClick=${share} disabled=${busy}><${Icon} name="share" size=${18} />카톡 등으로 공유하기</button>`}
      <button class=${`btn block ${navigator.share ? 'ghost' : 'primary'}`} onClick=${() => copy('text', text)} disabled=${busy}><${Icon} name="copy" size=${18} />${copied === 'text' ? '복사됨 — 단톡방에 붙여넣으세요' : `초대 메시지 복사${code ? ' (링크 + 가입 코드)' : ''}`}</button>
    </div>
    <p class="hint">받은 사람이 링크를 누르면 설치 안내가 자동으로 나와요. 카카오톡에서 열면 기본 브라우저로 넘어가고, 안드로이드는 [설치하기] 버튼 한 번, 아이폰은 [공유 → 홈 화면에 추가]로 설치돼요.</p>
  </${Sheet}>`;
}
