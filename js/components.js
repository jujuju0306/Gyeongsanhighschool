// 여러 화면에서 같이 쓰는 부품: 순찰 카드, 순찰 상세, 일정 편집, 대타 요청 등
import { html, useState, useEffect, useApp, Icon, Avatar, Sheet, Field, useBusy } from './ui.js';
import {
  fmtDate, fmtShort, shiftStart, shiftEnd, telLink, smsLink, appUrl, timeAgo, byStart, todayStr, coverColor,
  PATROL_START, PATROL_END,
} from './utils.js';
import * as act from './actions.js';

export function MemberChips({ ids, small }) {
  const app = useApp();
  if (!ids?.length) return html`<span class="muted small">담당자 없음</span>`;
  return html`<div class="chips">${ids.map((id) => {
    const m = app.memberById(id);
    return html`<span key=${id} class="chip ${id === app.me.id ? 'me' : ''} ${small ? 'sm' : ''}">${m?.name || '(탈퇴)'}</span>`;
  })}</div>`;
}

export function ShiftCard({ shift, showDate }) {
  const app = useApp();
  const mine = shift.memberIds?.includes(app.me.id);
  const now = Date.now();
  const live = now >= shiftStart(shift) && now < shiftEnd(shift);
  const past = now >= shiftEnd(shift);
  return html`<button class="shift-card ${mine ? 'mine' : ''} ${past ? 'past' : ''}"
      onClick=${() => app.open(ShiftDetail, { shiftId: shift.id, initial: shift })}>
    <div class="shift-time" style=${`background:${coverColor(shift)}`}><strong>${shift.start}</strong><span>${shift.end}</span></div>
    <div class="shift-main">
      <div class="shift-title">
        ${showDate && html`<span class="date-tag">${fmtShort(shift.date)}</span>`}
        <span>${shift.name}</span>
        ${live && html`<span class="badge live">진행 중</span>`}
      </div>
      <div class="shift-people">${shift.location || '장소 미정'} · ${shift.memberIds.length
        ? shift.memberIds.map((id, i) => html`${i ? ', ' : ''}<span class=${id === app.me.id ? 'me' : ''}>${app.memberById(id)?.name || '(탈퇴)'}</span>`)
        : '담당자 없음'}</div>
    </div>
    <${Icon} name="right" cls="chev" size=${18} />
  </button>`;
}

export function ContactButtons({ member, compact }) {
  const app = useApp();
  if (!member || member.id === app.me.id) return null;
  const has = !!member.phone;
  return html`<div class="contact-btns">
    <a class="round-btn ${has ? '' : 'disabled'}" href=${has ? telLink(member.phone) : undefined} aria-label="${member.name}에게 전화"><${Icon} name="phone" size=${18} /></a>
    <a class="round-btn ${has ? '' : 'disabled'}" href=${has ? smsLink(member.phone, '') : undefined} aria-label="${member.name}에게 문자"><${Icon} name="sms" size=${18} /></a>
    ${!compact && html`<button class="round-btn primary" onClick=${() => app.openChat(member)} aria-label="${member.name}와 채팅"><${Icon} name="chat" size=${18} /></button>`}
  </div>`;
}

export function PersonRow({ member, right }) {
  const app = useApp();
  if (!member) return html`<div class="person-row"><span class="avatar">?</span><div class="person-info"><b>(탈퇴한 부원)</b></div></div>`;
  return html`<div class="person-row">
    <${Avatar} member=${member} />
    <div class="person-info">
      <b>${member.name}${member.id === app.me.id ? html` <span class="chip me sm">나</span>` : ''}</b>
      <span>${[member.grade ? `${member.grade}학년` : '', member.role].filter(Boolean).join(' · ')}</span>
      ${member.phone && html`<span class="phone">${member.phone}</span>`}
    </div>
    ${right ?? html`<${ContactButtons} member=${member} />`}
  </div>`;
}

