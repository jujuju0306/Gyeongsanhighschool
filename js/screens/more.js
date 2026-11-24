// 더보기: 내 정보, 알림 설정, 캘린더 내보내기, 앱 설치 안내, 관리자 메뉴
import { html, useApp, useState, Icon, Avatar, Sheet, Field, Toggle, useBusy } from '../ui.js';
import { DEFAULT_PREFS, PATROL_START, buildIcs, download, shiftEnd, byStart, isIOS, isStandalone } from '../utils.js';
import { pushState, enablePush, showLocal } from '../push.js';
import { Generator, SlotsEditor, MembersAdmin, JoinCodeSheet, HistorySheet, BackupSheet } from './admin.js';
import { InviteSheet, InstallCard } from '../install.js';

const MenuRow = ({ icon, title, desc, onClick, right }) => html`<button class="menu-row" onClick=${onClick}>
  <${Icon} name=${icon} /><span><b>${title}</b>${desc && html`<small>${desc}</small>`}</span>${right ?? html`<${Icon} name="right" size=${18} cls="chev" />`}
</button>`;

export function More() {
  const app = useApp();
  const { me, store } = app;
  const prefs = { ...DEFAULT_PREFS, ...(me.prefs || {}) };
  const [busy, run] = useBusy();
  const st = pushState();
  const setPref = (k, v) => run(() => store.updateMember(me.id, { prefs: { ...prefs, [k]: v } }));

  const turnOnPush = () => run(async () => { await enablePush(app); app.toast('알림이 켜졌어요'); app.refresh(); });
  const testPush = () => run(async () => {
    const ok = await showLocal('학생부 순찰 알림 테스트', '이렇게 휴대폰에 알림이 와요!', { tag: 'test' });
    app.toast(ok ? '테스트 알림을 보냈어요' : '알림 권한이 없어서 보낼 수 없어요', ok ? 'ok' : 'error');
  });
  const exportIcs = () => {
    const mine = app.upcoming.filter((s) => s.memberIds.includes(me.id) && shiftEnd(s) > Date.now()).sort(byStart);
    if (!mine.length) return app.toast('앞으로 예정된 내 순찰이 없어요', 'error');
    download('내_순찰일정.ics', buildIcs(mine, prefs), 'text/calendar');
    app.toast(`내 순찰 ${mine.length}개를 캘린더 파일로 만들었어요`);
  };

  return html`<div class="page">
    <div class="profile card">
      <${Avatar} member=${me} size=${56} />
      <div class="person-info"><b class="big">${me.name} ${me.isAdmin && html`<span class="chip sm">관리자</span>`}</b>
        <span>${me.grade}학년 · ${me.role || '부원'}</span><span>${me.phone || '전화번호 없음'} · ${me.email || ''}</span></div>
      <button class="btn soft sm" onClick=${() => app.open(ProfileSheet, {})}>수정</button>
    </div>

    <h4 class="sub-title">알림</h4>
    <div class="card list">
      <div class="menu-row static">
        <${Icon} name="bell" />
        <span><b>휴대폰 알림</b><small>${st === 'granted' ? (store.mode === 'firebase' ? '켜짐 · 앱을 닫아도 알림이 와요' : '켜짐 (데모 모드: 앱이 열려 있을 때만)')
          : st === 'denied' ? '차단됨 · 휴대폰 설정에서 허용해 주세요'
          : st === 'unsupported' ? (isIOS() && !isStandalone() ? '홈 화면에 앱을 설치하면 켤 수 있어요' : '이 브라우저는 지원하지 않아요')
          : '꺼짐'}</small></span>
        ${st === 'granted' ? html`<button class="btn ghost sm" onClick=${testPush} disabled=${busy}>테스트</button>`
          : st === 'default' ? html`<button class="btn primary sm" onClick=${turnOnPush} disabled=${busy}>켜기</button>` : null}
      </div>
      <${Toggle} label="전날 알림" desc=${`순찰 전날 ${app.config.dayBeforeHour ?? 20}시에 '내일 순찰' 알림`} checked=${prefs.dayBefore} onChange=${(v) => setPref('dayBefore', v)} />
      <${Toggle} label=${`순찰 시각 알림 (${PATROL_START})`} desc=${`순찰 날 아침 ${PATROL_START} 정각에 알림`} checked=${prefs.atStart !== false} onChange=${(v) => setPref('atStart', v)} />
      <${MenuRow} icon="calendar" title="내 순찰을 휴대폰 캘린더에 추가" desc=${`캘린더 앱이 ${PATROL_START} 정각에 한 번 더 알려줘요 (.ics)`} onClick=${exportIcs} />
    </div>

    <h4 class="sub-title">앱</h4>
    <div class="card list">
      <${MenuRow} icon="qr" title="부원 초대하기" desc=${me.isAdmin ? 'QR코드 · 링크 + 가입 코드 공유' : 'QR코드 · 앱 링크 공유'} onClick=${() => app.open(InviteSheet, {})} />
      <${MenuRow} icon="phoneapp" title="휴대폰에 앱 설치하기" desc=${isStandalone() ? '이미 앱으로 실행 중이에요' : '홈 화면에 아이콘 추가'} onClick=${() => app.open(InstallSheet, {})} />
      <${MenuRow} icon="history" title="일정 변경 기록" desc="누가 언제 순찰표를 바꿨는지" onClick=${() => app.open(HistorySheet, {})} />
      <${MenuRow} icon="cloud" title="데이터 저장 상태" desc=${store.mode === 'firebase' ? 'Firebase 클라우드에 실시간 저장 중' : '데모 모드 · 이 기기에만 저장 중'} onClick=${() => app.open(BackupSheet, {})} />
    </div>

    ${me.isAdmin && html`<h4 class="sub-title">관리자</h4>
    <div class="card list">
      <${MenuRow} icon="wand" title="순번 자동 생성" desc="기간·요일을 정하면 순찰표를 자동으로 만들어요" onClick=${() => app.open(Generator, {})} />
      <${MenuRow} icon="sliders" title="순찰 기본 설정" desc="학교 이름 · 장소 · 하루 인원" onClick=${() => app.open(SlotsEditor, {})} />
      <${MenuRow} icon="users" title="부원 관리" desc="관리자 지정, 비활성화" onClick=${() => app.open(MembersAdmin, {})} />
      <${MenuRow} icon="key" title="가입 코드" desc="임원만 가입할 수 있게 하는 코드" onClick=${() => app.open(JoinCodeSheet, {})} />
      <${MenuRow} icon="download" title="데이터 백업" desc="순찰표 엑셀(CSV) / 전체 백업" onClick=${() => app.open(BackupSheet, {})} />
    </div>`}

    ${store.mode === 'demo' && html`<h4 class="sub-title">데모 모드</h4>
    <div class="card list">
      <${MenuRow} icon="users" title="다른 부원으로 전환" desc="대타 수락 등을 직접 시험해 보세요" onClick=${() => store.signOut()} />
      <${MenuRow} icon="history" title="데모 데이터 초기화" desc="처음 상태로 되돌려요" onClick=${() => confirm('데모 데이터를 처음 상태로 되돌릴까요?') && store.resetDemo()} />
    </div>`}

    <button class="btn ghost block logout" onClick=${() => confirm('로그아웃할까요?') && store.signOut()}><${Icon} name="logout" size=${18} />로그아웃</button>
    <p class="muted center small pad">${app.config.schoolName} · 학생부 순찰 앱 v1.0</p>
  </div>`;
}

