// 관리자 기능: 순번 자동 생성, 순찰 시간대 설정, 부원 관리, 가입 코드, 변경 기록, 백업
import { html, useApp, useState, useEffect, Icon, Avatar, Sheet, Field, Empty, useBusy } from '../ui.js';
import {
  ymd, addDays, parseYmd, todayStr, fmtShort, generateRotation, parseDateList, DOW, newId, timeAgo, download, toCsv, byStart,
} from '../utils.js';

// ---------- 순번(로테이션) 자동 생성 ----------
export function Generator({ defaultFrom, onClose }) {
  const app = useApp();
  const slots = app.config.slots || [];
  const active = app.members.filter((m) => m.active !== false);
  const start = defaultFrom && defaultFrom > todayStr() ? defaultFrom : todayStr();
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(ymd(addDays(parseYmd(start), 27)));
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [skip, setSkip] = useState('');
  const [slotIds, setSlotIds] = useState(slots.map((s) => s.id));
  const [order, setOrder] = useState(() => active.sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((m) => m.id));
  const [excluded, setExcluded] = useState([]);
  const [mode, setMode] = useState('fill');
  const [busy, run] = useBusy();

  const toggleIn = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const memberIds = order.filter((id) => !excluded.includes(id));
  const chosenSlots = slots.filter((s) => slotIds.includes(s.id));
  const preview = generateRotation({ from, to, weekdays, skip: parseDateList(skip), slots: chosenSlots, memberIds });
  const perPerson = memberIds.length ? (preview.reduce((n, s) => n + s.memberIds.length, 0) / memberIds.length).toFixed(1) : 0;
  const shuffle = () => {
    const a = [...order];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setOrder(a);
  };
  const moveUp = (i) => { if (i === 0) return; const a = [...order]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setOrder(a); };

  const create = () => run(async () => {
    if (!preview.length) throw new Error('생성할 일정이 없어요. 기간·요일·시간대를 확인해 주세요.');
    const existing = await app.store.getShifts(from, to);
    let list = preview;
    if (mode === 'replace') {
      if (existing.length && !confirm(`기간 안의 기존 일정 ${existing.length}개를 지우고 새로 만들까요?`)) return;
      await app.store.deleteShifts(existing.map((s) => s.id));
    } else {
      const has = new Set(existing.map((s) => `${s.date}|${s.slotId}`));
      list = preview.filter((s) => !has.has(`${s.date}|${s.slotId}`));
      if (!list.length) throw new Error('이미 모든 시간대에 일정이 있어요. "기존 일정 지우고 새로 만들기"를 선택해 보세요.');
    }
    await app.store.addShifts(list);
    await app.store.notify(['ALL'], {
      title: '새 순찰표가 나왔어요', body: `${fmtShort(from)} ~ ${fmtShort(to)} 순찰 일정이 등록되었어요. 내 순찰을 확인하세요!`,
      url: '#schedule', fromUid: app.me.id, group: 'generate',
    });
    await app.store.log({ by: app.me.id, byName: app.me.name, action: 'generate', summary: `순번 자동 생성 ${fmtShort(from)}~${fmtShort(to)} · ${list.length}개 일정` });
    app.toast(`순찰 일정 ${list.length}개를 만들었어요`);
    onClose();
  });

  return html`<${Sheet} title="순번 자동 생성" onClose=${onClose} full
    footer=${html`<button class="btn ghost" onClick=${onClose}>취소</button>
      <button class="btn primary grow" onClick=${create} disabled=${busy}><${Icon} name="wand" size=${18} />일정 ${preview.length}개 만들기</button>`}>
    <div class="form">
      <div class="row2">
        <${Field} label="시작일"><input type="date" value=${from} onInput=${(e) => setFrom(e.target.value)} /></${Field}>
        <${Field} label="종료일"><input type="date" value=${to} onInput=${(e) => setTo(e.target.value)} /></${Field}>
      </div>
      <div class="field"><span class="field-label">순찰 요일</span>
        <div class="pick-grid">${DOW.map((d, i) => html`<button type="button" class="pick day ${weekdays.includes(i) ? 'on' : ''}" onClick=${() => toggleIn(weekdays, setWeekdays, i)}>${d}</button>`)}</div>
      </div>
      <div class="field"><span class="field-label">시간대</span>
        <div class="pick-grid">${slots.map((s) => html`<button type="button" class="pick ${slotIds.includes(s.id) ? 'on' : ''}" onClick=${() => toggleIn(slotIds, setSlotIds, s.id)}>${s.name} ${s.start} · ${s.size}명</button>`)}</div>
        <span class="field-hint">시간대·인원은 더보기 → 순찰 시간대 설정에서 바꿀 수 있어요.</span>
      </div>
      <${Field} label="제외할 날짜 (공휴일·시험·방학 등)" hint="예: 2026-12-25, 2026-12-31 (쉼표 또는 줄바꿈으로 구분)">
        <textarea rows="2" value=${skip} onInput=${(e) => setSkip(e.target.value)} placeholder="2026-12-25"></textarea>
      </${Field}>
      <div class="field"><span class="field-label">순번 (위에서부터 차례대로 배정 · 탭하면 제외)</span>
        <div class="order-tools"><button type="button" class="btn soft sm" onClick=${shuffle}><${Icon} name="shuffle" size=${16} />순서 섞기</button>
          <span class="muted small">${memberIds.length}명 참여</span></div>
        <div class="order-list">${order.map((id, i) => {
          const m = app.memberById(id);
          const off = excluded.includes(id);
          return html`<div key=${id} class="order-item ${off ? 'off' : ''}">
            <span class="order-no">${i + 1}</span>
            <button type="button" class="order-name" onClick=${() => toggleIn(excluded, setExcluded, id)}>${m?.name}${off ? ' (제외)' : ''}</button>
            <button type="button" class="icon-btn sm" onClick=${() => moveUp(i)} aria-label="위로" disabled=${i === 0}>▲</button>
          </div>`;
        })}</div>
      </div>
      <div class="field"><span class="field-label">기존 일정 처리</span>
        <label class="radio-row"><input type="radio" name="mode" checked=${mode === 'fill'} onChange=${() => setMode('fill')} /><span>기존 일정은 그대로 두고 <b>빈 시간대만</b> 채우기</span></label>
        <label class="radio-row"><input type="radio" name="mode" checked=${mode === 'replace'} onChange=${() => setMode('replace')} /><span>기간 안의 기존 일정을 <b>지우고 새로</b> 만들기</span></label>
      </div>
      <div class="info-box"><${Icon} name="info" size=${18} /><div><b>미리보기: 순찰 ${preview.length}개</b><span>1인당 평균 ${perPerson}회 · 생성 후 모든 부원에게 알림이 가요</span></div></div>
    </div>
  </${Sheet}>`;
}