export function ShiftDetail({ shiftId, initial, onClose }) {
  const app = useApp();
  const [shift, setShift] = useState(initial);
  const [busy, run] = useBusy();
  useEffect(() => app.store.watchShift(shiftId, (s) => (s ? setShift(s) : onClose())), [shiftId]);
  if (!shift) return null;
  const mine = shift.memberIds.includes(app.me.id);
  const future = shiftEnd(shift) > Date.now();
  const pending = app.requests.filter((r) => r.shiftId === shift.id && r.status === 'pending');
  const canManage = canManageShift(app, shift);

  const remove = () => run(async () => {
    if (!confirm(`${fmtShort(shift.date)} ${shift.name} 일정을 삭제할까요?\n담당자에게 취소 알림이 갑니다.`)) return;
    await act.deleteShift(app, shift);
    app.toast('일정을 삭제했어요');
    onClose();
  });
  const join = () => run(async () => {
    await act.joinShift(app, shift);
    app.toast(`${fmtShort(shift.date)} 순찰에 참여했어요`);
  });

  const footer = (future || canManage)
    ? html`${canManage && html`<button class="btn ghost" onClick=${remove} disabled=${busy}><${Icon} name="trash" size=${18} />삭제</button>
        <button class="btn ghost" onClick=${() => app.open(ShiftEditor, { shift })}><${Icon} name="edit" size=${18} />수정</button>`}
      ${future && mine && html`<button class="btn primary grow" onClick=${() => app.open(SwapRequestSheet, { shift })}><${Icon} name="swap" size=${18} />대타 요청</button>`}
      ${future && !mine && html`<button class="btn primary grow" onClick=${join} disabled=${busy}><${Icon} name="plus" size=${18} />참여하기</button>`}`
    : null;

  return html`<${Sheet} title="순찰 상세" onClose=${onClose} footer=${footer}>
    <div class="detail-head">
      <div class="detail-date">${fmtDate(shift.date)}</div>
      <h2>${shift.name} ${mine && html`<span class="badge">내 순찰</span>`}</h2>
      <div class="detail-meta">
        <span><${Icon} name="clock" size=${16} /> ${shift.start} ~ ${shift.end}</span>
        <span><${Icon} name="pin" size=${16} /> ${shift.location || '장소 미정'}</span>
      </div>
      ${shift.note && html`<p class="note">${shift.note}</p>`}
    </div>
    <h4 class="sub-title">담당자 ${shift.memberIds.length}명</h4>
    <div class="card list">${shift.memberIds.map((id) => html`<${PersonRow} key=${id} member=${app.memberById(id)} />`)}</div>
    ${pending.length > 0 && html`<h4 class="sub-title">진행 중인 대타 요청</h4>
      <div class="stack">${pending.map((r) => html`<${RequestCard} key=${r.id} req=${r} />`)}</div>`}
  </${Sheet}>`;
}

// 관리자이거나, 직접 추가한 순찰이면 수정·삭제 가능
export const canManageShift = (app, shift) => app.me.isAdmin || (shift.createdBy && shift.createdBy === app.me.id);

