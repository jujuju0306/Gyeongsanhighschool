// 앱 본체: 로그인 → 메인 화면(하단 탭) 전환, 실시간 데이터 구독, 알림 처리
import { html, render, useState, useEffect, useMemo, useCallback, AppCtx, Icon, Field } from './ui.js';
import { getStore } from './store/index.js';
import { DEFAULT_CONFIG, DEFAULT_PREFS, todayStr, ymd, addDays, shiftStart } from './utils.js';
import { enablePush, showLocal, pushState } from './push.js';
import { Home } from './screens/home.js';
import { Schedule } from './screens/schedule.js';
import { Swap } from './screens/swap.js';
import { Contact, ChatRoom } from './screens/contact.js';
import { More } from './screens/more.js';

const TABS = [
  { id: 'home', label: '홈', icon: 'home', C: Home },
  { id: 'schedule', label: '일정표', icon: 'calendar', C: Schedule },
  { id: 'swap', label: '대타', icon: 'swap', C: Swap },
  { id: 'contact', label: '연락', icon: 'chat', C: Contact },
  { id: 'more', label: '더보기', icon: 'more', C: More },
];
const hashTab = () => {
  const h = location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'home';
};

let store;

// ---------------- 로그인 / 회원가입 ----------------
function Logo({ size = 64 }) {
  return html`<img class="logo-img" src="icons/icon.svg" width=${size} height=${size} alt="" />`;
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', pw: '', name: '', phone: '', role: '부원', grade: '1', joinCode: '' });
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const demo = store.mode === 'demo';

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') await store.signIn(f.email, f.pw);
      else {
        if (!f.name.trim() || !f.phone.trim()) throw new Error('이름과 휴대폰 번호를 입력해 주세요.');
        if (!f.joinCode.trim()) throw new Error('학생부 가입 코드를 입력해 주세요.');
        const uid = await store.signUp(f.email, f.pw);
        await store.createMember({ uid, name: f.name.trim(), phone: f.phone.trim(), role: f.role.trim(), grade: f.grade, joinCode: f.joinCode });
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setErr(''); setInfo('');
    if (!f.email) return setErr('비밀번호를 재설정할 이메일을 먼저 입력해 주세요.');
    try { await store.resetPassword(f.email); setInfo('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.'); } catch (e2) { setErr(e2.message); }
  };

  return html`<div class="auth">
    <div class="auth-hero">
      <${Logo} size=${72} />
      <h1>학생부 순찰</h1>
      <p>순찰 일정 확인 · 알림 · 대타 요청을 한 곳에서</p>
    </div>
    ${demo && html`<div class="demo-box">
      <b>데모 모드</b> — Firebase를 연결하기 전 미리보기예요. 아래 부원을 눌러 바로 들어가 보세요.
      <div class="demo-list">${store.demoAccounts().map((m) => html`<button key=${m.id} onClick=${() => store.signInAs(m.id)}>
        ${m.name}<small>${m.isAdmin ? '관리자' : m.role}</small></button>`)}</div>
      <small>데모 가입 코드: <b>demo</b> · 데모 비밀번호: <b>123456</b></small>
    </div>`}
    <form class="auth-card" onSubmit=${submit}>
      <div class="segment full">
        <button type="button" class=${mode === 'login' ? 'on' : ''} onClick=${() => { setMode('login'); setErr(''); }}>로그인</button>
        <button type="button" class=${mode === 'signup' ? 'on' : ''} onClick=${() => { setMode('signup'); setErr(''); }}>회원가입</button>
      </div>
      ${mode === 'signup' && html`
        <div class="row2">
          <${Field} label="이름"><input value=${f.name} onInput=${set('name')} autocomplete="name" required /></${Field}>
          <${Field} label="학년"><select value=${f.grade} onChange=${set('grade')}>${[1, 2, 3].map((g) => html`<option value=${g}>${g}학년</option>`)}</select></${Field}>
        </div>
        <div class="row2">
          <${Field} label="휴대폰 번호"><input type="tel" value=${f.phone} onInput=${set('phone')} placeholder="010-0000-0000" autocomplete="tel" required /></${Field}>
          <${Field} label="직책"><input value=${f.role} onInput=${set('role')} placeholder="부원" /></${Field}>
        </div>`}
      <${Field} label="이메일"><input type="email" value=${f.email} onInput=${set('email')} autocomplete="email" required /></${Field}>
      <${Field} label="비밀번호"><input type="password" value=${f.pw} onInput=${set('pw')} autocomplete=${mode === 'login' ? 'current-password' : 'new-password'} minlength="6" required /></${Field}>
      ${mode === 'signup' && html`<${Field} label="학생부 가입 코드" hint="학생부장(관리자)에게 받은 코드를 입력하세요"><input value=${f.joinCode} onInput=${set('joinCode')} required /></${Field}>`}
      ${err && html`<p class="form-error">${err}</p>`}
      ${info && html`<p class="form-info">${info}</p>`}
      <button class="btn primary block lg" type="submit" disabled=${busy}>${busy ? '잠시만요…' : mode === 'login' ? '로그인' : '가입하기'}</button>
      ${mode === 'login' && html`<button type="button" class="link center" onClick=${reset}>비밀번호를 잊어버렸어요</button>`}
    </form>
  </div>`;
}