export function ProfileSheet({ onClose }) {
  const app = useApp();
  const { me } = app;
  const [f, setF] = useState({ name: me.name, phone: me.phone || '', role: me.role || '', grade: me.grade || 1 });
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(async () => {
    if (!f.name.trim()) throw new Error('이름을 입력해 주세요.');
    await app.store.updateMember(me.id, { name: f.name.trim(), phone: f.phone.trim(), role: f.role.trim(), grade: Number(f.grade) });
    app.toast('내 정보를 저장했어요');
    onClose();
  });
  return html`<${Sheet} title="내 정보 수정" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>취소</button><button class="btn primary grow" onClick=${save} disabled=${busy}>저장</button>`}>
    <div class="form">
      <${Field} label="이름"><input value=${f.name} onInput=${set('name')} /></${Field}>
      <${Field} label="휴대폰 번호" hint="대타 요청 문자·전화에 쓰여요"><input type="tel" value=${f.phone} onInput=${set('phone')} placeholder="010-1234-5678" /></${Field}>
      <div class="row2">
        <${Field} label="학년"><select value=${f.grade} onChange=${set('grade')}>${[1, 2, 3].map((g) => html`<option value=${g}>${g}학년</option>`)}</select></${Field}>
        <${Field} label="직책"><input value=${f.role} onInput=${set('role')} placeholder="부원" /></${Field}>
      </div>
    </div>
  </${Sheet}>`;
}

export function InstallSheet({ onClose }) {
  const app = useApp();
  const ios = isIOS();
  return html`<${Sheet} title="휴대폰에 앱 설치하기" onClose=${onClose}>
    <${InstallCard} />
    <div class="install-steps">
      <div class=${`install-card ${ios ? 'focus' : ''}`}>
        <h4>아이폰 (Safari)</h4>
        <ol><li>Safari로 이 앱 주소를 열어요</li><li>아래쪽 <b>공유 버튼(□↑)</b>을 눌러요</li><li><b>홈 화면에 추가</b>를 눌러요</li><li>홈 화면의 <b>학생부 순찰</b> 아이콘으로 실행한 뒤 <b>알림 켜기</b></li></ol>
        <p class="hint">iOS 16.4 이상에서 알림을 받을 수 있어요.</p>
      </div>
      <div class=${`install-card ${!ios ? 'focus' : ''}`}>
        <h4>안드로이드 (Chrome / 삼성 인터넷)</h4>
        <ol><li>Chrome으로 이 앱 주소를 열어요</li><li>오른쪽 위 <b>⋮ 메뉴</b> → <b>앱 설치</b> (또는 홈 화면에 추가)</li><li>설치된 <b>학생부 순찰</b> 앱을 열고 <b>알림 켜기</b></li></ol>
      </div>
    </div>
  </${Sheet}>`;
}