export function ShiftEditor({ shift, date, onClose }) {
  const app = useApp();
  const { me } = app;
  const slot = app.config.slots[0];
  const isNew = !shift;
  const isAdmin = me.isAdmin;
  const [f, setF] = useState(() => shift
    ? { date: shift.date, location: shift.location || '', memberIds: [...shift.memberIds], note: shift.note || '' }
    : { date: date && date >= todayStr() ? date : todayStr(), location: slot.location || '', memberIds: isAdmin ? [] : [me.id], note: '' });
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const locked = (id) => !isAdmin && id === me.id; // 일반 부원은 자기 자신을 뺄 수 없음
  const toggle = (id) => {
    if (locked(id)) return app.toast('본인은 빠질 수 없어요. 빠지려면 대타 요청을 이용해 주세요.', 'error');
    setF({ ...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter((x) => x !== id) : [...f.memberIds, id] });
  };
  const active = app.members.filter((m) => m.active !== false).sort((a, b) => (b.id === me.id) - (a.id === me.id) || a.name.localeCompare(b.name, 'ko'));

  const save = () => run(async () => {
    if (!f.date) throw new Error('날짜를 골라 주세요.');
    if (!isAdmin && f.date < todayStr()) throw new Error('지난 날짜에는 추가할 수 없어요.');
    if (!f.memberIds.length) throw new Error('담당자를 한 명 이상 골라 주세요.');
    const same = (await app.store.getShifts(f.date, f.date)).filter((s) => s.id !== shift?.id);
    if (same.length) throw new Error(`${fmtShort(f.date)}에는 이미 순찰이 있어요. 그 순찰을 눌러 [참여하기]를 해 주세요.`);
    await act.saveShift(app, shift || null, {
      id: shift?.id, date: f.date, slotId: 'morning', name: shift?.name || slot.name,
      start: PATROL_START, end: PATROL_END, location: f.location.trim(), memberIds: f.memberIds, note: f.note.trim(),
    });
    app.toast(isNew ? `${fmtShort(f.date)} 순찰을 추가했어요` : '일정을 수정했어요. 담당자에게 알림이 가요');
    onClose();
  });

  return html`<${Sheet} title=${isNew ? '순찰 추가' : '순찰 수정'} onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>취소</button><button class="btn primary grow" onClick=${save} disabled=${busy}>저장</button>`}>
    <div class="form">
      <div class="info-box"><${Icon} name="clock" size=${18} /><div><b>${slot.name} ${PATROL_START} ~ ${PATROL_END}</b><span>시간은 고정이에요 · 알림은 ${PATROL_START} 정각</span></div></div>
      <div class="row2">
        <${Field} label="날짜"><input type="date" value=${f.date} min=${isAdmin ? undefined : todayStr()} onInput=${set('date')} /></${Field}>
        <${Field} label="장소"><input value=${f.location} onInput=${set('location')} placeholder="예: 정문" /></${Field}>
      </div>
      <div class="field"><span class="field-label">함께할 사람 (${f.memberIds.length}명 · 권장 ${slot.size}명)</span>
        <div class="pick-grid">${active.map((m) => html`<button key=${m.id} type="button"
          class="pick ${f.memberIds.includes(m.id) ? 'on' : ''}" onClick=${() => toggle(m.id)}>
          ${f.memberIds.includes(m.id) && html`<${Icon} name="check" size=${14} />`}${m.id === me.id ? `${m.name} (나)` : m.name}</button>`)}</div>
        ${!isAdmin && html`<span class="field-hint">다른 사람을 넣으면 그 사람에게 배정 알림이 가요.</span>`}
      </div>
      <${Field} label="메모 (선택)"><textarea rows="2" value=${f.note} onInput=${set('note')} placeholder="예: 우천 시 본관 1층"></textarea></${Field}>
    </div>
  </${Sheet}>`;
}

export function SwapRequestSheet({ shift, onClose }) {
  const app = useApp();
  const { me } = app;
  const candidates = app.members
    .filter((m) => m.active !== false && !shift.memberIds.includes(m.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const [target, setTarget] = useState('ALL');
  const [edited, setEdited] = useState(false);
  const [sms, setSms] = useState(true);
  const info = `${fmtShort(shift.date)} ${shift.start} ${shift.name}(${shift.location || '장소 미정'})`;
  const makeMsg = (t) => {
    const m = app.memberById(t);
    return t === 'ALL'
      ? `${info} 순찰 대타 가능하신 분 계신가요? 사정이 생겨서 부탁드려요!`
      : `${m?.name}님, ${info} 순찰 대타 가능할까요? 사정이 생겨서 부탁드려요!`;
  };
  const [msg, setMsg] = useState(makeMsg('ALL'));
  const [busy, run] = useBusy();
  const choose = (t) => { setTarget(t); if (!edited) setMsg(makeMsg(t)); };

  const submit = () => run(async () => {
    if (!msg.trim()) throw new Error('메시지를 입력해 주세요.');
    const job = act.requestSwap(app, shift, target, msg.trim());
    if (sms) {
      const phones = target === 'ALL' ? candidates.map((m) => m.phone) : [app.memberById(target)?.phone];
      if (phones.filter(Boolean).length) {
        location.href = smsLink(phones, `[학생부 순찰 대타 요청]\n${msg.trim()}\n\n앱에서 수락하기: ${appUrl('#swap')}\n- ${me.name}`);
      }
    }
    await job;
    app.toast(target === 'ALL' ? '모든 부원에게 대타 요청을 보냈어요' : `${app.memberById(target)?.name}님에게 대타 요청을 보냈어요`);
    onClose();
  });

  return html`<${Sheet} title="대타 요청 보내기" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>취소</button>
      <button class="btn primary grow" onClick=${submit} disabled=${busy}><${Icon} name="send" size=${18} />요청 보내기</button>`}>
    <div class="info-box"><${Icon} name="calendar" size=${18} /><div><b>${fmtDate(shift.date)} ${shift.name}</b><span>${shift.start} ~ ${shift.end} · ${shift.location}</span></div></div>
    <div class="form">
      <div class="field"><span class="field-label">누구에게 부탁할까요?</span>
        <div class="pick-grid">
          <button type="button" class="pick wide ${target === 'ALL' ? 'on' : ''}" onClick=${() => choose('ALL')}><${Icon} name="users" size=${15} />전체 부원에게 공개 요청</button>
          ${candidates.map((m) => html`<button key=${m.id} type="button" class="pick ${target === m.id ? 'on' : ''}" onClick=${() => choose(m.id)}>${m.name}</button>`)}
        </div>
      </div>
      <${Field} label="메시지"><textarea rows="3" value=${msg} onInput=${(e) => { setMsg(e.target.value); setEdited(true); }}></textarea></${Field}>
      <label class="check-row"><input type="checkbox" checked=${sms} onChange=${(e) => setSms(e.target.checked)} />
        <span><b>문자 메시지로도 보내기</b><small>휴대폰 문자 앱이 열리고 내용이 자동으로 채워져요${target === 'ALL' ? ' (전체 단체 문자)' : ''}.</small></span></label>
      <p class="hint">상대가 앱에서 <b>수락</b>하면 순찰표가 자동으로 바뀌고, 결과가 알림으로 와요.</p>
    </div>
  </${Sheet}>`;
}

