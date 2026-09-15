/**
 * ===================================================================
 * 미식로드 (Gourmet Road) - 메인 애플리케이션 스크립트
 * Firebase Firestore 실시간 DB 연동 + LocalStorage 데모 모드 지원
 * ===================================================================
 */

(function () {
  'use strict';

  // =================================================================
  // 1. 보안 & 유틸리티 모듈 (SHA-256 해시)
  // =================================================================
  function pureJsSha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    let i, j;
    const words = [];
    const asciiBitLength = ascii.length * 8;
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    for (i = 0; i < ascii.length; i++) {
      const code = ascii.charCodeAt(i);
      words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
    }
    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

    for (i = 0; i < words.length; i += 16) {
      const w = [];
      for (j = 0; j < 16; j++) w[j] = words[i + j] || 0;
      for (j = 16; j < 64; j++) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (((w[j - 16] + s0) | 0) + ((w[j - 7] + s1) | 0)) | 0;
      }

      let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
      let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

      for (j = 0; j < 64; j++) {
        const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (((((h + s1) | 0) + ch) | 0) + ((k[j] + w[j]) | 0)) | 0;
        const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      hash[0] = (hash[0] + a) | 0;
      hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0;
      hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0;
      hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0;
      hash[7] = (hash[7] + h) | 0;
    }

    let hexResult = '';
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const bVal = (hash[i] >> (j * 8)) & 255;
        hexResult += (bVal < 16 ? '0' : '') + bVal.toString(16);
      }
    }
    return hexResult;
  }

  const Security = {
    async hashPassword(message) {
      if (!message) return '';
      const clean = String(message).trim();
      if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(clean);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
          return pureJsSha256(clean);
        }
      }
      return pureJsSha256(clean);
    },

    async verifyPassword(inputPassword, storedHash) {
      if (!inputPassword || !storedHash) return false;
      const inputHash = await this.hashPassword(inputPassword);
      return inputHash === storedHash;
    },

    isValidNaverMapUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const cleanUrl = url.trim();
      return (
        cleanUrl.includes('naver.me') ||
        cleanUrl.includes('map.naver.com') ||
        cleanUrl.startsWith('http://') ||
        cleanUrl.startsWith('https://')
      );
    },

    extractUrl(text) {
      if (!text) return '';
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = text.match(urlRegex);
      return match ? match[0] : text.trim();
    }
  };

  // =================================================================
  // 2. 한국어 익명 닉네임 생성기
  // =================================================================
  const ADJECTIVES = [
    '배고픈', '바삭한', '달콤한', '얼큰한', '쫄깃한', '촉촉한', '고소한', '매콤한',
    '단짠단짠', '행복한', '미식탐험', '숨은고수', '겉바속촉', '갓지은', '감칠맛나는',
    '풍미가득', '숯불향솔솔', '시원한', '진한국물', '담백한', '소문난', '웨이팅장인',
    '야식러버', '면치기장인', '혼밥고수', '줄서는', '노포탐방', '디저트덕후', '단골예약'
  ];

  const NOUNS = [
    '미식가', '먹깨비', '푸디', '대식가', '호로록', '국밥러버', '돈까스덕후', '라멘장인',
    '초밥왕', '고기굽기장인', '파스타러버', '빵순이', '빵돌이', '치킨매니아', '피자헌터',
    '떡볶이요정', '삼겹살파이터', '커피러버', '냉면마니아', '만두러버', '버거마스터',
    '마라탕중독자', '미식로드', '맛집원정대', '쩝쩝박사', '푸드파이터', '맛비게이션'
  ];

  const NicknameGenerator = {
    generate() {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      const num = Math.floor(Math.random() * 900) + 100;
      return `${adj} ${noun} #${num}`;
    }
  };

  // =================================================================
  // 3. Firestore & LocalStorage 하이브리드 데이터 매니저
  // =================================================================
  const STORAGE_KEY_LISTS = 'gourmet_map_lists_v1';
  const STORAGE_KEY_LIKES = 'gourmet_map_user_likes_v1';

  const INITIAL_DEMO_DATA = [
    {
      id: 'demo-1',
      title: '구미 현지인 찐맛집 & 노포 총정리',
      region: '구미',
      description: '구미 토박이가 엄선한 선산곱창, 국밥, 직화불고기 인생 맛집 지도 모음입니다!',
      naverUrl: 'https://naver.me/xJcslhFt',
      passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', // 1234
      likesCount: 24,
      comments: [
        { id: 'c-1', nickname: '얼큰한 국밥러버 #812', content: '구미 가면 선산곱창은 진짜 필수코스죠! 잘 저장해둡니다 ㅎㅎ', createdAt: Date.now() - 3600000 * 24 },
        { id: 'c-2', nickname: '바삭한 미식가 #309', content: '리스트 깔끔하게 잘 정리되어 있네요. 주말에 구미 갈 때 참고할게요!', createdAt: Date.now() - 3600000 * 5 }
      ],
      createdAt: Date.now() - 3600000 * 48,
      updatedAt: Date.now() - 3600000 * 48
    },
    {
      id: 'demo-2',
      title: '성수 & 한남 카페/디저트 성지순례',
      region: '서울',
      description: '분위기 깡패 에스프레소 바부터 줄 서서 먹는 베이커리까지 성수·한남 핫플만 모음',
      naverUrl: 'https://naver.me/54VqB4bY',
      passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
      likesCount: 42,
      comments: [
        { id: 'c-3', nickname: '달콤한 빵순이 #115', content: '성수동 베이커리 리스트 진짜 알차네요! 저장 꾹 누르고 갑니다.', createdAt: Date.now() - 3600000 * 12 }
      ],
      createdAt: Date.now() - 3600000 * 72,
      updatedAt: Date.now() - 3600000 * 72
    },
    {
      id: 'demo-3',
      title: '제주 서쪽 해안도로 로컬 해산물 & 흑돼지',
      region: '제주',
      description: '애월~한림~협재 라인 바다 보면서 먹는 갈치조림과 흑돼지 구이 필수 코스',
      naverUrl: 'https://naver.me/F1Mo9kR7',
      passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
      likesCount: 38,
      comments: [
        { id: 'c-4', nickname: '풍미가득 쩝쩝박사 #770', content: '다음 주 제주도 여행인데 타이밍 최고네요!!', createdAt: Date.now() - 3600000 * 2 }
      ],
      createdAt: Date.now() - 3600000 * 96,
      updatedAt: Date.now() - 3600000 * 96
    }
  ];

  class StoreManager {
    constructor() {
      this.isFirebase = false;
      this.db = null;
      this.userLikes = new Set(this.loadUserLikesFromStorage());
      this.onDataChangeCallback = null;
    }

    async init(onDataChange) {
      this.onDataChangeCallback = onDataChange;

      // Firebase Config 검사
      const config = window.FIREBASE_CONFIG;
      const isConfigured = config && 
                           config.apiKey && 
                           config.projectId && 
                           config.apiKey !== 'YOUR_API_KEY' && 
                           config.projectId !== 'YOUR_PROJECT_ID';

      if (isConfigured && window.firebase) {
        try {
          if (!firebase.apps.length) {
            firebase.initializeApp(config);
          }
          this.db = firebase.firestore();
          this.isFirebase = true;
          this.updateDbStatusBadge(true);
          console.log('[Gourmet Store] Firebase Firestore 연결 성공!');

          // 실시간 Firestore 리스너 연결
          this.db.collection('gourmet_lists')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
              if (snapshot.empty) {
                // 첫 시작 시 데모 데이터 1회 주입
                this.seedInitialDemoDataToFirestore();
                return;
              }
              const lists = [];
              snapshot.forEach(doc => {
                lists.push({ id: doc.id, ...doc.data() });
              });
              if (this.onDataChangeCallback) {
                this.onDataChangeCallback(lists);
              }
            }, (error) => {
              console.error('Firestore 실시간 리스너 오류:', error);
              this.fallbackToLocalStorage();
            });

          return;
        } catch (err) {
          console.warn('[Gourmet Store] Firebase 초기화 실패, LocalStorage 모드로 전환:', err);
        }
      }

      // 로컬 스토리지 모드
      this.fallbackToLocalStorage();
    }

    fallbackToLocalStorage() {
      this.isFirebase = false;
      this.updateDbStatusBadge(false);
      const existing = localStorage.getItem(STORAGE_KEY_LISTS);
      if (!existing) {
        localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(INITIAL_DEMO_DATA));
      }
      if (this.onDataChangeCallback) {
        this.onDataChangeCallback(this.getLocalLists());
      }
    }

    updateDbStatusBadge(isFirebaseActive) {
      const badge = document.getElementById('db-status-badge');
      if (!badge) return;
      if (isFirebaseActive) {
        badge.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span> DB 연결완료`;
        badge.style.background = '#ECFDF5';
        badge.style.color = '#065F46';
        badge.title = 'Firebase Cloud Firestore 실시간 DB에 연결되어 모든 사용자와 데이터가 공유됩니다.';
      } else {
        badge.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span> 로컬 모드`;
        badge.style.background = '#FEF3C7';
        badge.style.color = '#92400E';
        badge.title = 'firebase-config.js에 설정값을 입력하면 실시간 클라우드 DB로 자동 전환됩니다.';
      }
    }

    async seedInitialDemoDataToFirestore() {
      if (!this.db) return;
      const batch = this.db.batch();
      INITIAL_DEMO_DATA.forEach(item => {
        const { id, ...data } = item;
        const ref = this.db.collection('gourmet_lists').doc(id);
        batch.set(ref, data);
      });
      await batch.commit();
    }

    loadUserLikesFromStorage() {
      try {
        const data = localStorage.getItem(STORAGE_KEY_LIKES);
        return data ? JSON.parse(data) : [];
      } catch {
        return [];
      }
    }

    saveUserLikesToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(Array.from(this.userLikes)));
      } catch (e) {
        console.error('좋아요 저장 실패', e);
      }
    }

    isLikedByUser(listId) {
      return this.userLikes.has(listId);
    }

    getLocalLists() {
      try {
        const data = localStorage.getItem(STORAGE_KEY_LISTS);
        return data ? JSON.parse(data) : INITIAL_DEMO_DATA;
      } catch {
        return INITIAL_DEMO_DATA;
      }
    }

    saveLocalLists(lists) {
      localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(lists));
      if (this.onDataChangeCallback) {
        this.onDataChangeCallback(lists);
      }
    }

    async addList(data) {
      const newItem = {
        title: data.title.trim(),
        region: data.region ? data.region.trim() : '전국',
        description: data.description.trim(),
        naverUrl: data.naverUrl.trim(),
        passwordHash: data.passwordHash,
        likesCount: 0,
        comments: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      if (this.isFirebase && this.db) {
        try {
          const docRef = await this.db.collection('gourmet_lists').add(newItem);
          return { id: docRef.id, ...newItem };
        } catch (err) {
          console.error('Firestore 등록 실패, 로컬 저장:', err);
        }
      }

      const lists = this.getLocalLists();
      const localItem = { id: 'list-' + Date.now(), ...newItem };
      lists.unshift(localItem);
      this.saveLocalLists(lists);
      return localItem;
    }

    async updateList(id, updateData) {
      const updatedPayload = {
        title: updateData.title.trim(),
        region: updateData.region ? updateData.region.trim() : '전국',
        description: updateData.description.trim(),
        naverUrl: updateData.naverUrl.trim(),
        updatedAt: Date.now()
      };

      if (this.isFirebase && this.db) {
        try {
          await this.db.collection('gourmet_lists').doc(id).update(updatedPayload);
          return true;
        } catch (err) {
          console.error('Firestore 수정 실패:', err);
        }
      }

      const lists = this.getLocalLists();
      const index = lists.findIndex(item => item.id === id);
      if (index !== -1) {
        lists[index] = { ...lists[index], ...updatedPayload };
        this.saveLocalLists(lists);
        return true;
      }
      return false;
    }

    async deleteList(id) {
      if (this.isFirebase && this.db) {
        try {
          await this.db.collection('gourmet_lists').doc(id).delete();
          return true;
        } catch (err) {
          console.error('Firestore 삭제 실패:', err);
        }
      }

      const lists = this.getLocalLists();
      const filtered = lists.filter(item => item.id !== id);
      this.saveLocalLists(filtered);
      return true;
    }

    async toggleLike(id) {
      const isLiked = this.userLikes.has(id);
      const delta = isLiked ? -1 : 1;

      if (isLiked) {
        this.userLikes.delete(id);
      } else {
        this.userLikes.add(id);
      }
      this.saveUserLikesToStorage();

      if (this.isFirebase && this.db) {
        try {
          await this.db.collection('gourmet_lists').doc(id).update({
            likesCount: firebase.firestore.FieldValue.increment(delta)
          });
          return { isLiked: !isLiked, delta };
        } catch (err) {
          console.error('Firestore 좋아요 업데이트 실패:', err);
        }
      }

      const lists = this.getLocalLists();
      const item = lists.find(item => item.id === id);
      if (item) {
        item.likesCount = Math.max(0, (item.likesCount || 0) + delta);
        this.saveLocalLists(lists);
      }
      return { isLiked: !isLiked, delta };
    }

    async addComment(listId, { nickname, content }) {
      const newComment = {
        id: 'cmt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        nickname: nickname.trim(),
        content: content.trim(),
        createdAt: Date.now()
      };

      if (this.isFirebase && this.db) {
        try {
          await this.db.collection('gourmet_lists').doc(listId).update({
            comments: firebase.firestore.FieldValue.arrayUnion(newComment)
          });
          return newComment;
        } catch (err) {
          console.error('Firestore 댓글 추가 실패:', err);
        }
      }

      const lists = this.getLocalLists();
      const item = lists.find(item => item.id === listId);
      if (item) {
        if (!item.comments) item.comments = [];
        item.comments.push(newComment);
        this.saveLocalLists(lists);
        return newComment;
      }
      return null;
    }
  }

  const store = new StoreManager();

  // =================================================================
  // 4. UI 및 모달 제어 로직
  // =================================================================
  let allLists = [];
  let currentRegionFilter = '전체';
  let currentSearchQuery = '';
  let currentSort = 'latest';

  const listsGrid = document.getElementById('lists-grid');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const regionTagsContainer = document.getElementById('region-tags-container');
  const btnOpenWrite = document.getElementById('btn-open-write');
  const toastContainer = document.getElementById('toast-container');

  const modalWrite = document.getElementById('modal-write');
  const writeForm = document.getElementById('write-form');
  const writeModalTitle = document.getElementById('write-modal-title');
  const editItemIdInput = document.getElementById('edit-item-id');
  const inputTitle = document.getElementById('input-title');
  const inputRegion = document.getElementById('input-region');
  const inputUrl = document.getElementById('input-url');
  const inputDesc = document.getElementById('input-desc');
  const inputPassword = document.getElementById('input-password');
  const passwordGroup = document.getElementById('password-group');

  const modalAuth = document.getElementById('modal-auth');
  const authForm = document.getElementById('auth-form');
  const authTargetIdInput = document.getElementById('auth-target-id');
  const authActionTypeInput = document.getElementById('auth-action-type');
  const authPasswordInput = document.getElementById('auth-password-input');
  const authModalTitle = document.getElementById('auth-modal-title');
  const authModalMessage = document.getElementById('auth-modal-message');

  const modalComments = document.getElementById('modal-comments');
  const commentsDetailInfo = document.getElementById('comments-detail-info');
  const commentsList = document.getElementById('comments-list');
  const commentForm = document.getElementById('comment-form');
  const commentTargetListId = document.getElementById('comment-target-list-id');
  const commentNicknameInput = document.getElementById('comment-nickname-input');
  const commentContentInput = document.getElementById('comment-content-input');
  const btnRerollNickname = document.getElementById('btn-reroll-nickname');

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : '💡'}</span>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return '방금 전';
    const diff = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return '방금 전';
    if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
    if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
    if (diff < day * 30) return `${Math.floor(diff / day)}일 전`;
    
    const d = new Date(timestamp);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.currentTarget.getAttribute('data-close');
      const targetModal = document.getElementById(modalId);
      if (targetModal) closeModal(targetModal);
    });
  });

  [modalWrite, modalAuth, modalComments].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getPlaceCount(value) {
    const count = Number(value);
    return Number.isInteger(count) && count > 0 ? count : null;
  }

  function getProcessedLists() {
    let result = [...allLists];

    if (currentRegionFilter !== '전체') {
      result = result.filter(item => item.region === currentRegionFilter || (item.region && item.region.includes(currentRegionFilter)));
    }

    if (currentSearchQuery) {
      const query = currentSearchQuery.toLowerCase();
      result = result.filter(item => 
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.region && item.region.toLowerCase().includes(query))
      );
    }

    if (currentSort === 'latest') {
      result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (currentSort === 'likes') {
      result.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else if (currentSort === 'comments') {
      result.sort((a, b) => ((b.comments ? b.comments.length : 0) - (a.comments ? a.comments.length : 0)));
    }

    return result;
  }

  function renderLists() {
    if (!listsGrid) return;
    const filtered = getProcessedLists();

    if (filtered.length === 0) {
      listsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍽️</div>
          <h3 class="empty-title">등록된 맛집 리스트가 없습니다</h3>
          <p class="empty-desc">조건에 맞는 리스트가 없거나 아직 등록되지 않았습니다. 첫 번째 맛집 지도를 공유해보세요!</p>
          <button class="btn btn-primary btn-sm" id="btn-empty-write">내가 알고 있는 맛집 올리기</button>
        </div>
      `;
      const btnEmptyWrite = document.getElementById('btn-empty-write');
      if (btnEmptyWrite) {
        btnEmptyWrite.addEventListener('click', openCreateModal);
      }
      return;
    }

    listsGrid.innerHTML = filtered.map(item => {
      const isLiked = store.isLikedByUser(item.id);
      const commentCount = item.comments ? item.comments.length : 0;
      const cleanUrl = Security.extractUrl(item.naverUrl);
      const placeCount = getPlaceCount(item.placeCount);

      return `
        <article class="gourmet-card" data-id="${item.id}">
          <div>
            <div class="card-top">
              <span class="card-region-badge">📍 ${item.region || '전국'}</span>
              <div style="display: flex; gap: 4px;">
                <button class="card-menu-btn btn-action-share" data-id="${item.id}" title="공유 링크 복사">🔗</button>
                <button class="card-menu-btn btn-action-edit" data-id="${item.id}" title="수정">✏️</button>
                <button class="card-menu-btn btn-action-delete" data-id="${item.id}" title="삭제">🗑️</button>
              </div>
            </div>

            <h3 class="card-title">${escapeHtml(item.title)}${placeCount ? ` <span class="card-place-count" aria-label="저장된 맛집 ${placeCount}개">🍽️ ${placeCount}곳</span>` : ''}</h3>
            <p class="card-desc">${escapeHtml(item.description)}</p>

            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="card-naver-box">
              <div class="naver-box-info">
                <span class="naver-icon-circle">N</span>
                <span class="naver-box-text">네이버 지도 리스트 열기</span>
              </div>
              <span class="naver-box-action">바로가기 ↗</span>
            </a>
          </div>

          <div class="card-footer">
            <div class="card-interactions">
              <button class="btn-like ${isLiked ? 'liked' : ''}" data-id="${item.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#EF4444' : 'none'}" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span class="like-count">${item.likesCount || 0}</span>
              </button>

              <button class="btn-comment" data-id="${item.id}">
                💬 <span>${commentCount}</span>
              </button>
            </div>

            <span class="card-date">${formatRelativeTime(item.createdAt)}</span>
          </div>
        </article>
      `;
    }).join('');

    bindCardEvents();
  }

  function bindCardEvents() {
    document.querySelectorAll('.btn-like').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const listId = btn.getAttribute('data-id');
        const res = await store.toggleLike(listId);
        
        const item = allLists.find(l => l.id === listId);
        if (item) {
          item.likesCount = Math.max(0, (item.likesCount || 0) + res.delta);
        }
        renderLists();
        showToast(res.isLiked ? '좋아요를 눌렀습니다! ❤️' : '좋아요를 취소했습니다.', 'info');
      });
    });

    document.querySelectorAll('.btn-comment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = btn.getAttribute('data-id');
        openCommentsModal(listId);
      });
    });

    document.querySelectorAll('.btn-action-share').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = btn.getAttribute('data-id');
        const item = allLists.find(l => l.id === listId);
        if (item) {
          const shareText = `[출장로드] ${item.title} (${item.region})\n${item.description}\n네이버지도: ${item.naverUrl}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareText).then(() => {
              showToast('공유 내용이 클립보드에 복사되었습니다! 📋', 'success');
            }).catch(() => {
              fallbackCopyText(shareText);
            });
          } else {
            fallbackCopyText(shareText);
          }
        }
      });
    });

    document.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = btn.getAttribute('data-id');
        openAuthModal(listId, 'edit');
      });
    });

    document.querySelectorAll('.btn-action-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = btn.getAttribute('data-id');
        openAuthModal(listId, 'delete');
      });
    });
  }

  function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('클립보드에 복사되었습니다! 📋', 'success');
    } catch {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
  }

  function openCreateModal() {
    writeForm.reset();
    editItemIdInput.value = '';
    writeModalTitle.textContent = '새 맛집 리스트 등록';
    document.getElementById('btn-submit-write').textContent = '등록하기';
    passwordGroup.style.display = 'block';
    inputPassword.required = true;
    openModal(modalWrite);
  }

  function openEditModal(item) {
    editItemIdInput.value = item.id;
    inputTitle.value = item.title;
    inputRegion.value = item.region || '구미';
    inputUrl.value = item.naverUrl;
    inputDesc.value = item.description;
    
    writeModalTitle.textContent = '맛집 리스트 수정';
    document.getElementById('btn-submit-write').textContent = '수정 완료';
    passwordGroup.style.display = 'none';
    inputPassword.required = false;

    openModal(modalWrite);
  }

  if (writeForm) {
    writeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isEditing = Boolean(editItemIdInput.value);
      const title = inputTitle.value.trim();
      const region = inputRegion.value;
      const rawUrl = inputUrl.value.trim();
      const desc = inputDesc.value.trim();
      const cleanUrl = Security.extractUrl(rawUrl);

      if (!Security.isValidNaverMapUrl(cleanUrl)) {
        showToast('올바른 네이버 지도 링크 형식을 입력해주세요.', 'error');
        return;
      }

      if (isEditing) {
        const listId = editItemIdInput.value;
        const ok = await store.updateList(listId, {
          title,
          region,
          description: desc,
          naverUrl: cleanUrl
        });

        if (ok) {
          showToast('성공적으로 수정되었습니다!', 'success');
          closeModal(modalWrite);
        } else {
          showToast('수정에 실패했습니다.', 'error');
        }
      } else {
        const password = inputPassword.value;
        if (password.length < 4) {
          showToast('비밀번호는 4자리 이상 입력해주세요.', 'error');
          return;
        }

        const passwordHash = await Security.hashPassword(password);
        await store.addList({
          title,
          region,
          description: desc,
          naverUrl: cleanUrl,
          passwordHash
        });

        showToast('새 맛집 리스트가 등록되었습니다! 🎉', 'success');
        closeModal(modalWrite);
      }
    });
  }

  function openAuthModal(listId, actionType) {
    authForm.reset();
    authTargetIdInput.value = listId;
    authActionTypeInput.value = actionType;

    if (actionType === 'edit') {
      authModalTitle.textContent = '게시글 수정 인증';
      authModalMessage.textContent = '글 등록 시 설정했던 비밀번호를 입력해주세요.';
    } else {
      authModalTitle.textContent = '게시글 삭제 확인';
      authModalMessage.textContent = '정말 삭제하시겠습니까? 등록 시 설정한 비밀번호를 입력해주세요.';
    }

    openModal(modalAuth);
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const listId = authTargetIdInput.value;
      const actionType = authActionTypeInput.value;
      const password = authPasswordInput.value;

      const item = allLists.find(l => l.id === listId);
      if (!item) {
        showToast('해당 게시글을 찾을 수 없습니다.', 'error');
        closeModal(modalAuth);
        return;
      }

      // 마스터 관리자 비밀번호 (861206) 또는 작성자 등록 비밀번호 확인
      const MASTER_PASSWORD = '861206';
      const isValid = (password === MASTER_PASSWORD) || 
                      (await Security.verifyPassword(password, item.passwordHash));

      if (!isValid) {
        showToast('비밀번호가 일치하지 않습니다. 다시 확인해주세요.', 'error');
        authPasswordInput.value = '';
        authPasswordInput.focus();
        return;
      }

      closeModal(modalAuth);

      if (actionType === 'edit') {
        openEditModal(item);
      } else if (actionType === 'delete') {
        const ok = await store.deleteList(listId);
        if (ok) {
          showToast('게시글이 삭제되었습니다.', 'success');
        } else {
          showToast('게시글 삭제에 실패했습니다.', 'error');
        }
      }
    });
  }

  function openCommentsModal(listId) {
    const item = allLists.find(l => l.id === listId);
    if (!item) return;

    commentTargetListId.value = listId;
    commentNicknameInput.value = NicknameGenerator.generate();
    commentContentInput.value = '';

    commentsDetailInfo.innerHTML = `
      <h4 style="font-size: 1.05rem; font-weight: 750; margin-bottom: 4px;">${escapeHtml(item.title)}</h4>
      <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(item.description)}</p>
    `;

    renderCommentsList(item.comments || []);
    openModal(modalComments);
  }

  function renderCommentsList(comments) {
    if (!commentsList) return;
    if (!comments || comments.length === 0) {
      commentsList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-sub); font-size: 0.88rem;">
          아직 등록된 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
        </div>
      `;
      return;
    }

    commentsList.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(c.nickname || '익명 미식가')}</span>
          <span class="comment-time">${formatRelativeTime(c.createdAt)}</span>
        </div>
        <p class="comment-text">${escapeHtml(c.content)}</p>
      </div>
    `).join('');

    commentsList.scrollTop = commentsList.scrollHeight;
  }

  if (btnRerollNickname) {
    btnRerollNickname.addEventListener('click', () => {
      commentNicknameInput.value = NicknameGenerator.generate();
    });
  }

  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const listId = commentTargetListId.value;
      const nickname = commentNicknameInput.value.trim();
      const content = commentContentInput.value.trim();

      if (!content) return;

      const added = await store.addComment(listId, { nickname, content });
      if (added) {
        commentContentInput.value = '';
        commentNicknameInput.value = NicknameGenerator.generate();
        showToast('댓글이 등록되었습니다! 💬', 'success');

        const updatedItem = allLists.find(l => l.id === listId);
        if (updatedItem) {
          renderCommentsList(updatedItem.comments || []);
        }
      } else {
        showToast('댓글 등록에 실패했습니다.', 'error');
      }
    });
  }

  if (btnOpenWrite) {
    btnOpenWrite.addEventListener('click', openCreateModal);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      renderLists();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderLists();
    });
  }

  if (regionTagsContainer) {
    regionTagsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-btn');
      if (!btn) return;

      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentRegionFilter = btn.getAttribute('data-region');
      renderLists();
    });
  }

  // 데이터 동기화 콜백
  function handleDataUpdate(lists) {
    allLists = lists;
    renderLists();

    // 열려있는 댓글 모달이 있다면 댓글 목록도 실시간 갱신
    if (modalComments && modalComments.classList.contains('active')) {
      const activeListId = commentTargetListId.value;
      const currentItem = allLists.find(l => l.id === activeListId);
      if (currentItem) {
        renderCommentsList(currentItem.comments || []);
      }
    }
  }

  async function initApp() {
    await store.init(handleDataUpdate);
    console.log('[Gourmet Road] 앱 초기화 완료');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
