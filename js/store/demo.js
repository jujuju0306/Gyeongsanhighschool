// 데모 모드 저장소: Firebase 연결 전, 이 기기(브라우저)에만 저장됩니다.
// Firebase 저장소(firebase.js)와 똑같은 함수 목록을 가지고 있어 화면 코드는 그대로 동작합니다.
import { newId, ymd, addDays, applySwap, generateRotation, DEFAULT_CONFIG, DEFAULT_PREFS, byStart } from '../utils.js';

const KEY = 'patrol-demo-db-v1';
const AUTH_KEY = 'patrol-demo-uid';
export const DEMO_PASSWORD = '123456';
export const DEMO_JOIN_CODE = 'demo';

const SEED_MEMBERS = [
  ['m1', '김민준', '학생부장', 3, true],
  ['m2', '이서연', '학생부 차장', 3, true],
  ['m3', '박지호', '부원', 3, false],
  ['m4', '최유진', '부원', 2, false],
  ['m5', '정하은', '부원', 2, false],
  ['m6', '강도윤', '부원', 2, false],
  ['m7', '조서준', '부원', 2, false],
  ['m8', '윤지우', '부원', 1, false],
  ['m9', '장예린', '부원', 1, false],
  ['m10', '임건우', '부원', 1, false],
];

function seed() {
  const now = Date.now();
  const members = SEED_MEMBERS.map(([id, name, role, grade, isAdmin], i) => ({
    id, name, role, grade, isAdmin, active: true,
    email: `${id}@demo.school`, phone: `010-0000-${String(1001 + i)}`,
    prefs: { ...DEFAULT_PREFS }, tokens: [], createdAt: now,
  }));
  const today = new Date();
  const from = ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const to = ymd(new Date(today.getFullYear(), today.getMonth() + 2, 0));
  const shifts = generateRotation({
    from, to, weekdays: [1, 2, 3, 4, 5], slots: DEFAULT_CONFIG.slots,
    memberIds: ['m3', 'm1', 'm5', 'm7', 'm2', 'm9', 'm4', 'm6', 'm8', 'm10'],
  }).map((s) => ({ ...s, id: newId(), createdAt: now, updatedAt: now }));

  const t = ymd(today);
  const future = shifts.filter((s) => s.date > t).sort(byStart);
  const requests = [];
  const s2 = future.find((s) => s.memberIds.includes('m2') && !s.memberIds.includes('m1'));
  if (s2) requests.push({
    id: newId(), shiftId: s2.id, shiftDate: s2.date, shiftName: s2.name, shiftStart: s2.start,
    fromUid: 'm2', fromName: '이서연', toUid: 'm1', toName: '김민준', status: 'pending',
    message: '민준아, 그날 동아리 발표가 있어서 혹시 순찰 대신 서줄 수 있을까?', createdAt: now - 3600e3,
  });
  const s4 = future.find((s) => s.memberIds.includes('m4') && !s.memberIds.includes('m1') && s !== s2);
  if (s4) requests.push({
    id: newId(), shiftId: s4.id, shiftDate: s4.date, shiftName: s4.name, shiftStart: s4.start,
    fromUid: 'm4', fromName: '최유진', toUid: 'ALL', toName: '전체', status: 'pending',
    message: '병원 진료가 잡혀서 대타 구합니다! 가능하신 분 계신가요?', createdAt: now - 7200e3,
  });

  const chat = [
    ['m1', '이번 주 순찰 일정 앱에 올렸어요. 확인 부탁드려요!', 180],
    ['m3', '넵 확인했습니다 👍', 170],
    ['m5', '목요일 점심 순찰 위치가 본관 복도 맞나요?', 95],
    ['m2', '네 맞아요. 2층까지 돌면 됩니다 :)', 90],
  ].map(([uid, text, minAgo]) => ({
    id: newId(), uid, name: members.find((m) => m.id === uid).name, text, createdAt: now - minAgo * 60e3,
  }));

  return {
    seq: 1,
    config: { ...DEFAULT_CONFIG },
    secret: { joinCode: DEMO_JOIN_CODE },
    auth: members.map((m) => ({ uid: m.id, email: m.email, pw: DEMO_PASSWORD })),
    members, shifts, requests,
    rooms: [{ id: 'all', lastText: chat.at(-1).text, lastName: chat.at(-1).name, lastAt: chat.at(-1).createdAt }],
    messages: { all: chat },
    outbox: [],
    history: [{ id: newId(), at: now - 86400e3, by: 'm1', byName: '김민준', action: 'generate', summary: '순찰 일정 자동 생성 (데모 데이터)' }],
  };
}

