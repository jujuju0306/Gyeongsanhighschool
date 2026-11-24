// 휴대폰 알림(푸시) 등록 및 앱이 열려 있을 때의 즉시 알림
import { isIOS, isStandalone } from './utils.js';
import { CDN } from './store/firebase.js';

export function pushState() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

const swReady = () =>
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error('서비스 워커를 불러오지 못했어요. https 주소로 접속했는지 확인해 주세요.')), 8000)),
  ]);

// 알림 켜기. 반드시 버튼 클릭 안에서 호출해야 합니다 (아이폰 정책).
export async function enablePush(app, { silent = false } = {}) {
  if (pushState() === 'unsupported') {
    if (silent) return null;
    throw new Error(
      isIOS() && !isStandalone()
        ? '아이폰은 Safari에서 [공유] → [홈 화면에 추가]로 설치한 앱에서만 알림을 받을 수 있어요.'
        : '이 브라우저는 알림을 지원하지 않아요.',
    );
  }
  const perm = silent ? Notification.permission : await Notification.requestPermission();
  if (perm !== 'granted') {
    if (silent) return null;
    throw new Error('알림 권한이 꺼져 있어요. 휴대폰 설정 → 알림에서 이 앱(또는 브라우저)의 알림을 허용해 주세요.');
  }
  if (app.store.mode !== 'firebase') return 'local';
  if (!self.FIREBASE_VAPID_KEY) throw new Error('firebase-config.js 에 FIREBASE_VAPID_KEY(웹 푸시 인증서 키)를 입력해 주세요.');
  const reg = await swReady();
  const M = await import(`${CDN}/firebase-messaging.js`);
  if (!(await M.isSupported())) throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요.');
  const token = await M.getToken(M.getMessaging(app.store.app), {
    vapidKey: self.FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (token && !(app.me.tokens || []).includes(token)) await app.store.addToken(app.me.id, token);
  return 'push';
}

// 앱이 열려 있을 때 바로 띄우는 알림
export async function showLocal(title, body, { url = '#home', tag } = {}) {
  if (pushState() !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag, data: { url } });
    } else {
      new Notification(title, { body, icon: 'icons/icon-192.png' });
    }
    return true;
  } catch {
    return false;
  }
}
