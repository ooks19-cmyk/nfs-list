/**
 * store.js - Firestore & LocalStorage 하이브리드 데이터 스토리지 레이어
 * Firebase 키가 있으면 Firestore에 실시간 동기화하고, 없으면 로컬 스토리지 데모 모드로 작동합니다.
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const STORAGE_KEY_LISTS = 'gourmet_map_lists_v1';
const STORAGE_KEY_LIKES = 'gourmet_map_user_likes_v1';

// 초기 샘플 맛집 리스트 데이터
const INITIAL_DEMO_DATA = [
  {
    id: 'demo-1',
    title: '구미 현지인 찐맛집 & 노포 총정리',
    region: '구미',
    description: '구미 토박이가 엄선한 선산곱창, 국밥, 직화불고기 인생 맛집 지도 모음입니다!',
    naverUrl: 'https://naver.me/xJcslhFt',
    passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty default
    likesCount: 24,
    comments: [
      { id: 'c-1', nickname: '얼큰한 국밥러버 #812', content: '구미 가면 선산곱창은 진짜 필수코스죠! 잘 저장해둡니다 ㅎㅎ', createdAt: Date.now() - 3600000 * 24 },
      { id: 'c-2', nickname: '바삭한 미식가 #309', content: '리스트 깔끔하게 잘 정리되어 있네요. 주말에 구미 드라이브 갈 때 참고할게요!', createdAt: Date.now() - 3600000 * 5 }
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
    passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
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
    passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
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
    this.firestoreModule = null;
    this.userLikes = new Set(this.loadUserLikesFromStorage());
  }

  /**
   * 스토어 초기화 (Firebase 연결 시도 및 fallback 설정)
   */
  async init() {
    if (isFirebaseConfigured()) {
      try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
        const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        
        const app = initializeApp(firebaseConfig);
        this.db = firestoreModule.getFirestore(app);
        this.firestoreModule = firestoreModule;
        this.isFirebase = true;
        console.log('[Gourmet Store] Firebase Firestore 연결 성공');
      } catch (err) {
        console.warn('[Gourmet Store] Firebase 연결 실패, LocalStorage 모드로 실행합니다:', err);
        this.isFirebase = false;
      }
    } else {
      console.log('[Gourmet Store] Firebase 미설정 상태 - LocalStorage 모드로 작동합니다.');
      this.isFirebase = false;
    }

    // 로컬 스토리지 초기화 (비어있는 경우 데모 데이터 삽입)
    if (!this.isFirebase) {
      const existing = localStorage.getItem(STORAGE_KEY_LISTS);
      if (!existing) {
        localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(INITIAL_DEMO_DATA));
      }
    }
  }

  // ================= LocalStorage 좋아요 관리 =================
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

  // ================= 전체 리스트 가져오기 =================
  async getLists() {
    if (this.isFirebase) {
      try {
        const { collection, getDocs, query, orderBy } = this.firestoreModule;
        const q = query(collection(this.db, 'gourmet_lists'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          // Firestore가 완전히 비어있을 경우 데모 데이터 1회 마이그레이션
          return INITIAL_DEMO_DATA;
        }

        const lists = [];
        snapshot.forEach(doc => {
          lists.push({ id: doc.id, ...doc.data() });
        });
        return lists;
      } catch (err) {
        console.error('Firestore 데이터 조회 오류, LocalStorage로 대체:', err);
        return this.getLocalLists();
      }
    } else {
      return this.getLocalLists();
    }
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
  }

  // ================= 새 리스트 등록 =================
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

    if (this.isFirebase) {
      try {
        const { collection, addDoc } = this.firestoreModule;
        const docRef = await addDoc(collection(this.db, 'gourmet_lists'), newItem);
        return { id: docRef.id, ...newItem };
      } catch (err) {
        console.error('Firestore 등록 실패, 로컬에 저장:', err);
      }
    }

    const lists = this.getLocalLists();
    const localItem = { id: 'list-' + Date.now(), ...newItem };
    lists.unshift(localItem);
    this.saveLocalLists(lists);
    return localItem;
  }

  // ================= 리스트 수정 =================
  async updateList(id, updateData) {
    const updatedPayload = {
      title: updateData.title.trim(),
      region: updateData.region ? updateData.region.trim() : '전국',
      description: updateData.description.trim(),
      naverUrl: updateData.naverUrl.trim(),
      updatedAt: Date.now()
    };

    if (this.isFirebase) {
      try {
        const { doc, updateDoc } = this.firestoreModule;
        const docRef = doc(this.db, 'gourmet_lists', id);
        await updateDoc(docRef, updatedPayload);
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

  // ================= 리스트 삭제 =================
  async deleteList(id) {
    if (this.isFirebase) {
      try {
        const { doc, deleteDoc } = this.firestoreModule;
        await deleteDoc(doc(this.db, 'gourmet_lists', id));
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

  // ================= 좋아요 토글 =================
  async toggleLike(id) {
    const isLiked = this.userLikes.has(id);
    const delta = isLiked ? -1 : 1;

    if (isLiked) {
      this.userLikes.delete(id);
    } else {
      this.userLikes.add(id);
    }
    this.saveUserLikesToStorage();

    if (this.isFirebase) {
      try {
        const { doc, updateDoc, increment } = this.firestoreModule;
        const docRef = doc(this.db, 'gourmet_lists', id);
        await updateDoc(docRef, {
          likesCount: increment(delta)
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

  // ================= 댓글 추가 =================
  async addComment(listId, { nickname, content, passwordHash }) {
    const newComment = {
      id: 'cmt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nickname: nickname.trim(),
      content: content.trim(),
      passwordHash: passwordHash || '',
      createdAt: Date.now()
    };

    if (this.isFirebase) {
      try {
        const { doc, updateDoc, arrayUnion } = this.firestoreModule;
        const docRef = doc(this.db, 'gourmet_lists', listId);
        await updateDoc(docRef, {
          comments: arrayUnion(newComment)
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

  // ================= 댓글 삭제 =================
  async deleteComment(listId, commentId) {
    if (this.isFirebase) {
      try {
        const { doc, getDoc, updateDoc } = this.firestoreModule;
        const docRef = doc(this.db, 'gourmet_lists', listId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const filteredComments = (data.comments || []).filter(c => c.id !== commentId);
          await updateDoc(docRef, { comments: filteredComments });
          return true;
        }
      } catch (err) {
        console.error('Firestore 댓글 삭제 실패:', err);
      }
    }

    const lists = this.getLocalLists();
    const item = lists.find(item => item.id === listId);
    if (item && item.comments) {
      item.comments = item.comments.filter(c => c.id !== commentId);
      this.saveLocalLists(lists);
      return true;
    }
    return false;
  }
}

export const store = new StoreManager();