export function PickShiftSheet({ onClose }) {
  const app = useApp();
  const mine = app.upcoming
    .filter((s) => s.memberIds.includes(app.me.id) && shiftEnd(s) > Date.now())
    .sort(byStart);
  return html`<${Sheet} title="대타를 구할 순찰 선택" onClose=${onClose}>
    ${mine.length
      ? html`<div class="stack">${mine.map((s) => html`<button key=${s.id} class="pick-shift" onClick=${() => { onClose(); app.open(SwapRequestSheet, { shift: s }); }}>
          <div><b>${fmtDate(s.date)}</b><span>${s.start} ${s.name} · ${s.location}</span></div><${Icon} name="right" size=${18} /></button>`)}</div>`
      : html`<p class="muted center pad">앞으로 60일 안에 예정된 내 순찰이 없어요.</p>`}
  </${Sheet}>`;
}

const STATUS = {
  pending: ['대기 중', 'wait'], accepted: ['수락됨', 'ok'], declined: ['거절됨', 'no'], cancelled: ['취소됨', 'gray'],
};

export function RequestCard({ req }) {
  const app = useApp();
  const { me } = app;
  const [busy, run] = useBusy();
  const fromMe = req.fromUid === me.id;
  const toMe = req.toUid === me.id || (req.toUid === 'ALL' && !fromMe);
  const pending = req.status === 'pending';
  const expired = req.shiftDate < todayStr();
  const from = app.memberById(req.fromUid);
  const [st, cls] = STATUS[req.status] || ['', 'gray'];

  const accept = () => run(async () => {
    if (!confirm(`${fmtShort(req.shiftDate)} ${req.shiftName} 순찰을 ${req.fromName}님 대신 맡을까요?`)) return;
    await act.acceptRequest(app, req);
    app.toast('대타를 수락했어요. 순찰표가 변경되었어요');
  });
  const decline = () => run(async () => { await act.declineRequest(app, req); app.toast('요청을 거절했어요'); });
  const cancel = () => run(async () => {
    if (!confirm('대타 요청을 취소할까요?')) return;
    await act.cancelRequest(app, req);
    app.toast('요청을 취소했어요');
  });

  return html`<div class="req-card ${pending && toMe ? 'highlight' : ''}">
    <div class="req-top">
      <${Avatar} member=${from || { name: req.fromName, id: req.fromUid }} size=${34} />
      <div class="req-who"><b>${req.fromName}</b> <${Icon} name="right" size=${13} /> <b>${req.toUid === 'ALL' ? '전체 부원' : req.toName}</b>
        <span>${timeAgo(req.createdAt)}</span></div>
      <span class="status ${expired && pending ? 'gray' : cls}">${expired && pending ? '기간 지남' : st}</span>
    </div>
    <div class="req-shift"><${Icon} name="calendar" size=${15} /> ${fmtDate(req.shiftDate)} ${req.shiftStart || ''} ${req.shiftName}</div>
    ${req.message && html`<p class="req-msg">${req.message}</p>`}
    ${req.status === 'accepted' && html`<p class="req-result ok"><${Icon} name="check" size=${15} /> ${req.resolvedByName}님이 대타를 맡았어요</p>`}
    ${req.status === 'declined' && html`<p class="req-result">${req.resolvedByName}님이 거절했어요</p>`}
    ${pending && !expired && (toMe || fromMe) && html`<div class="req-actions">
      ${toMe && req.toUid !== 'ALL' && html`<button class="btn ghost sm" onClick=${decline} disabled=${busy}>거절</button>`}
      ${toMe && html`<button class="btn primary sm grow" onClick=${accept} disabled=${busy}><${Icon} name="check" size=${16} />${req.toUid === 'ALL' ? '제가 할게요' : '수락하기'}</button>`}
      ${toMe && from?.phone && html`<a class="round-btn" href=${telLink(from.phone)} aria-label="전화"><${Icon} name="phone" size=${17} /></a>`}
      ${fromMe && html`<button class="btn ghost sm" onClick=${cancel} disabled=${busy}>요청 취소</button>`}
      ${fromMe && req.toUid !== 'ALL' && app.memberById(req.toUid)?.phone && html`<a class="btn soft sm grow"
        href=${smsLink(app.memberById(req.toUid).phone, `[학생부 순찰 대타 요청]\n${req.message}\n\n앱에서 수락하기: ${appUrl('#swap')}`)}><${Icon} name="sms" size=${16} />문자 다시 보내기</a>`}
    </div>`}
  </div>`;
}