// 로그인은 했지만 부원 등록(가입 코드)이 안 된 경우
function JoinScreen({ user }) {
  const [f, setF] = useState({ name: '', phone: '', role: '부원', grade: '1', joinCode: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (!f.name.trim() || !f.phone.trim()) throw new Error('이름과 휴대폰 번호를 입력해 주세요.');
      await store.createMember({ uid: user.uid, ...f, name: f.name.trim(), phone: f.phone.trim() });
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return html`<div class="auth">
    <div class="auth-hero"><${Logo} size=${60} /><h1>부원 등록</h1><p>${user.email} 계정으로 로그인했어요.<br />학생부 정보를 입력해 등록을 마쳐 주세요.</p></div>
    <form class="auth-card" onSubmit=${submit}>
      <div class="row2">
        <${Field} label="이름"><input value=${f.name} onInput=${set('name')} required /></${Field}>
        <${Field} label="학년"><select value=${f.grade} onChange=${set('grade')}>${[1, 2, 3].map((g) => html`<option value=${g}>${g}학년</option>`)}</select></${Field}>
      </div>
      <div class="row2">
        <${Field} label="휴대폰 번호"><input type="tel" value=${f.phone} onInput=${set('phone')} required /></${Field}>
        <${Field} label="직책"><input value=${f.role} onInput=${set('role')} /></${Field}>
      </div>
      <${Field} label="학생부 가입 코드"><input value=${f.joinCode} onInput=${set('joinCode')} required /></${Field}>
      ${err && html`<p class="form-error">${err}</p>`}
      <button class="btn primary block lg" disabled=${busy}>등록하기</button>
      <button type="button" class="link center" onClick=${() => store.signOut()}>다른 계정으로 로그인</button>
    </form>
  </div>`;
}

function Blocked() {
  return html`<div class="auth"><div class="auth-hero"><${Logo} size=${60} /><h1>비활성화된 계정</h1>
    <p>관리자가 이 계정을 비활성화했어요.<br />학생부장에게 문의해 주세요.</p></div>
    <button class="btn soft block" onClick=${() => store.signOut()}>로그아웃</button></div>`;
}

// ---------------- 메인 화면 ----------------
function Main({ user, me }) {
  const [tab, setTabState] = useState(hashTab);
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [upcoming, setUpcoming] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [chat, setChat] = useState(undefined); // undefined=닫힘, null=단체방, member=1:1
  const [installPrompt, setInstallPrompt] = useState(window.__installPrompt || null);
  const [, setTick] = useState(0);
  const today = todayStr();

  useEffect(() => store.watchMembers(setMembers), []);
  useEffect(() => store.watchConfig((c) => setConfig({ ...DEFAULT_CONFIG, ...(c || {}) })), []);
  useEffect(() => store.watchShifts(today, ymd(addDays(new Date(), 60)), setUpcoming), [today]);
  useEffect(() => store.watchRequests(ymd(addDays(new Date(), -30)), setRequests), []);

  const toast = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const open = useCallback((C, props = {}) => setSheets((s) => [...s, { C, props, key: Math.random() }]), []);
  const closeKey = (key) => setSheets((s) => s.filter((x) => x.key !== key));
  const setTab = useCallback((t) => {
    setTabState(t);
    history.replaceState(null, '', `#${t}`);
    scrollTo(0, 0);
  }, []);

  // 해시(#swap 등)·알림 클릭으로 탭 이동
  useEffect(() => {
    const onHash = () => setTabState(hashTab());
    const onSw = (e) => {
      if (e.data?.type === 'open') {
        const h = String(e.data.url || '').split('#')[1];
        if (h) { setSheets([]); setChat(undefined); setTab(TABS.some((t) => t.id === h) ? h : 'home'); }
      }
    };
    addEventListener('hashchange', onHash);
    navigator.serviceWorker?.addEventListener('message', onSw);
    const onInstall = (e) => setInstallPrompt(e.detail);
    addEventListener('patrol:installable', onInstall);
    return () => {
      removeEventListener('hashchange', onHash);
      navigator.serviceWorker?.removeEventListener('message', onSw);
      removeEventListener('patrol:installable', onInstall);
    };
  }, []);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const app = useMemo(() => ({
    store, user, me, members, config, upcoming, requests, toast, open, setTab, installPrompt,
    memberById: (id) => memberMap.get(id),
    openChat: (m) => setChat(m),
    refresh: () => setTick((t) => t + 1),
  }), [user, me, members, config, upcoming, requests, installPrompt, memberMap]);

  // 알림 권한이 이미 있으면 푸시 토큰을 조용히 갱신
  useEffect(() => { if (pushState() === 'granted') enablePush(app, { silent: true }).catch((e) => console.warn(e)); }, [me.id]);

  // 데모 모드: 다른 탭/사용자가 보낸 알림을 즉시 표시
  useEffect(() => {
    const on = (e) => {
      const o = e.detail;
      toast(`🔔 ${o.title} — ${o.body}`, 'info');
      if (document.hidden) showLocal(o.title, o.body, { url: o.url, tag: o.group });
    };
    addEventListener('patrol:notify', on);
    return () => removeEventListener('patrol:notify', on);
  }, []);

  // 앱이 열려 있는 동안 순찰 시작 전 알림 (서버 알림이 늦을 때 대비)
  useEffect(() => {
    const check = () => {
      const prefs = { ...DEFAULT_PREFS, ...(me.prefs || {}) };
      if (prefs.leadMin < 0) return;
      const now = Date.now();
      for (const s of upcoming) {
        if (!s.memberIds.includes(me.id)) continue;
        const st = shiftStart(s).getTime();
        const key = `patrol-local-${s.id}-${s.date}-${s.start}`;
        if (now >= st - prefs.leadMin * 60000 && now < st && !localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          const left = Math.max(1, Math.round((st - now) / 60000));
          toast(`⏰ ${left}분 후 ${s.name} (${s.location}) 순찰이에요!`, 'info');
          showLocal(`${left}분 후 순찰 시간이에요`, `${s.name} ${s.start}~${s.end} · ${s.location}`, { tag: `soon_${s.id}` });
        }
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [upcoming, me]);

  const incoming = requests.filter((r) => r.status === 'pending' && r.fromUid !== me.id && (r.toUid === me.id || r.toUid === 'ALL') && r.shiftDate >= today).length;
  const Current = TABS.find((t) => t.id === tab).C;

  return html`<${AppCtx.Provider} value=${app}>
    <div class="app">
      <header class="topbar">
        <img class="logo-img" src="icons/icon.svg" width="34" height="34" alt="" />
        <div class="topbar-title"><h1>학생부 순찰</h1><span>${config.schoolName}</span></div>
        ${store.mode === 'demo' && html`<span class="demo-pill">데모</span>`}
        <button class="icon-btn bell ${incoming ? 'has' : ''}" onClick=${() => setTab('swap')} aria-label="대타 요청 ${incoming}건">
          <${Icon} name="bell" />${incoming > 0 && html`<i>${incoming}</i>`}
        </button>
      </header>
      <main class="content"><${Current} /></main>
      <nav class="nav"><div class="nav-inner">
        ${TABS.map((t) => html`<button key=${t.id} class=${tab === t.id ? 'active' : ''} onClick=${() => setTab(t.id)} aria-current=${tab === t.id ? 'page' : undefined}>
          <${Icon} name=${t.icon} size=${23} /><span>${t.label}</span>
          ${t.id === 'swap' && incoming > 0 && html`<i class="dot">${incoming}</i>`}
        </button>`)}
      </div></nav>
    </div>
    ${sheets.map(({ C, props, key }) => html`<${C} key=${key} ...${props} onClose=${() => closeKey(key)} />`)}
    ${chat !== undefined && html`<${ChatRoom} key=${chat?.id || 'all'} member=${chat} onClose=${() => setChat(undefined)} />`}
    <div class="toasts" aria-live="polite">${toasts.map((t) => html`<div key=${t.id} class="toast ${t.kind}">${t.text}</div>`)}</div>
  </${AppCtx.Provider}>`;
}

function Root() {
  const [user, setUser] = useState(undefined);
  const [me, setMe] = useState(undefined);
  useEffect(() => store.onAuth(setUser), []);
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setMe(null); return; }
    setMe(undefined);
    return store.watchMe(user.uid, setMe);
  }, [user?.uid, user === null]);

  if (user === undefined || (user && me === undefined)) return html`<div class="splash"><${Logo} size=${72} /><p>불러오는 중…</p></div>`;
  if (!user) return html`<${AuthScreen} />`;
  if (!me) return html`<${JoinScreen} user=${user} />`;
  if (me.active === false) return html`<${Blocked} />`;
  return html`<${Main} user=${user} me=${me} />`;
}

// ---------------- 시작 ----------------
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  dispatchEvent(new CustomEvent('patrol:installable', { detail: e }));
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('서비스 워커 등록 실패', e));
}

try {
  store = await getStore();
  render(html`<${Root} />`, document.getElementById('root'));
} catch (e) {
  console.error(e);
  document.getElementById('root').innerHTML = `<div class="splash"><p><b>앱을 시작하지 못했어요.</b><br>인터넷 연결을 확인하고 다시 열어 주세요.<br><small>${String(e.message || e).replace(/</g, '&lt;')}</small></p></div>`;
}
