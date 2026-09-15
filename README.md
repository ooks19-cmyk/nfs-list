# 🗺️ 미식로드 (Gourmet Road) - 네이버 지도 맛집 리스트 공유 웹앱

누구나 자유롭게 네이버 지도 맛집 리스트 링크를 공유하고, 좋아요 및 익명 댓글로 맛집 정보를 나눌 수 있는 오픈 커뮤니티 웹 애플리케이션입니다.

---

## ✨ 주요 기능

1. **맛집 리스트 등록 & 네이버 지도 연결**
   - 제목, 지역 분류(구미, 서울, 제주 등), 한줄 설명, 네이버 지도 리스트 공유 링크(`https://naver.me/...`) 등록
   - [바로가기] 버튼을 통해 네이버 지도 앱 또는 웹페이지로 즉시 이동
2. **비밀번호 기반 수정 & 삭제 관리**
   - 글 작성 시 4자리 이상 비밀번호 설정
   - SHA-256 해시 단방향 암호화로 안전하게 검증하여 작성자만 수정 및 삭제 가능
3. **1-클릭 좋아요 (추천)**
   - 브라우저 로컬 저장소를 활용한 1인 1좋아요 중복 방지 및 토글 취소 지원
4. **익명 댓글 & 랜덤 닉네임**
   - 위트 있고 친근한 한국어 미식가 닉네임 자동 생성 (예: *‘얼큰한 국밥러버 #812’*, *‘바삭한 미식가 #309’*)
   - 주사위 버튼(🎲)으로 원하는 닉네임 다시뽑기 및 직접 수정 지원
5. **탐색 & 검색 & 정렬**
   - 빠른 지역 필터 칩 (#구미, #서울, #대구/경북, #제주 등)
   - 실시간 통합 키워드 검색바
   - 최신 등록순 / 좋아요 많은 순 / 댓글 많은 순 정렬
6. **하이브리드 데이터베이스 (Firebase Firestore + LocalStorage)**
   - 별도 설정 없이도 즉시 작동하는 데모 모드 내장
   - Firebase Firestore 연동 시 전 세계 접속자와 실시간 공유 가능

---

## 🚀 GitHub Pages 1분 무료 배포 방법

이 프로젝트는 별도의 Node.js 빌드 과정(`npm run build`)이 필요 없는 **순수 웹 표준(HTML5 + Vanilla JS + CSS3)**으로 구성되어 있어 GitHub에 올리기만 하면 즉시 호스팅됩니다.

1. GitHub에 새 저장소(Repository)를 생성합니다.
2. 프로젝트 폴더의 모든 파일을 GitHub 저장소 `main` 브랜치에 push합니다.
3. GitHub 저장소 페이지의 **[Settings]** > 좌측 메뉴 **[Pages]**로 이동합니다.
4. **Branch** 설정을 `main` / `/(root)`로 선택하고 **[Save]**를 클릭합니다.
5. 1~2분 후 생성되는 `https://<깃허브아이디>.github.io/<저장소이름>/` 링크로 접속하면 배포가 완료됩니다!

---

## 🔥 Firebase Cloud Firestore 실시간 DB 연동 가이드

여러 사용자가 올린 맛집 리스트와 댓글을 영구적이고 실시간으로 공유하려면 무료 Firebase Firestore를 연동할 수 있습니다.

1. [Firebase 콘솔](https://console.firebase.google.com/)에 접속하여 Google 계정으로 로그인 후 **[프로젝트 만들기]**를 클릭합니다.
2. 프로젝트 생성 후 좌측 메뉴 **[빌드] > [Firestore Database]**를 클릭하여 데이터베이스를 만듭니다. (위치는 `asia-northeast3 (서울)` 권장, 시작 모드는 `테스트 모드` 선택)
3. 프로젝트 개요 페이지에서 **[웹 (</>)]** 아이콘을 클릭하여 앱을 등록하고, 화면에 나오는 `firebaseConfig` 객체 값을 복사합니다.
4. 프로젝트의 [`js/firebase-config.js`](file:///g:/내%20드라이브/투자정리2/gourmet%20list/js/firebase-config.js) 파일을 열어 설정값을 붙여넣습니다:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

5. 변경 사항을 저장하고 GitHub에 push하면 전 세계 어디서나 실시간으로 맛집 데이터가 동기화됩니다!

---

## 🤖 관리자용 네이버 지도 목록 수 갱신

웹 페이지는 네이버 지도를 직접 파싱하지 않습니다. 관리자가 필요할 때마다 배치 스크립트를 실행하면, Firestore의 `gourmet_lists`를 순회하여 공개 네이버 저장 리스트의 ‘저장된 장소 수’를 읽고 기록합니다.

1. Firebase Console에서 전용 서비스 계정을 만든 뒤 JSON 키를 발급합니다. 서비스 계정에는 Firestore를 읽고 쓸 권한이 필요합니다.
2. GitHub 저장소의 **Settings → Secrets and variables → Actions**에서 `FIREBASE_SERVICE_ACCOUNT`라는 이름의 secret을 만듭니다. 값은 서비스 계정 JSON 파일 전체 내용입니다. JSON 키 파일은 저장소에 올리지 않습니다.
3. GitHub 저장소의 **Actions → Refresh Naver place counts → Run workflow**를 실행합니다. 처음에는 `dry_run` 실행으로 로그만 확인하고, 결과가 정상이면 `dry_run`을 끄고 실행하세요.

실행은 GitHub의 임시 서버에서 이루어지므로 관리자가 사용하는 PC나 모바일에 브라우저 자동화 환경이 있을 필요가 없습니다. Firestore 문서에 `placeCount`, `placeCountUpdatedAt`, `placeCountStatus`, `placeCountError` 필드가 기록됩니다.

이 PC에서 실행하려면 프로젝트 최상위의 `run-refresh-place-counts.bat`을 더블클릭하고, Firebase 서비스 계정 JSON 파일 경로를 입력하세요. 처음에는 기본 설정인 점검 모드로 실행한 후, 결과를 확인하고 저장 모드를 선택하세요.

공개로 공유된 네이버 저장 리스트만 처리하며, 네이버의 화면·정책 변경으로 실패할 경우 실패 사유를 기록하고 다음 배치에서 다시 시도합니다. 웹 페이지에서 실행하는 트리거는 추후 다룹니다.

---

## 📂 파일 구조

```
gourmet list/
├── index.html            # 메인 HTML 템플릿 및 모달 구성
├── css/
│   └── style.css         # 웜 푸디 테마 CSS 디자인 시스템 & 반응형
├── js/
│   ├── firebase-config.js # Firebase Firestore 연동 설정
│   ├── store.js          # Firestore / LocalStorage 데이터 매니저
│   ├── nickname.js       # 한국어 익명 미식가 닉네임 생성기
│   ├── security.js       # SHA-256 해시 및 네이버 지도 URL 파서
│   └── app.js            # 메인 애플리케이션 UI 제어 및 이벤트 처리
├── implementation_plan.md# 설계 및 구현 계획서
└── README.md             # 프로젝트 안내 및 배포 매뉴얼
```
