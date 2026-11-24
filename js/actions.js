// 일정 변경·대타·채팅 같은 "행동"을 처리하고, 관련된 사람에게 알림을 보내고, 변경 기록을 남깁니다.
import { fmtShort } from './utils.js';

export const label = (s) => `${fmtShort(s.date)} ${s.start} ${s.name}`;
const reqLabel = (r) => `${fmtShort(r.shiftDate)} ${r.shiftStart || ''} ${r.shiftName}`.replace(/\s+/g, ' ');

export async function saveShift(app, before, after) {
  const { store, me } = app;
  const n = (id) => app.memberById(id)?.name || '?';
  const others = (ids) => ids.filter((x) => x !== me.id);
  const data = { ...after, updatedBy: me.id };
  const timeChanged = before && ['date', 'start', 'end', 'location', 'name'].some((k) => before[k] !== after[k]);
  if (timeChanged) data.reminded = {};
  const id = await store.saveShift(data);

  if (!before) {
    const t = others(after.memberIds);
    if (t.length) await store.notify(t, {
      title: '순찰 배정 알림', body: `${label(after)} (${after.location}) 순찰에 배정되었어요.`,
      url: '#schedule', fromUid: me.id, group: `assign_${id}`,
    });
    await store.log({ by: me.id, byName: me.name, action: 'create', summary: `${label(after)} 일정 추가 · ${after.memberIds.map(n).join(', ') || '담당자 없음'}` });
    return id;
  }

  const added = after.memberIds.filter((x) => !before.memberIds.includes(x));
  const removed = before.memberIds.filter((x) => !after.memberIds.includes(x));
  const stayed = after.memberIds.filter((x) => before.memberIds.includes(x));
  const jobs = [];
  if (others(added).length) jobs.push(store.notify(others(added), {
    title: '순찰 배정 알림', body: `${label(after)} (${after.location}) 순찰에 배정되었어요.`, url: '#schedule', fromUid: me.id, group: `assign_${id}`,
  }));
  if (others(removed).length) jobs.push(store.notify(others(removed), {
    title: '순찰 변경 알림', body: `${label(before)} 순찰 담당에서 제외되었어요.`, url: '#schedule', fromUid: me.id, group: `assign_${id}`,
  }));
  if (timeChanged && others(stayed).length) jobs.push(store.notify(others(stayed), {
    title: '순찰 일정 변경', body: `${label(before)} → ${label(after)} · ${after.location}`, url: '#schedule', fromUid: me.id, group: `assign_${id}`,
  }));
  await Promise.all(jobs);

  const parts = [];
  if (timeChanged) parts.push(`${label(before)} → ${label(after)}`);
  if (added.length) parts.push(`+${added.map(n).join(', ')}`);
  if (removed.length) parts.push(`-${removed.map(n).join(', ')}`);
  if (!parts.length && before.note !== after.note) parts.push('메모 수정');
  if (parts.length) await store.log({ by: me.id, byName: me.name, action: 'update', summary: `${label(after)} 수정 · ${parts.join(' / ')}` });
  return id;
}

export async function deleteShift(app, shift) {
  const { store, me } = app;
  await store.deleteShift(shift.id);
  const t = shift.memberIds.filter((x) => x !== me.id);
  if (t.length) await store.notify(t, { title: '순찰 취소 알림', body: `${label(shift)} 순찰이 취소되었어요.`, url: '#schedule', fromUid: me.id });
  await store.log({ by: me.id, byName: me.name, action: 'delete', summary: `${label(shift)} 일정 삭제` });
}

export async function requestSwap(app, shift, toUid, message) {
  const { store, me } = app;
  const target = toUid === 'ALL' ? null : app.memberById(toUid);
  const id = await store.createRequest({
    shiftId: shift.id, shiftDate: shift.date, shiftName: shift.name, shiftStart: shift.start,
    fromUid: me.id, fromName: me.name, toUid, toName: target?.name || '전체', message,
  });
  await store.notify([toUid], {
    title: `${me.name}님의 대타 요청`, body: `${label(shift)} · ${message}`, url: '#swap', fromUid: me.id, group: `req_${id}`,
  });
  await store.log({ by: me.id, byName: me.name, action: 'request', summary: `${me.name} → ${target ? target.name : '전체'} : ${label(shift)} 대타 요청` });
}

export async function acceptRequest(app, req) {
  const { store, me } = app;
  await store.acceptRequest(req.id, me);
  await store.notify([req.fromUid], {
    title: '대타 요청이 수락되었어요', body: `${me.name}님이 ${reqLabel(req)} 순찰을 대신 맡아요.`, url: '#swap', fromUid: me.id,
  });
  await store.log({ by: me.id, byName: me.name, action: 'swap', summary: `${reqLabel(req)} 담당 변경 : ${req.fromName} → ${me.name} (대타 수락)` });
}

export async function declineRequest(app, req) {
  const { store, me } = app;
  await store.updateRequest(req.id, { status: 'declined', resolvedBy: me.id, resolvedByName: me.name });
  await store.notify([req.fromUid], {
    title: '대타 요청이 거절되었어요', body: `${me.name}님이 ${reqLabel(req)} 대타가 어렵다고 했어요.`, url: '#swap', fromUid: me.id,
  });
}

export async function cancelRequest(app, req) {
  const { store, me } = app;
  await store.updateRequest(req.id, { status: 'cancelled', resolvedBy: me.id, resolvedByName: me.name });
  if (req.toUid !== 'ALL') await store.notify([req.toUid], {
    title: '대타 요청 취소', body: `${req.fromName}님이 ${reqLabel(req)} 대타 요청을 취소했어요.`, url: '#swap', fromUid: me.id,
  });
}

export async function sendChat(app, room, text) {
  const { store, me } = app;
  await store.sendMessage(room.id, room.members || null, { uid: me.id, name: me.name, text });
  const to = room.id === 'all' ? ['ALL'] : room.members.filter((x) => x !== me.id);
  await store.notify(to, {
    title: room.id === 'all' ? `단체방 · ${me.name}` : `${me.name}님의 메시지`, body: text,
    url: '#contact', fromUid: me.id, group: `chat_${room.id}`, kind: 'chat',
  });
}

export const dmRoom = (a, b) => ({ id: `dm_${[a, b].sort().join('_')}`, members: [a, b].sort() });