// ---------- 순찰 시간대 설정 ----------
export function SlotsEditor({ onClose }) {
  const app = useApp();
  const [slots, setSlots] = useState(() => (app.config.slots || []).map((s) => ({ ...s })));
  const [school, setSchool] = useState(app.config.schoolName || '');
  const [hour, setHour] = useState(app.config.dayBeforeHour ?? 20);
  const [busy, run] = useBusy();
  const upd = (i, k, v) => setSlots(slots.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const add = () => setSlots([...slots, { id: newId(), name: '새 순찰', start: '12:00', end: '12:30', location: '', size: 2 }]);
  const save = () => run(async () => {
    if (slots.some((s) => !s.name.trim() || !s.start || !s.end)) throw new Error('모든 시간대에 이름과 시간을 입력해 주세요.');
    await app.store.saveConfig({
      schoolName: school.trim() || '학생부', dayBeforeHour: Number(hour),
      slots: slots.map((s) => ({ ...s, name: s.name.trim(), size: Math.max(1, Number(s.size) || 1) })),
    });
    await app.store.log({ by: app.me.id, byName: app.me.name, action: 'config', summary: '순찰 시간대/기본 설정 변경' });
    app.toast('설정을 저장했어요');
    onClose();
  });
  return html`<${Sheet} title="순찰 시간대 설정" onClose=${onClose} full
    footer=${html`<button class="btn ghost" onClick=${onClose}>취소</button><button class="btn primary grow" onClick=${save} disabled=${busy}>저장</button>`}>
    <div class="form">
      <${Field} label="학교 / 단체 이름"><input value=${school} onInput=${(e) => setSchool(e.target.value)} /></${Field}>
      <${Field} label="전날 알림 시각" hint="순찰 전날 이 시각에 '내일 순찰' 알림이 가요.">
        <select value=${hour} onChange=${(e) => setHour(e.target.value)}>${[17, 18, 19, 20, 21, 22].map((h) => html`<option value=${h}>${h}시</option>`)}</select>
      </${Field}>
      ${slots.map((s, i) => html`<div key=${s.id} class="slot-card">
        <div class="row2">
          <${Field} label="이름"><input value=${s.name} onInput=${(e) => upd(i, 'name', e.target.value)} /></${Field}>
          <${Field} label="장소"><input value=${s.location} onInput=${(e) => upd(i, 'location', e.target.value)} /></${Field}>
        </div>
        <div class="row3">
          <${Field} label="시작"><input type="time" value=${s.start} onInput=${(e) => upd(i, 'start', e.target.value)} /></${Field}>
          <${Field} label="종료"><input type="time" value=${s.end} onInput=${(e) => upd(i, 'end', e.target.value)} /></${Field}>
          <${Field} label="인원"><input type="number" min="1" max="10" value=${s.size} onInput=${(e) => upd(i, 'size', e.target.value)} /></${Field}>
        </div>
        <button type="button" class="link danger" onClick=${() => setSlots(slots.filter((_, j) => j !== i))}><${Icon} name="trash" size=${15} />이 시간대 삭제</button>
      </div>`)}
      <button type="button" class="btn soft block" onClick=${add}><${Icon} name="plus" size=${18} />시간대 추가</button>
    </div>
  </${Sheet}>`;
}

// ---------- 부원 관리 ----------
export function MembersAdmin({ onClose }) {
  const app = useApp();
  const [busy, run] = useBusy();
  const list = [...app.members].sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name, 'ko'));
  const setFlag = (m, patch, msg) => run(async () => {
    if (m.id === app.me.id && (patch.isAdmin === false || patch.active === false) && !confirm('내 권한을 바꾸면 관리자 메뉴를 쓸 수 없게 돼요. 계속할까요?')) return;
    await app.store.updateMember(m.id, patch);
    await app.store.log({ by: app.me.id, byName: app.me.name, action: 'member', summary: `${m.name} ${msg}` });
    app.toast(`${m.name}: ${msg}`);
  });
  const remove = (m) => run(async () => {
    if (!confirm(`${m.name}님을 부원 목록에서 완전히 삭제할까요?\n(순찰표의 기존 배정은 남아 있어요)`)) return;
    await app.store.removeMember(m.id);
    await app.store.log({ by: app.me.id, byName: app.me.name, action: 'member', summary: `${m.name} 부원 삭제` });
  });
  return html`<${Sheet} title="부원 관리" onClose=${onClose} full>
    <p class="hint">새 부원은 앱에서 <b>가입 코드</b>로 직접 가입해요. 졸업·탈퇴한 부원은 '비활성'으로 바꾸면 로그인과 배정에서 빠져요.</p>
    <div class="card list">${list.map((m) => html`<div key=${m.id} class="admin-member ${m.active === false ? 'off' : ''}">
      <${Avatar} member=${m} />
      <div class="person-info"><b>${m.name} ${m.isAdmin && html`<span class="chip sm">관리자</span>`}</b>
        <span>${m.grade}학년 · ${m.role || '부원'} · ${m.phone || '번호 없음'}</span></div>
      <div class="admin-actions">
        <button class="btn sm ${m.isAdmin ? 'soft' : 'ghost'}" disabled=${busy} onClick=${() => setFlag(m, { isAdmin: !m.isAdmin }, m.isAdmin ? '관리자 해제' : '관리자 지정')}>${m.isAdmin ? '관리자 해제' : '관리자로'}</button>
        <button class="btn sm ghost" disabled=${busy} onClick=${() => setFlag(m, { active: m.active === false }, m.active === false ? '다시 활성화' : '비활성화')}>${m.active === false ? '활성화' : '비활성'}</button>
        <button class="icon-btn sm danger" disabled=${busy} onClick=${() => remove(m)} aria-label="삭제"><${Icon} name="trash" size=${16} /></button>
      </div>
    </div>`)}</div>
  </${Sheet}>`;
}

