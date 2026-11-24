// 대타: 받은 요청 수락/거절, 보낸 요청 관리, 새 요청
import { html, useApp, useState, Icon, Empty } from '../ui.js';
import { todayStr } from '../utils.js';
import { RequestCard, PickShiftSheet } from '../components.js';

export function Swap() {
  const app = useApp();
  const { me, requests } = app;
  const [showDone, setShowDone] = useState(false);
  const today = todayStr();
  const newest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const isPending = (r) => r.status === 'pending' && r.shiftDate >= today;

  const incoming = requests.filter((r) => isPending(r) && r.fromUid !== me.id && (r.toUid === me.id || r.toUid === 'ALL')).sort(newest);
  const sent = requests.filter((r) => isPending(r) && r.fromUid === me.id).sort(newest);
  const done = requests.filter((r) => !isPending(r) && (r.fromUid === me.id || r.toUid === me.id || r.resolvedBy === me.id)).sort(newest);
  const others = requests.filter((r) => isPending(r) && r.fromUid !== me.id && r.toUid !== me.id && r.toUid !== 'ALL').sort(newest);

  return html`<div class="page">
    <div class="page-title">
      <div><h2>대타 요청</h2><p class="muted">순찰을 바꿔야 할 때 부원에게 부탁하세요</p></div>
      <button class="btn primary sm" onClick=${() => app.open(PickShiftSheet, {})}><${Icon} name="plus" size=${16} />새 요청</button>
    </div>

    <section class="section">
      <div class="section-head"><h3>받은 요청 ${incoming.length ? html`<span class="count">${incoming.length}</span>` : ''}</h3></div>
      ${incoming.length ? html`<div class="stack">${incoming.map((r) => html`<${RequestCard} key=${r.id} req=${r} />`)}</div>`
        : html`<${Empty} text="받은 대타 요청이 없어요" icon="swap" />`}
    </section>

    <section class="section">
      <div class="section-head"><h3>내가 보낸 요청</h3></div>
      ${sent.length ? html`<div class="stack">${sent.map((r) => html`<${RequestCard} key=${r.id} req=${r} />`)}</div>`
        : html`<${Empty} text="진행 중인 요청이 없어요" icon="send" />`}
    </section>

    ${me.isAdmin && others.length > 0 && html`<section class="section">
      <div class="section-head"><h3>다른 부원 간 요청</h3><span class="muted small">관리자에게만 보여요</span></div>
      <div class="stack">${others.map((r) => html`<${RequestCard} key=${r.id} req=${r} />`)}</div>
    </section>`}

    <section class="section">
      <button class="section-head toggle" onClick=${() => setShowDone(!showDone)}>
        <h3>지난 요청 ${done.length}건</h3><${Icon} name=${showDone ? 'x' : 'right'} size=${18} />
      </button>
      ${showDone && (done.length ? html`<div class="stack">${done.map((r) => html`<${RequestCard} key=${r.id} req=${r} />`)}</div>`
        : html`<${Empty} text="지난 요청이 없어요" icon="history" />`)}
    </section>
  </div>`;
}
