// =============================================================
//  학생부 순찰 알림 발송 서버
//  - GitHub Actions 가 10분마다 이 파일을 실행합니다 (.github/workflows/notifier.yml)
//  - 하는 일:
//    1) 순찰 전날 알림 (기본 20시) / 순찰 시작 시각(07:30) 정각 알림
//    2) 앱에서 쌓인 알림(outbox: 대타 요청, 일정 변경, 채팅 등)을 휴대폰 푸시로 발송
//  - 필요한 환경 변수:
//    FIREBASE_SERVICE_ACCOUNT : Firebase 서비스 계정 키(JSON 전체)
//    APP_URL                  : 배포된 앱 주소 (예: https://아이디.github.io/patrol/)
//  - 로컬 시험: node index.js --dry   (실제로 보내지 않고 무엇을 보낼지만 출력)
// =============================================================
import admin from 'firebase-admin';

const DRY = process.argv.includes('--dry');
// --wait-until 07:30 : 그 시각(한국 시간)까지 기다렸다가 실행 → 07:30 정각 알림
const waitArg = process.argv.indexOf('--wait-until');
const WAIT_UNTIL = waitArg > -1 ? process.argv[waitArg + 1] : null;
const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) {
  // 아직 설정 전이면 실패로 표시하지 않고 조용히 끝냄 (10분마다 실패 메일이 오는 것 방지)
  console.warn('FIREBASE_SERVICE_ACCOUNT 비밀 값이 아직 없어 알림을 보내지 않았습니다. README 의 4단계를 확인하세요.');
  process.exit(0);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
const db = admin.firestore();
const fcm = admin.messaging();
const APP_URL = (process.env.APP_URL || '').trim().replace(/\/?$/, '/');

// 한국 시간 기준 오늘/내일과 현재 분(0~1439)
function kst() {
  const k = new Date(Date.now() + 9 * 3600e3);
  const tomorrow = new Date(k.getTime() + 86400e3);
  return { today: k.toISOString().slice(0, 10), tomorrow: tomorrow.toISOString().slice(0, 10), minutes: k.getUTCHours() * 60 + k.getUTCMinutes() };
}
const toMin = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const short = (ds) => { const d = new Date(ds + 'T00:00:00Z'); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})`; };

async function waitUntilKst(hm) {
  const k = kst();
  const target = toMin(hm);
  const ms = (target - k.minutes) * 60000 - new Date().getUTCSeconds() * 1000;
  if (ms > 0 && ms < 40 * 60000) {
    console.log(`한국 시간 ${hm} 까지 ${Math.round(ms / 1000)}초 기다립니다...`);
    await new Promise((r) => setTimeout(r, ms));
  }
}

async function main() {
  if (WAIT_UNTIL) await waitUntilKst(WAIT_UNTIL);
  const [membersSnap, cfgSnap, outSnap] = await Promise.all([
    db.collection('members').get(),
    db.doc('config/app').get(),
    db.collection('outbox').orderBy('createdAt').limit(400).get(),
  ]);
  const members = new Map(membersSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const dayHour = Number(cfg.dayBeforeHour ?? 20);

  /** uid → [{title, body, url, group}] */
  const queue = new Map();
  const add = (uid, msg) => {
    const m = members.get(uid);
    if (!m || m.active === false) return;
    if (!queue.has(uid)) queue.set(uid, []);
    queue.get(uid).push(msg);
  };

  // 1) 앱에서 쌓인 알림
  for (const d of outSnap.docs) {
    const o = d.data();
    const ids = o.toUids || [];
    const targets = ids.includes('ALL') ? [...members.keys()].filter((id) => id !== o.fromUid) : ids;
    for (const uid of targets) add(uid, { title: o.title, body: o.body, url: o.url, group: o.group || d.id });
  }

  // 2) 순찰 알림 (오늘·내일)
  const k = kst();
  const shiftsSnap = await db.collection('shifts').where('date', '>=', k.today).where('date', '<=', k.tomorrow).get();
  const reminderUpdates = [];
  for (const d of shiftsSnap.docs) {
    const s = d.data();
    const done = s.reminded || {};
    const patch = {};
    const start = toMin(s.start), end = toMin(s.end || s.start);
    for (const uid of s.memberIds || []) {
      const m = members.get(uid);
      if (!m) continue;
      const prefs = { dayBefore: true, atStart: true, ...(m.prefs || {}) };
      if (s.date === k.tomorrow && prefs.dayBefore && k.minutes >= dayHour * 60 && !done[`${uid}_day`]) {
        add(uid, { title: '내일 순찰이 있어요', body: `${short(s.date)} ${s.start} ${s.name} · ${s.location || ''}`, url: '#home', group: `day_${d.id}`, tag: `day_${d.id}` });
        patch[`reminded.${uid}_day`] = true;
      }
      // 순찰 시작 시각(07:30) 정각 알림
      if (s.date === k.today && prefs.atStart !== false && k.minutes >= start && k.minutes < end && !done[`${uid}_soon`]) {
        add(uid, {
          title: '지금 순찰 시간이에요',
          body: `${s.name} ${s.start}~${s.end} · ${s.location || ''}`, url: '#home', group: `soon_${d.id}`, tag: `soon_${d.id}`,
        });
        patch[`reminded.${uid}_soon`] = true;
      }
    }
    if (Object.keys(patch).length) reminderUpdates.push([d.ref, patch]);
  }

  // 3) 발송 (같은 묶음의 알림은 하나로 합치기: 예) 단체방 메시지 5개 → 1개 알림)
  let sent = 0, failed = 0;
  const badTokens = new Map(); // uid → [token]
  for (const [uid, msgs] of queue) {
    const tokens = [...new Set(members.get(uid).tokens || [])];
    const groups = new Map();
    for (const m of msgs) {
      if (!groups.has(m.group)) groups.set(m.group, []);
      groups.get(m.group).push(m);
    }
    for (const list of groups.values()) {
      const last = list[list.length - 1];
      const body = list.length > 1 ? `${last.body} (외 ${list.length - 1}건)` : last.body;
      const link = APP_URL ? APP_URL + (last.url || '') : last.url || './';
      if (DRY || !tokens.length) {
        console.log(`${DRY ? '[DRY]' : '[토큰 없음]'} → ${members.get(uid).name}: ${last.title} / ${body}`);
        continue;
      }
      const res = await fcm.sendEachForMulticast({
        tokens,
        data: { title: String(last.title || ''), body: String(body || ''), url: String(link), tag: String(last.tag || '') },
        webpush: { headers: { Urgency: 'high', TTL: '86400' }, fcmOptions: APP_URL ? { link } : undefined },
      });
      res.responses.forEach((r, i) => {
        if (r.success) sent++;
        else {
          failed++;
          const code = r.error?.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
            if (!badTokens.has(uid)) badTokens.set(uid, []);
            badTokens.get(uid).push(tokens[i]);
          } else console.warn('발송 실패', members.get(uid).name, code);
        }
      });
    }
  }

  if (!DRY) {
    const writes = [
      ...outSnap.docs.map((d) => (b) => b.delete(d.ref)),
      ...reminderUpdates.map(([ref, patch]) => (b) => b.update(ref, patch)),
      ...[...badTokens].map(([uid, t]) => (b) => b.update(db.doc(`members/${uid}`), { tokens: admin.firestore.FieldValue.arrayRemove(...t) })),
    ];
    for (let i = 0; i < writes.length; i += 400) {
      const b = db.batch();
      writes.slice(i, i + 400).forEach((w) => w(b));
      await b.commit();
    }
  }
  console.log(`완료: 대기 알림 ${outSnap.size}건, 순찰 알림 대상 ${reminderUpdates.length}건, 발송 성공 ${sent}, 실패 ${failed}, 만료 토큰 정리 ${[...badTokens.values()].flat().length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