export function createDemoStore() {
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  };
  let db = read() || seed();
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  write();

  const subs = new Set();
  const authSubs = new Set();
  let uid = sessionStorage.getItem(AUTH_KEY) || null;
  if (uid && !db.auth.some((a) => a.uid === uid)) uid = null;
  let lastSeq = db.seq;

  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const emit = () => subs.forEach((f) => f());
  const commit = () => { write(); emit(); };
  const watch = (get, cb) => {
    let alive = true;
    const run = () => alive && cb(clone(get()));
    subs.add(run);
    queueMicrotask(run);
    return () => { alive = false; subs.delete(run); };
  };

  // 데모용 "푸시 알림": 이 탭의 사용자에게 온 알림을 화면에 띄움 (다른 탭 포함)
  const deliver = () => {
    const fresh = db.outbox.filter((o) => o.seq > lastSeq);
    lastSeq = db.seq;
    for (const o of fresh) {
      const targets = o.toUids.includes('ALL') ? db.members.map((m) => m.id).filter((id) => id !== o.fromUid) : o.toUids;
      if (uid && targets.includes(uid)) window.dispatchEvent(new CustomEvent('patrol:notify', { detail: o }));
    }
  };
  addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    db = JSON.parse(e.newValue);
    deliver();
    emit();
  });

  const cur = () => (uid ? { uid, email: db.auth.find((a) => a.uid === uid)?.email || '' } : null);
  const setUid = (x) => {
    uid = x;
    x ? sessionStorage.setItem(AUTH_KEY, x) : sessionStorage.removeItem(AUTH_KEY);
    authSubs.forEach((f) => f(cur()));
  };
  const member = (id) => db.members.find((m) => m.id === id);
  const shiftById = (id) => db.shifts.find((s) => s.id === id);

  return {
    mode: 'demo',

    // ---- 로그인 ----
    onAuth(cb) {
      authSubs.add(cb);
      queueMicrotask(() => cb(cur()));
      return () => authSubs.delete(cb);
    },
    async signIn(email, pw) {
      const a = db.auth.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!a || a.pw !== pw) throw new Error('이메일 또는 비밀번호가 올바르지 않아요.');
      setUid(a.uid);
    },
    signInAs(id) { setUid(id); },
    async signUp(email, pw) {
      email = String(email).trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('이메일 형식이 올바르지 않아요.');
      if (String(pw).length < 6) throw new Error('비밀번호는 6자 이상이어야 해요.');
      if (db.auth.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new Error('이미 가입된 이메일이에요.');
      const id = newId();
      db.auth.push({ uid: id, email, pw });
      commit();
      setUid(id);
      return id;
    },
    async resetPassword() {
      throw new Error(`데모 모드에서는 비밀번호 재설정이 없어요. 데모 계정 비밀번호는 ${DEMO_PASSWORD} 입니다.`);
    },
    async signOut() { setUid(null); },
    async resetDemo() { localStorage.removeItem(KEY); sessionStorage.removeItem(AUTH_KEY); location.reload(); },

    // ---- 부원 ----
    async createMember(m) {
      if (String(m.joinCode).trim() !== db.secret.joinCode) throw new Error('가입 코드가 올바르지 않아요.');
      const email = db.auth.find((a) => a.uid === m.uid)?.email || m.email || '';
      db.members = db.members.filter((x) => x.id !== m.uid);
      db.members.push({
        id: m.uid, name: m.name, phone: m.phone, role: m.role || '부원', grade: Number(m.grade) || 1, email,
        isAdmin: false, active: true, prefs: { ...DEFAULT_PREFS }, tokens: [], createdAt: Date.now(),
      });
      commit();
    },
    watchMe(id, cb) { return watch(() => member(id) || null, cb); },
    watchMembers(cb) { return watch(() => db.members, cb); },
    async updateMember(id, patch) { Object.assign(member(id), patch); commit(); },
    async removeMember(id) { db.members = db.members.filter((m) => m.id !== id); commit(); },
    async addToken() {},

    // ---- 설정 ----
    watchConfig(cb) { return watch(() => db.config, cb); },
    async saveConfig(patch) { db.config = { ...db.config, ...patch }; commit(); },
    async getJoinCode() { return db.secret.joinCode; },
    async setJoinCode(code) { db.secret.joinCode = code; commit(); },

    // ---- 순찰 일정 ----
    watchShifts(from, to, cb) { return watch(() => db.shifts.filter((s) => s.date >= from && s.date <= to), cb); },
    watchShift(id, cb) { return watch(() => shiftById(id) || null, cb); },
    async getShifts(from, to) { return clone(db.shifts.filter((s) => s.date >= from && s.date <= to)); },
    async saveShift(sh) {
      const { id, ...data } = clone(sh);
      if (id && shiftById(id)) {
        Object.assign(shiftById(id), data, { updatedAt: Date.now() });
        commit();
        return id;
      }
      const nid = newId();
      db.shifts.push({ ...data, id: nid, createdAt: Date.now(), updatedAt: Date.now() });
      commit();
      return nid;
    },
    async addShifts(list) {
      for (const s of list) db.shifts.push({ ...clone(s), id: newId(), createdAt: Date.now(), updatedAt: Date.now() });
      commit();
    },
    async deleteShifts(ids) { const set = new Set(ids); db.shifts = db.shifts.filter((s) => !set.has(s.id)); commit(); },
    async deleteShift(id) { db.shifts = db.shifts.filter((s) => s.id !== id); commit(); },

    // ---- 대타 요청 ----
    watchRequests(since, cb) { return watch(() => db.requests.filter((r) => r.shiftDate >= since), cb); },
    async createRequest(r) {
      const id = newId();
      db.requests.push({ ...clone(r), id, status: 'pending', createdAt: Date.now() });
      commit();
      return id;
    },
    async acceptRequest(id, me) {
      const req = db.requests.find((r) => r.id === id);
      if (!req) throw new Error('요청을 찾을 수 없어요.');
      const sh = shiftById(req.shiftId);
      if (!sh) throw new Error('해당 순찰 일정이 삭제되었어요.');
      sh.memberIds = applySwap(sh, req, me.id);
      sh.updatedAt = Date.now();
      sh.updatedBy = me.id;
      Object.assign(req, { status: 'accepted', resolvedBy: me.id, resolvedByName: me.name, resolvedAt: Date.now() });
      commit();
    },
    async updateRequest(id, patch) {
      const req = db.requests.find((r) => r.id === id);
      if (!req) throw new Error('요청을 찾을 수 없어요.');
      if (req.status !== 'pending') throw new Error('이미 처리된 요청이에요.');
      Object.assign(req, patch, { resolvedAt: Date.now() });
      commit();
    },

    // ---- 채팅 ----
    watchRooms(me, cb) { return watch(() => db.rooms.filter((r) => r.members?.includes(me)), cb); },
    watchRoom(id, cb) { return watch(() => db.rooms.find((r) => r.id === id) || null, cb); },
    async ensureRoom() {},
    watchMessages(roomId, cb) { return watch(() => (db.messages[roomId] || []).slice(-150), cb); },
    async sendMessage(roomId, roomMembers, msg) {
      const at = Date.now();
      let room = db.rooms.find((r) => r.id === roomId);
      if (!room) db.rooms.push((room = { id: roomId, ...(roomId === 'all' ? {} : { members: roomMembers }) }));
      Object.assign(room, { lastText: msg.text, lastName: msg.name, lastAt: at });
      (db.messages[roomId] ||= []).push({ ...msg, id: newId(), createdAt: at });
      commit();
    },

    // ---- 알림 / 기록 ----
    async notify(toUids, payload) {
      db.outbox.push({ ...payload, toUids, seq: ++db.seq, createdAt: Date.now() });
      db.outbox = db.outbox.slice(-50);
      commit();
      deliver();
    },
    async log(entry) {
      db.history.unshift({ ...entry, id: newId(), at: Date.now() });
      db.history = db.history.slice(0, 300);
      commit();
    },
    watchHistory(cb) { return watch(() => db.history.slice(0, 150), cb); },

    async exportAll() {
      return clone({
        exportedAt: new Date().toISOString(), config: db.config,
        members: db.members.map(({ tokens, ...m }) => m), shifts: db.shifts, requests: db.requests, history: db.history,
      });
    },
    demoAccounts() { return clone(db.members.filter((m) => db.auth.some((a) => a.uid === m.id))); },
  };
}
