// 연락: 단체 채팅방 / 1:1 채팅 / 연락처(전화·문자)
import { html, useApp, useState, useEffect, useRef, Icon, Avatar, Empty } from '../ui.js';
import { smsLink, timeAgo, clock, ymd } from '../utils.js';
import { PersonRow } from '../components.js';
import { sendChat } from '../actions.js';

export function Contact() {
  const app = useApp();
  const [seg, setSeg] = useState('chat');
  return html`<div class="page">
    <div class="segment full">
      <button class=${seg === 'chat' ? 'on' : ''} onClick=${() => setSeg('chat')}><${Icon} name="chat" size=${16} />채팅</button>
      <button class=${seg === 'people' ? 'on' : ''} onClick=${() => setSeg('people')}><${Icon} name="users" size=${16} />연락처</button>
    </div>
    ${seg === 'chat' ? html`<${ChatList} />` : html`<${People} />`}
  </div>`;
}

function ChatList() {
  const app = useApp();
  const { me } = app;
  const [rooms, setRooms] = useState([]);
  const [all, setAll] = useState(null);
  useEffect(() => app.store.watchRooms(me.id, setRooms), []);
  useEffect(() => app.store.watchRoom('all', setAll), []);
  const dms = rooms.filter((r) => r.id !== 'all' && r.lastAt).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));

  return html`<div class="card list">
    <button class="room-row" onClick=${() => app.openChat(null)}>
      <span class="room-ic"><${Icon} name="users" /></span>
      <span class="room-info"><b>학생부 단체방 <small>${app.members.filter((m) => m.active !== false).length}명</small></b>
        <span>${all?.lastText ? `${all.lastName}: ${all.lastText}` : '모든 부원이 함께 대화하는 방이에요'}</span></span>
      <span class="room-time">${timeAgo(all?.lastAt)}</span>
    </button>
    ${dms.map((r) => {
      const other = app.memberById(r.members.find((x) => x !== me.id));
      return html`<button key=${r.id} class="room-row" onClick=${() => other && app.openChat(other)}>
        <${Avatar} member=${other} size=${44} />
        <span class="room-info"><b>${other?.name || '(탈퇴한 부원)'}</b><span>${r.lastText || ''}</span></span>
        <span class="room-time">${timeAgo(r.lastAt)}</span>
      </button>`;
    })}
  </div>
  <p class="hint center">1:1 대화는 <b>연락처</b> 탭에서 부원을 골라 시작할 수 있어요.</p>`;
}

function People() {
  const app = useApp();
  const [q, setQ] = useState('');
  const list = app.members
    .filter((m) => m.active !== false)
    .filter((m) => !q || m.name.includes(q) || (m.role || '').includes(q) || (m.phone || '').includes(q))
    .sort((a, b) => (b.isAdmin - a.isAdmin) || ((b.grade || 0) - (a.grade || 0)) || a.name.localeCompare(b.name, 'ko'));
  const phones = app.members.filter((m) => m.active !== false && m.id !== app.me.id && m.phone).map((m) => m.phone);

  return html`
    <div class="search"><${Icon} name="search" size=${18} /><input placeholder="이름, 직책, 번호 검색" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    <a class="btn soft block" href=${smsLink(phones, '[학생부] ')}><${Icon} name="sms" size=${18} />전체 부원에게 단체 문자 (${phones.length}명)</a>
    <div class="card list">
      ${list.length ? list.map((m) => html`<${PersonRow} key=${m.id} member=${m} />`) : html`<${Empty} text="검색 결과가 없어요" icon="search" />`}
    </div>`;
}

// 채팅방 (화면 전체)
export function ChatRoom({ member, onClose }) {
  const app = useApp();
  const { me } = app;
  const room = member
    ? { id: `dm_${[me.id, member.id].sort().join('_')}`, members: [me.id, member.id].sort() }
    : { id: 'all', members: null };
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    let alive = true;
    let unsub;
    app.store.ensureRoom(room.id, room.members)
      .catch((e) => console.warn(e))
      .then(() => { if (alive) unsub = app.store.watchMessages(room.id, setMsgs); });
    return () => { alive = false; unsub?.(); };
  }, [room.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);
  useEffect(() => {
    document.body.classList.add('noscroll');
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('noscroll'); removeEventListener('keydown', onKey); };
  }, []);

  const send = (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    sendChat(app, room, t).catch((err) => { console.error(err); app.toast('메시지를 보내지 못했어요', 'error'); setText(t); });
    inputRef.current?.focus();
  };

  let lastDay = '';
  return html`<div class="chat-screen">
    <header class="chat-head">
      <button class="icon-btn" onClick=${onClose} aria-label="뒤로"><${Icon} name="left" /></button>
      ${member ? html`<${Avatar} member=${member} size=${34} />` : html`<span class="room-ic sm"><${Icon} name="users" size=${18} /></span>`}
      <div class="chat-title"><b>${member ? member.name : '학생부 단체방'}</b><span>${member ? member.role || '' : `${app.members.filter((m) => m.active !== false).length}명`}</span></div>
      ${member?.phone && html`<a class="round-btn" href=${`tel:${member.phone.replace(/[^0-9+]/g, '')}`} aria-label="전화"><${Icon} name="phone" size=${18} /></a>`}
    </header>
    <div class="chat-body">
      ${msgs === null ? html`<p class="muted center pad">불러오는 중…</p>`
        : msgs.length === 0 ? html`<${Empty} text="첫 메시지를 보내보세요" icon="chat" />`
        : msgs.map((m, i) => {
          const day = ymd(new Date(m.createdAt || Date.now()));
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.uid === me.id;
          const prev = msgs[i - 1];
          const grouped = prev && prev.uid === m.uid && !showDay;
          return html`<div key=${m.id}>
            ${showDay && html`<div class="day-sep"><span>${new Date(m.createdAt || Date.now()).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span></div>`}
            <div class="msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}">
              ${!mine && !grouped && html`<span class="msg-name">${m.name}</span>`}
              <div class="msg-line"><p class="bubble">${m.text}</p><time>${clock(m.createdAt || Date.now())}</time></div>
            </div>
          </div>`;
        })}
      <div ref=${endRef}></div>
    </div>
    <form class="chat-input" onSubmit=${send}>
      <input ref=${inputRef} value=${text} onInput=${(e) => setText(e.target.value)} placeholder="메시지 입력" enterkeyhint="send" maxlength="1000" />
      <button class="send-btn" type="submit" disabled=${!text.trim()} aria-label="보내기"><${Icon} name="send" size=${20} /></button>
    </form>
  </div>`;
}
