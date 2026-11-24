// firebase-config.js 에 설정값이 있으면 클라우드(Firebase), 없으면 데모 모드로 실행합니다.
// 주소 끝에 ?demo 를 붙이면 설정이 있어도 데모 모드로 열 수 있어요.
export async function getStore() {
  const cfg = self.FIREBASE_CONFIG;
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (cfg && cfg.apiKey && !forceDemo) {
    const { createFirebaseStore } = await import('./firebase.js');
    return createFirebaseStore(cfg);
  }
  const { createDemoStore } = await import('./demo.js');
  return createDemoStore();
}
