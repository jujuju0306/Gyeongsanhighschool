// 홈: 오늘·내일 순찰자, 나의 다음 순찰, 도착한 대타 요청
import { html, useApp, Icon, Avatar, Empty, useNow, useBusy } from '../ui.js';
import { fmtDate, fmtShort, relDay, shiftStart, shiftEnd, untilText, todayStr, ymd, addDays, byStart, isIOS, isStandalone } from '../utils.js';
import { ShiftCard, ShiftDetail, SwapRequestSheet } from '../components.js';
import { pushState, enablePush } from '../push.js';

export function PushBanner() {
  const app = useApp();
  const [busy, run] = useBusy();
  const st = pushState();
  if (st === 'granted' || localStorage.getItem('patrol-hide-push') === '1') return null;
  const iosNeedsInstall = isIOS() && !isStandalone();
  return html`<div class="banner">
    <div class="banner-ic"><${Icon} name="bell" /></div>
    <div class="banner-text">
      <b>순찰 알림 받기</b>
      <span>${iosNeedsInstall ? '아이폰은 먼저 [공유] → [홈 화면에 추가]로 앱을 설치해야 알림을 받을 수 있어요.'
        : st === 'denied' ? '알림이 차단되어 있어요. 휴대폰 설정에서 알림을 허용해 주세요.'
        : '순찰 시작 전과 대타 요청이 오면 휴대폰으로 알려드려요.'}</span>
    </div>
    ${!iosNeedsInstall && st !== 'denied'
      ? html`<button class="btn primary sm" disabled=${busy} onClick=${() => run(async () => { await enablePush(app); app.toast('알림이 켜졌어요'); app.refresh(); })}>켜기</button>`
      : html`<button class="icon-btn" aria-label="닫기" onClick=${() => { localStorage.setItem('patrol-hide-push', '1'); app.refresh(); }}><${Icon} name="x" size=${18} /></button>`}
  </div>`;
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

  return html`<div class="page">
    <section class="hero">
      <div class="hero-top">
        <div><div class="hero-date">${fmtDate(today)}</div><h2>${me.name}님, 안녕하세요</h2></div>
        <${Avatar} member=${me} size=${44} />
      </div>
      ${next
        ? html`<button class="hero-next" onClick=${() => app.open(ShiftDetail, { shiftId: next.id, initial: next })}>
            <div class="label">${live ? '지금 순찰 중' : '나의 다음 순찰'}</div>
            <div class="big">${relDay(next.date)} ${next.start}</div>
            <div class="sub">${next.name} · ${next.location}</div>
            <div class="countdown"><${Icon} name="clock" size=${15} />${untilText(shiftStart(next), now)}</div>
          </button>`
        : html`<div class="hero-next empty">앞으로 예정된 내 순찰이 없어요</div>`}
    </section>

    <${PushBanner} />

    ${incoming.length > 0 && html`<button class="alert-card" onClick=${() => app.setTab('swap')}>
      <span class="alert-ic"><${Icon} name="swap" /></span>
      <span><b>대타 요청 ${incoming.length}건이 도착했어요</b><small>${incoming[0].fromName}님 · ${fmtShort(incoming[0].shiftDate)} ${incoming[0].shiftName}</small></span>
      <${Icon} name="right" size=${18} />
    </button>`}

    <section class="section">
      <div class="section-head"><h3>오늘의 순찰</h3><span class="muted">${fmtShort(today)}</span></div>
      ${todays.length ? html`<div class="stack">${todays.map((s) => html`<${ShiftCard} key=${s.id} shift=${s} />`)}</div>`
        : html`<${Empty} text="오늘은 순찰 일정이 없어요" />`}
    </section>

    <section class="section">
      <div class="section-head"><h3>내일의 순찰</h3><span class="muted">${fmtShort(tomorrow)}</span></div>
      ${tomorrows.length ? html`<div class="stack">${tomorrows.map((s) => html`<${ShiftCard} key=${s.id} shift=${s} />`)}</div>`
        : html`<${Empty} text="내일은 순찰 일정이 없어요" />`}
    </section>

    <section class="section">
      <div class="section-head"><h3>내 순찰 일정</h3><button class="link" onClick=${() => app.setTab('schedule')}>전체 일정표</button></div>
      ${mine.length ? html`<div class="card list">${mine.slice(0, 6).map((s) => html`<div key=${s.id} class="my-row">
          <button class="my-row-main" onClick=${() => app.open(ShiftDetail, { shiftId: s.id, initial: s })}>
            <span class="my-date"><b>${relDay(s.date)}</b><small>${s.start}</small></span>
            <span class="my-info"><b>${s.name}</b><small>${s.location}</small></span>
          </button>
          <button class="btn soft sm" onClick=${() => app.open(SwapRequestSheet, { shift: s })}>대타 요청</button>
        </div>`)}</div>`
        : html`<${Empty} text="예정된 내 순찰이 없어요" icon="check" />`}
    </section>
  </div>`;
}