// ---------- 가입 코드 ----------
export function JoinCodeSheet({ onClose }) {
  const app = useApp();
  const [code, setCode] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, run] = useBusy();
  useEffect(() => { app.store.getJoinCode().then((c) => { setCode(c); setLoaded(true); }).catch(() => setLoaded(true)); }, []);
  const save = () => run(async () => {
    if (code.trim().length < 4) throw new Error('가입 코드는 4자 이상으로 정해 주세요.');
    await app.store.setJoinCode(code.trim());
    app.toast('가입 코드를 바꿨어요');
    onClose();
  });
  return html`<${Sheet} title="가입 코드" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>닫기</button><button class="btn primary grow" disabled=${busy || !loaded} onClick=${save}>저장</button>`}>
    <p class="hint">학생부 임원만 가입할 수 있도록, 회원가입할 때 이 코드를 입력해야 해요. 단톡방 등으로 임원에게만 알려주세요.</p>
    <${Field} label="현재 가입 코드"><input value=${code} onInput=${(e) => setCode(e.target.value)} placeholder=${loaded ? '코드 입력' : '불러오는 중…'} /></${Field}>
  </${Sheet}>`;
}

// ---------- 변경 기록 ----------
const ACTION_ICON = { create: 'plus', update: 'edit', delete: 'trash', swap: 'swap', request: 'send', generate: 'wand', member: 'user', config: 'sliders' };
export function HistorySheet({ onClose }) {
  const app = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => app.store.watchHistory(setItems), []);
  return html`<${Sheet} title="일정 변경 기록" onClose=${onClose} full>
    ${items === null ? html`<p class="muted center pad">불러오는 중…</p>`
      : items.length === 0 ? html`<${Empty} text="아직 기록이 없어요" icon="history" />`
      : html`<div class="timeline">${items.map((h) => html`<div key=${h.id} class="tl-item">
          <span class="tl-ic"><${Icon} name=${ACTION_ICON[h.action] || 'info'} size=${15} /></span>
          <div><p>${h.summary}</p><small>${h.byName} · ${timeAgo(h.at)}</small></div>
        </div>`)}</div>`}
  </${Sheet}>`;
}

// ---------- 백업 ----------
export function BackupSheet({ onClose }) {
  const app = useApp();
  const [busy, run] = useBusy();
  const stamp = ymd(new Date());
  const json = () => run(async () => {
    const data = await app.store.exportAll();
    download(`학생부순찰_백업_${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
  });
  const csv = () => run(async () => {
    const data = await app.store.exportAll();
    const name = (id) => data.members.find((m) => m.id === id)?.name || '?';
    const rows = [['날짜', '요일', '순찰', '시작', '종료', '장소', '담당자', '메모']];
    for (const s of [...data.shifts].sort(byStart)) {
      rows.push([s.date, DOW[parseYmd(s.date).getDay()], s.name, s.start, s.end, s.location, s.memberIds.map(name).join(' / '), s.note || '']);
    }
    download(`학생부순찰표_${stamp}.csv`, toCsv(rows), 'text/csv');
  });
  return html`<${Sheet} title="데이터 백업" onClose=${onClose}>
    <p class="hint">${app.store.mode === 'firebase'
      ? '모든 데이터는 Firebase 클라우드에 자동 저장되고 있어요. 혹시 모를 때를 대비해 파일로도 받아둘 수 있어요.'
      : '데모 모드에서는 이 기기에만 저장돼요. Firebase를 연결하면 클라우드에 자동 저장돼요.'}</p>
    <div class="stack">
      <button class="menu-row" onClick=${csv} disabled=${busy}><${Icon} name="download" /><span><b>순찰표 엑셀(CSV) 받기</b><small>엑셀·구글 시트에서 열어 인쇄할 수 있어요</small></span></button>
      <button class="menu-row" onClick=${json} disabled=${busy}><${Icon} name="cloud" /><span><b>전체 데이터 백업(JSON)</b><small>일정·부원·요청·기록 전체</small></span></button>
    </div>
  </${Sheet}>`;
}
