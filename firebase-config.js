// ===============================================================
//  Firebase 연결 설정  (자세한 방법은 README.md 의 "2단계" 참고)
// ---------------------------------------------------------------
//  비워두면(null) "데모 모드"로 실행됩니다. 데모 모드는 이 기기에만 저장돼요.
//  아래 값은 공개되어도 괜찮은 값입니다. (보안은 firestore.rules 가 담당)
// ===============================================================

// 1) Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → 일반 → 내 앱(웹 </>) → "SDK 설정 및 구성"의 firebaseConfig 를 그대로 붙여넣기
self.FIREBASE_CONFIG = null;
/* 예시:
self.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "my-patrol.firebaseapp.com",
  projectId: "my-patrol",
  storageBucket: "my-patrol.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

// 2) Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시징 → 웹 구성 → "웹 푸시 인증서" 키 쌍 (BL... 로 시작하는 긴 문자열)
self.FIREBASE_VAPID_KEY = "";
