// 날짜·문자·파일 등 공용 도우미 함수 모음

export const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export const DEFAULT_CONFIG = {
  schoolName: '우리 학교 학생부',
  dayBeforeHour: 20, // 전날 알림 시각 (0~23시)
  slots: [
    { id: 'morning', name: '등교 순찰', start: '07:50', end: '08:20', location: '정문', size: 2 },
    { id: 'lunch', name: '점심 순찰', start: '12:40', end: '13:10', location: '본관 복도', size: 2 },
    { id: 'after', name: '하교 순찰', start: '16:30', end: '16:50', location: '후문', size: 2 },
  ],
};

export const DEFAULT_PREFS = { dayBefore: true, leadMin: 10 };

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const todayStr = () => ymd(new Date());

export function fmtDate(s) {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}
export function fmtShort(s) {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
}
export function relDay(s) {
  const t = todayStr();
  if (s === t) return '오늘';
  if (s === ymd(addDays(new Date(), 1))) return '내일';
  if (s === ymd(addDays(new Date(), -1))) return '어제';
  return fmtShort(s);
}

function atTime(dateStr, hm) {
  const d = parseYmd(dateStr);
  const [h, m] = String(hm || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
export const shiftStart = (s) => atTime(s.date, s.start);
export const shiftEnd = (s) => atTime(s.date, s.end || s.start);
export const byStart = (a, b) => (a.date + a.start).localeCompare(b.date + b.start);

export function untilText(target, now = Date.now()) {
  const diff = Math.round((target - now) / 60000);
  if (diff <= 0) return '진행 중';
  if (diff < 60) return `${diff}분 후`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}시간 ${diff % 60}분 후`;
  return `${Math.floor(h / 24)}일 후`;
}

export function timeAgo(ms) {
  if (!ms) return '';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function clock(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`;
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---- 문자 / 전화 ----
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export const cleanPhone = (p) => String(p || '').replace(/[^0-9+]/g, '');
export const telLink = (p) => `tel:${cleanPhone(p)}`;
export function smsLink(phones, body = '') {
  const nums = (Array.isArray(phones) ? phones : [phones]).map(cleanPhone).filter(Boolean);
  const b = encodeURIComponent(body);
  if (isIOS()) {
    return nums.length > 1 ? `sms:/open?addresses=${nums.join(',')}&body=${b}` : `sms:${nums[0] || ''}&body=${b}`;
  }
  return `sms:${nums.join(',')}?body=${b}`;
}
export const appUrl = (hash = '') => location.origin + location.pathname + hash;

// ---- 대타 수락 시 일정 교체 규칙 (데모/클라우드 공용) ----
export function applySwap(shift, req, meId) {
  const ids = shift.memberIds || [];
  if (req.status !== 'pending') throw new Error('이미 처리된 요청이에요.');
  if (req.fromUid === meId) throw new Error('본인이 보낸 요청은 수락할 수 없어요.');
  if (req.toUid !== 'ALL' && req.toUid !== meId) throw new Error('나에게 온 요청이 아니에요.');
  if (ids.includes(meId)) throw new Error('이미 이 순찰에 배정되어 있어요.');
  const i = ids.indexOf(req.fromUid);
  if (i < 0) throw new Error('요청한 사람이 더 이상 이 순찰 담당이 아니에요.');
  const next = [...ids];
  next[i] = meId;
  return next;
}

// ---- 순번(로테이션) 자동 생성 ----
export function generateRotation({ from, to, weekdays, skip = [], slots, memberIds }) {
  const out = [];
  if (!memberIds.length || !slots.length || from > to) return out;
  const skipSet = new Set(skip);
  const queue = [...memberIds];
  for (let d = parseYmd(from); ymd(d) <= to; d = addDays(d, 1)) {
    const ds = ymd(d);
    if (!weekdays.includes(d.getDay()) || skipSet.has(ds)) continue;
    const usedToday = new Set();
    for (const slot of slots) {
      const size = Math.min(Number(slot.size) || 1, queue.length);
      const picked = [];
      for (let k = 0; k < size; k++) {
        let idx = queue.findIndex((id) => !picked.includes(id) && !usedToday.has(id));
        if (idx < 0) idx = queue.findIndex((id) => !picked.includes(id));
        if (idx < 0) break;
        const [id] = queue.splice(idx, 1);
        queue.push(id);
        picked.push(id);
        usedToday.add(id);
      }
      out.push({
        date: ds, slotId: slot.id, name: slot.name, start: slot.start, end: slot.end,
        location: slot.location || '', memberIds: picked, note: '',
      });
    }
  }
  return out;
}

export function parseDateList(text) {
  return String(text || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
}

// ---- 파일 내보내기 ----
export function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

// 휴대폰 기본 캘린더에 넣을 수 있는 .ics (캘린더 자체 알람 포함)
export function buildIcs(shifts, { leadMin = 10, dayBefore = true } = {}) {
  const t = (dateStr, hm) => dateStr.replace(/-/g, '') + 'T' + String(hm || '00:00').replace(':', '') + '00';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = (s) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//patrol-app//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:학생부 순찰'];
  for (const s of shifts) {
    lines.push(
      'BEGIN:VEVENT', `UID:${s.id}@patrol-app`, `DTSTAMP:${stamp}`,
      `DTSTART:${t(s.date, s.start)}`, `DTEND:${t(s.date, s.end || s.start)}`,
      `SUMMARY:${esc('[순찰] ' + s.name)}`, `LOCATION:${esc(s.location)}`,
    );
    if (leadMin >= 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(s.name + ' 순찰 시간')}`, `TRIGGER:-PT${leadMin}M`, 'END:VALARM');
    if (dayBefore) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('내일 ' + s.name)}`, 'TRIGGER:-PT12H', 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
