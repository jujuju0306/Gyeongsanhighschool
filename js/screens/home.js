// 홈: 나의 다음 순찰, 오늘·내일 순찰자, 도착한 대타 요청
import { html, useApp, Icon, Empty, useNow, useBusy } from '../ui.js';
import {
  fmtDate, fmtShort, relDay, shiftStart, shiftEnd, untilText, todayStr, ymd, addDays, byStart, isIOS, isStandalone, coverColor,
} from '../utils.js';
import { ShiftDetail, SwapRequestSheet } from '../components.js';
import { pushState, enablePush } from '../push.js';

export function PushBanner() {
  const app = useApp();
  const [busy, run] = useBusy();
  const st = pushState();
  if (st === 'granted' || localStorage.getItem('patrol-hide-push') === '1') return null;
  const iosNeedsInstall = isIOS() && !isStandalone();
  return html`<div class="banner">
    <span class="banner-ic"><${Icon} name="bell" /></span>
    <div class="banner-text">
      <b>순찰 알림 받기</b>
      <span>${iosNeedsInstall ? '아이폰은 [공유] → [홈 화면에 추가]로 설치한 뒤 켤 수 있어요.'
        : st === 'denied' ? '알림이 차단되어 있어요. 휴대폰 설정에서 허용해 주세요.'
        : '순찰 시작 전과 대타 요청이 오면 알려드려요.'}</span>
    </div>
    ${!iosNeedsInstall && st !== 'denied'
      ? html`<button class="btn soft sm" disabled=${busy} onClick=${() => run(async () => { await enablePush(app); app.toast('알림이 켜졌어요'); app.refresh(); })}>켜기</button>`
      : html`<button class="icon-btn sm" aria-label="닫기" onClick=${() => { localStorage.setItem('patrol-hide-push', '1'); app.refresh(); }}><${Icon} name="x" size=${18} /></button>`}
  </div>`;
}

// 2열 타일 (Spotify 홈의 바로가기 타일 형태)
function Tile({ shift }) {
  const app = useApp();
  const mine = shift.memberIds.includes(app.me.id);
  const past = shiftEnd(shift) <= Date.now();
  const names = shift.memberIds.map((id) => app.memberById(id)?.name || '?').join(', ');
  return html`<button class="tile ${mine ? 'mine' : ''} ${past ? 'past' : ''}" onClick=${() => app.open(ShiftDetail, { shiftId: shift.id, initial: shift })}>
    <span class="tile-art" style=${`background:${coverColor(shift)}`}>${shift.start}</span>
    <span class="tile-text"><b>${shift.name}</b><span>${names || '담당자 없음'}</span></span>
  </button>`;
}

function DayTiles({ list, emptyText }) {
  return list.length
    ? html`<div class="tile-grid">${list.map((s) => html`<${Tile} key=${s.id} shift=${s} />`)}</div>`
    : html`<${Empty} text=${emptyText} />`;
}

export function Home() {
  const app = useApp();
  const { me, upcoming, requests } = app;
  const now = useNow(30000);
  const today = todayStr();
  const tomorrow = ymd(addDays(new Date(), 1));
  const sorted = [...upcoming].sort(byStart);
  const mine = sorted.filter((s) => s.memberIds.includes(me.id) && shiftEnd(s) > now);
  const next = mine[0];
  const todays = sorted.filter((s) => s.date === today);
  const tomorrows = sorted.filter((s) => s.date === tomorrow);
  const incoming = requests.filter((r) => r.status === 'pending' && r.fromUid !== me.id && (r.toUid === me.id || r.toUid === 'ALL') && r.shiftDate >= today);
  const live = next && now >= shiftStart(next);
  const hour = new Date(now).getHours();
  const hello = hour < 11 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';

  return html`<div class="page">
    <div class="greet">
      <h2>${hello}, ${me.name}님</h2>
      <p>${fmtDate(today)}</p>
    </div>

    ${next
      ? html`<button class="feature" onClick=${() => app.open(ShiftDetail, { shiftId: next.id, initial: next })}>
          <span class="feature-art" style=${`background:${coverColor(next)}`}>
            <span class="when">${relDay(next.date)}</span>
            <strong>${next.start}</strong>
          </span>
          <span class="feature-info">
            <span class="eyebrow">${live ? '지금 순찰 중' : '나의 다음 순찰'}</span>
            <h2>${next.name}</h2>
            <p>${next.start}~${next.end} · ${next.location || '장소 미정'}</p>
            <span class="until">${untilText(shiftStart(next), now)}</span>
          </span>
        </button>`
      : html`<div class="feature empty-feature">앞으로 예정된 내 순찰이 없어요</div>`}

    ${incoming.length > 0 && html`<button class="alert-card" onClick=${() => app.setTab('swap')}>
      <span class="alert-ic"><${Icon} name="swap" /></span>
      <span><b>대타 요청 ${incoming.length}건</b><small>${incoming[0].fromName} · ${fmtShort(incoming[0].shiftDate)} ${incoming[0].shiftName}</small></span>
      <${Icon} name="right" size=${18} />
    </button>`}

    <${PushBanner} />

    <section class="section">
      <div class="section-head"><h3>오늘의 순찰</h3><span class="muted">${fmtShort(today)}</span></div>
      <${DayTiles} list=${todays} emptyText="오늘은 순찰 일정이 없어요" />
    </section>

    <section class="section">
      <div class="section-head"><h3>내일의 순찰</h3><span class="muted">${fmtShort(tomorrow)}</span></div>
      <${DayTiles} list=${tomorrows} emptyText="내일은 순찰 일정이 없어요" />
    </section>

    <section class="section">
      <div class="section-head"><h3>내 순찰 일정</h3><button class="link" onClick=${() => app.setTab('schedule')}>모두 표시</button></div>
      ${mine.length ? html`<div class="stack">${mine.slice(0, 6).map((s) => html`<div key=${s.id} class="my-row">
          <button class="my-row-main" onClick=${() => app.open(ShiftDetail, { shiftId: s.id, initial: s })}>
            <span class="my-date"><b>${relDay(s.date)}</b><small>${s.start}</small></span>
            <span class="my-info"><b>${s.name}</b><small>${s.location}</small></span>
          </button>
          <button class="btn ghost sm" onClick=${() => app.open(SwapRequestSheet, { shift: s })}>대타 요청</button>
        </div>`)}</div>`
        : html`<${Empty} text="예정된 내 순찰이 없어요" icon="check" />`}
    </section>
  </div>`;
}
