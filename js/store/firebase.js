// 클라우드 저장소: Firebase (로그인 + Firestore 데이터베이스)
// 모든 부원의 휴대폰이 같은 데이터를 실시간으로 공유합니다.
import { applySwap, DEFAULT_PREFS } from '../utils.js';

export const FIREBASE_VERSION = '10.12.2';
export const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const AUTH_ERRORS = {
  'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
  'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않아요.',
  'auth/wrong-password': '이메일 또는 비밀번호가 올바르지 않아요.',
  'auth/user-not-found': '가입되지 않은 이메일이에요.',
  'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
};

export async function createFirebaseStore(cfg) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  const {
    doc, collection, query, where, orderBy, limit, onSnapshot, setDoc, updateDoc, addDoc, deleteDoc,
    getDoc, getDocs, writeBatch, serverTimestamp, runTransaction, arrayUnion,
  } = F;

  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  let db;
  try {
    // 오프라인에서도 마지막으로 본 일정표를 볼 수 있도록 기기에 캐시
    db = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
    });
  } catch {
    db = F.getFirestore(app);
  }

  const norm = (snap) => {
    const d = snap.data({ serverTimestamps: 'estimate' });
    for (const k in d) if (d[k] && typeof d[k].toMillis === 'function') d[k] = d[k].toMillis();
    return { id: snap.id, ...d };
  };
  const list = (qs) => qs.docs.map(norm);
  const onErr = (e) => console.error('[Firestore]', e);
  const wrapAuth = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      throw new Error(AUTH_ERRORS[e.code] || e.message);
    }
  };
  const chunks = (arr, n = 400) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  return {
    mode: 'firebase',
    app,

    // ---- 로그인 ----
    onAuth(cb) {
      return A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
    },
    signIn: (email, pw) => wrapAuth(() => A.signInWithEmailAndPassword(auth, String(email).trim(), pw)),
    signUp: (email, pw) =>
      wrapAuth(async () => (await A.createUserWithEmailAndPassword(auth, String(email).trim(), pw)).user.uid),
    resetPassword: (email) => wrapAuth(() => A.sendPasswordResetEmail(auth, String(email).trim())),
    signOut: () => A.signOut(auth),

    // ---- 부원 ----
    async createMember(m) {
      try {
        await setDoc(doc(db, 'members', m.uid), {
          name: m.name, phone: m.phone, role: m.role || '부원', grade: Number(m.grade) || 1,
          email: auth.currentUser?.email || '', joinCode: String(m.joinCode).trim(),
          isAdmin: false, active: true, prefs: { ...DEFAULT_PREFS }, tokens: [], createdAt: serverTimestamp(),
        });
      } catch (e) {
        if (e.code === 'permission-denied') throw new Error('가입 코드가 올바르지 않아요.');
        throw e;
      }
    },
    watchMe(uid, cb) {
      return onSnapshot(doc(db, 'members', uid), (s) => cb(s.exists() ? norm(s) : null), (e) => { onErr(e); cb(null); });
    },
    watchMembers(cb) { return onSnapshot(collection(db, 'members'), (s) => cb(list(s)), onErr); },
    updateMember: (uid, patch) => updateDoc(doc(db, 'members', uid), patch),
    removeMember: (uid) => deleteDoc(doc(db, 'members', uid)),
    addToken: (uid, token) => updateDoc(doc(db, 'members', uid), { tokens: arrayUnion(token) }),

    // ---- 설정 ----
    watchConfig(cb) { return onSnapshot(doc(db, 'config', 'app'), (s) => cb(s.exists() ? s.data() : null), onErr); },
    saveConfig: (patch) => setDoc(doc(db, 'config', 'app'), patch, { merge: true }),
    async getJoinCode() {
      const s = await getDoc(doc(db, 'config', 'secret'));
      return s.exists() ? s.data().joinCode || '' : '';
    },
    setJoinCode: (code) => setDoc(doc(db, 'config', 'secret'), { joinCode: code }, { merge: true }),

    // ---- 순찰 일정 ----
    watchShifts(from, to, cb) {
      const q = query(collection(db, 'shifts'), where('date', '>=', from), where('date', '<=', to));
      return onSnapshot(q, (s) => cb(list(s)), onErr);
    },
    watchShift(id, cb) { return onSnapshot(doc(db, 'shifts', id), (s) => cb(s.exists() ? norm(s) : null), onErr); },
    async getShifts(from, to) {
      return list(await getDocs(query(collection(db, 'shifts'), where('date', '>=', from), where('date', '<=', to))));
    },
    async saveShift(sh) {
      const { id, createdAt, ...data } = sh;
      data.updatedAt = serverTimestamp();
      if (id) {
        await updateDoc(doc(db, 'shifts', id), data);
        return id;
      }
      return (await addDoc(collection(db, 'shifts'), { ...data, createdAt: serverTimestamp() })).id;
    },
    async addShifts(arr) {
      for (const part of chunks(arr)) {
        const b = writeBatch(db);
        for (const s of part) b.set(doc(collection(db, 'shifts')), { ...s, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await b.commit();
      }
    },
    async deleteShifts(ids) {
      for (const part of chunks(ids)) {
        const b = writeBatch(db);
        for (const id of part) b.delete(doc(db, 'shifts', id));
        await b.commit();
      }
    },
    deleteShift: (id) => deleteDoc(doc(db, 'shifts', id)),

    // ---- 대타 요청 ----
    watchRequests(since, cb) {
      return onSnapshot(query(collection(db, 'requests'), where('shiftDate', '>=', since)), (s) => cb(list(s)), onErr);
    },
    async createRequest(r) {
      return (await addDoc(collection(db, 'requests'), { ...r, status: 'pending', createdAt: serverTimestamp() })).id;
    },
    async acceptRequest(id, me) {
      await runTransaction(db, async (tx) => {
        const rRef = doc(db, 'requests', id);
        const rSnap = await tx.get(rRef);
        if (!rSnap.exists()) throw new Error('요청을 찾을 수 없어요.');
        const req = rSnap.data();
        const sRef = doc(db, 'shifts', req.shiftId);
        const sSnap = await tx.get(sRef);
        if (!sSnap.exists()) throw new Error('해당 순찰 일정이 삭제되었어요.');
        const next = applySwap(sSnap.data(), req, me.id);
        tx.update(sRef, { memberIds: next, updatedAt: serverTimestamp(), updatedBy: me.id });
        tx.update(rRef, { status: 'accepted', resolvedBy: me.id, resolvedByName: me.name, resolvedAt: serverTimestamp() });
      });
    },
    async updateRequest(id, patch) {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'requests', id);
        const s = await tx.get(ref);
        if (!s.exists()) throw new Error('요청을 찾을 수 없어요.');
        if (s.data().status !== 'pending') throw new Error('이미 처리된 요청이에요.');
        tx.update(ref, { ...patch, resolvedAt: serverTimestamp() });
      });
    },

    // ---- 채팅 ----
    watchRooms(uid, cb) {
      return onSnapshot(query(collection(db, 'rooms'), where('members', 'array-contains', uid)), (s) => cb(list(s)), onErr);
    },
    watchRoom(id, cb) { return onSnapshot(doc(db, 'rooms', id), (s) => cb(s.exists() ? norm(s) : null), onErr); },
    async ensureRoom(roomId, roomMembers) {
      if (roomId !== 'all') await setDoc(doc(db, 'rooms', roomId), { members: roomMembers }, { merge: true });
    },
    watchMessages(roomId, cb) {
      const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'desc'), limit(150));
      return onSnapshot(q, (s) => cb(list(s).reverse()), (e) => { onErr(e); cb([]); });
    },
    async sendMessage(roomId, roomMembers, msg) {
      const roomRef = doc(db, 'rooms', roomId);
      await setDoc(roomRef, {
        ...(roomId === 'all' ? {} : { members: roomMembers }),
        lastText: msg.text, lastName: msg.name, lastAt: serverTimestamp(),
      }, { merge: true });
      await addDoc(collection(roomRef, 'messages'), { ...msg, createdAt: serverTimestamp() });
    },

    // ---- 알림 / 기록 ----
    // outbox 에 넣어두면 알림 발송 서버(notifier)가 푸시 알림으로 보냅니다.
    notify: (toUids, payload) => addDoc(collection(db, 'outbox'), { ...payload, toUids, createdAt: serverTimestamp() }),
    log: (entry) => addDoc(collection(db, 'history'), { ...entry, at: serverTimestamp() }),
    watchHistory(cb) {
      return onSnapshot(query(collection(db, 'history'), orderBy('at', 'desc'), limit(150)), (s) => cb(list(s)), onErr);
    },

    async exportAll() {
      const [members, shifts, requests, history, cfg] = await Promise.all([
        getDocs(collection(db, 'members')), getDocs(collection(db, 'shifts')), getDocs(collection(db, 'requests')),
        getDocs(query(collection(db, 'history'), orderBy('at', 'desc'), limit(1000))), getDoc(doc(db, 'config', 'app')),
      ]);
      return {
        exportedAt: new Date().toISOString(), config: cfg.exists() ? cfg.data() : null,
        members: list(members).map(({ tokens, joinCode, ...m }) => m),
        shifts: list(shifts), requests: list(requests), history: list(history),
      };
    },
  };
}
