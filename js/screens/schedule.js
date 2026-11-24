// 일정표: 월간 달력 / 목록 보기, 날짜별 순찰자, 관리자 일정 추가·수정·자동 생성
import { html, useApp, useState, useEffect, Icon, Empty } from '../ui.js';
import { ymd, addDays, todayStr, fmtDate, byStart, DOW } from '../utils.js';
import { ShiftCard, ShiftEditor } from '../components.js';
import { Generator } from './admin.js';

export function Schedule() {
  const app = useApp();
  const { me } = app;
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(todayStr());
  const [view, setView] = useState(() => localStorage.getItem('patrol-view') || 'calendar');
  const [onlyMine, setOnlyMine] = useState(false);
  const [shifts, setShifts] = useState([]);

  const first = month;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const gridStart = addDays(first, -first.getDay());
  const rows = Math.ceil((first.getDay() + days) / 7);
  const from = ymd(gridStart);
  const to = ymd(addDays(gridStart, rows * 7 - 1));

  useEffect(() => app.store.watchShifts(from, to, setShifts), [from, to]);
  useEffect(() => { try { localStorage.setItem('patrol-view', view); } catch {} }, [view]);

  const visible = (onlyMine ? shifts.filter((s) => s.memberIds.includes(me.id)) : shifts).sort(byStart);
  const byDate = {};
  for (const s of visible) (byDate[s.date] ||= []).push(s);
  const move = (n) => {
    const m = new Date(first.getFullYear(), first.getMonth() + n, 1);
    setMonth(m);
    const t = new Date();
    setSelected(m.getFullYear() === t.getFullYear() && m.getMonth() === t.getMonth() ? todayStr() : ymd(m));
  };
  const goToday = () => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayStr()); };
  const today = todayStr();
  const monthKey = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
  const dayList = Object.keys(byDate).filter((d) => d.startsWith(monthKey)).sort();
  const selShifts = byDate[selected] || [];

  return html`<div class="page">
    <div class="month-bar">
      <button class="icon-btn" onClick=${() => move(-1)} aria-label="이전 달"><${Icon} name="left" /></button>
      <h2>${first.getFullYear()}년 ${first.getMonth() + 1}월</h2>
      <button class="icon-btn" onClick=${() => move(1)} aria-label="다음 달"><${Icon} name="right" /></button>
      <button class="btn soft sm" onClick=${goToday}>오늘</button>
    </div>

    <div class="toolbar">
      <div class="segment">
        <button class=${view === 'calendar' ? 'on' : ''} onClick=${() => setView('calendar')}><${Icon} name="calendar" size=${16} />달력</button>
        <button class=${view === 'list' ? 'on' : ''} onClick=${() => setView('list')}><${Icon} name="list" size=${16} />목록</button>
      </div>
      <label class="mini-toggle"><input type="checkbox" checked=${onlyMine} onChange=${(e) => setOnlyMine(e.target.checked)} />내 순찰만</label>
    </div>

    ${me.isAdmin && html`<div class="admin-bar">
      <button class="btn ghost sm" onClick=${() => app.open(Generator, { defaultFrom: ymd(first) })}><${Icon} name="wand" size=${16} />순번 자동 생성</button>
      <button class="btn primary sm" onClick=${() => app.open(ShiftEditor, { date: selected })}><${Icon} name="plus" size=${16} />일정 추가</button>
    </div>`}

    ${view === 'calendar' ? html`
      <div class="calendar card">
        <div class="cal-head">${DOW.map((d, i) => html`<span class=${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>${d}</span>`)}</div>
        <div class="cal-grid">${Array.from({ length: rows * 7 }, (_, i) => {
          const d = addDays(gridStart, i);
          const ds = ymd(d);
          const list = byDate[ds] || [];
          const mineHere = list.some((s) => s.memberIds.includes(me.id));
          const cls = [
            'cal-cell', d.getMonth() !== first.getMonth() && 'out', ds === today && 'today', ds === selected && 'sel',
            mineHere && 'has-mine', d.getDay() === 0 && 'sun', d.getDay() === 6 && 'sat',
          ].filter(Boolean).join(' ');
          return html`<button key=${ds} class=${cls} onClick=${() => setSelected(ds)} aria-label=${`${fmtDate(ds)} 순찰 ${list.length}개`}>
            <span class="num">${d.getDate()}</span>
            <span class="dots">${list.slice(0, 3).map((s) => html`<i class=${s.memberIds.includes(me.id) ? 'mine' : ''}></i>`)}</span>
          </button>`;
        })}</div>
        <div class="cal-legend"><span><i></i>순찰 있음</span><span><i class="mine"></i>내 순찰</span></div>
      </div>
      <section class="section">
        <div class="section-head"><h3>${fmtDate(selected)}</h3><span class="muted">${selShifts.length}개</span></div>
        ${selShifts.length ? html`<div class="stack">${selShifts.map((s) => html`<${ShiftCard} key=${s.id} shift=${s} />`)}</div>`
          : html`<${Empty} text=${onlyMine ? '이 날은 내 순찰이 없어요' : '이 날은 순찰 일정이 없어요'} />`}
      </section>`
    : html`<section class="section">
        ${dayList.length ? dayList.map((d) => html`<div key=${d} class="day-group ${d === today ? 'is-today' : ''}">
            <div class="day-label">${fmtDate(d)}${d === today ? html` <span class="badge">오늘</span>` : ''}</div>
            <div class="stack">${byDate[d].map((s) => html`<${ShiftCard} key=${s.id} shift=${s} />`)}</div>
          </div>`)
        : html`<${Empty} text="이 달에는 순찰 일정이 없어요" />`}
      </section>`}
  </div>`;
}
