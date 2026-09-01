/* ============================================================
   TikReel — storage.js
   All local persistence lives here: localStorage for small bits
   of state (likes, follows, saves, comments, profile, settings,
   notifications, messages, search history) and IndexedDB for
   large binary data (locally uploaded video files).
   ============================================================ */

const LS_KEYS = {
  PROFILE: 'tikreel_profile',
  LIKES: 'tikreel_likes',           // { videoId: true }
  SAVES: 'tikreel_saves',           // { videoId: true }
  FOLLOWS: 'tikreel_follows',       // { creatorId: true }
  COMMENTS: 'tikreel_comments',     // { videoId: [ {id, username, text, createdAt, likes} ] }
  COMMENT_LIKES: 'tikreel_comment_likes', // { commentId: true }
  VIDEO_META: 'tikreel_video_meta', // { videoId: {views, likes, comments, saves, creator, desc, tags, portrait, image, url, isLocal} }
  NOTIFICATIONS: 'tikreel_notifications', // [ {id, text, icon, createdAt, read} ]
  MESSAGES: 'tikreel_messages',     // { threadId: {name, avatar, messages:[{from, text, at}]} }
  SETTINGS: 'tikreel_settings',     // {theme, autoplay, dataSaver, sound, }
  SEARCH_HISTORY: 'tikreel_search_history', // [ "cars", "travel" ]
  SAVE_SNAPSHOTS: 'tikreel_save_snapshots', // { videoId: {poster, creator, description, url} }
  WATCHED: 'tikreel_watched',       // { videoId: true } — session-ish, but persisted
  API_CACHE: 'tikreel_api_cache',   // { cacheKey: {ts, data} }
};

const Store = {
  /* ---------- generic helpers ---------- */
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Store read failed for', key, e);
      return fallback;
    }
  },
  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Store write failed (quota?) for', key, e);
    }
  },

  /* ---------- profile ---------- */
  getProfile() {
    return this._get(LS_KEYS.PROFILE, {
      username: 'guest_' + Math.floor(Math.random() * 9000 + 1000),
      displayName: 'Guest Creator',
      avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=tikreel-guest',
      bio: 'New to TikReel ✨',
      followers: 128,
      following: 12,
      createdAt: Date.now(),
    });
  },
  saveProfile(p) {
    this._set(LS_KEYS.PROFILE, p);
  },

  /* ---------- likes ---------- */
  getLikes() { return this._get(LS_KEYS.LIKES, {}); },
  isLiked(id) { return !!this.getLikes()[id]; },
  toggleLike(id) {
    const likes = this.getLikes();
    const wasLiked = !!likes[id];
    if (wasLiked) delete likes[id]; else likes[id] = true;
    this._set(LS_KEYS.LIKES, likes);
    return !wasLiked;
  },

  /* ---------- saves ---------- */
  getSaves() { return this._get(LS_KEYS.SAVES, {}); },
  isSaved(id) { return !!this.getSaves()[id]; },
  toggleSave(id, snapshot) {
    const saves = this.getSaves();
    const wasSaved = !!saves[id];
    if (wasSaved) {
      delete saves[id];
    } else {
      saves[id] = true;
      if (snapshot) {
        const snaps = this._get(LS_KEYS.SAVE_SNAPSHOTS, {});
        snaps[id] = snapshot;
        this._set(LS_KEYS.SAVE_SNAPSHOTS, snaps);
      }
    }
    this._set(LS_KEYS.SAVES, saves);
    return !wasSaved;
  },
  getSaveSnapshot(id) {
    return this._get(LS_KEYS.SAVE_SNAPSHOTS, {})[id];
  },

  /* ---------- follows ---------- */
  getFollows() { return this._get(LS_KEYS.FOLLOWS, {}); },
  isFollowing(creator) { return !!this.getFollows()[creator]; },
  toggleFollow(creator) {
    const follows = this.getFollows();
    const wasFollowing = !!follows[creator];
    if (wasFollowing) delete follows[creator]; else follows[creator] = true;
    this._set(LS_KEYS.FOLLOWS, follows);
    return !wasFollowing;
  },

  /* ---------- comments ---------- */
  getComments(videoId) {
    const all = this._get(LS_KEYS.COMMENTS, {});
    return all[videoId] || [];
  },
  addComment(videoId, text) {
    const all = this._get(LS_KEYS.COMMENTS, {});
    const profile = this.getProfile();
    if (!all[videoId]) all[videoId] = [];
    const comment = {
      id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      username: profile.username,
      avatar: profile.avatar,
      text,
      createdAt: Date.now(),
      likes: 0,
      mine: true,
    };
    all[videoId].unshift(comment);
    this._set(LS_KEYS.COMMENTS, all);
    this.bumpVideoMeta(videoId, { comments: 1 });
    return comment;
  },
  deleteComment(videoId, commentId) {
    const all = this._get(LS_KEYS.COMMENTS, {});
    if (!all[videoId]) return;
    all[videoId] = all[videoId].filter(c => c.id !== commentId);
    this._set(LS_KEYS.COMMENTS, all);
    this.bumpVideoMeta(videoId, { comments: -1 });
  },
  toggleCommentLike(commentId, videoId) {
    const likedMap = this._get(LS_KEYS.COMMENT_LIKES, {});
    const all = this._get(LS_KEYS.COMMENTS, {});
    const list = all[videoId] || [];
    const c = list.find(x => x.id === commentId);
    if (!c) return;
    if (likedMap[commentId]) {
      delete likedMap[commentId];
      c.likes = Math.max(0, (c.likes || 0) - 1);
    } else {
      likedMap[commentId] = true;
      c.likes = (c.likes || 0) + 1;
    }
    this._set(LS_KEYS.COMMENT_LIKES, likedMap);
    this._set(LS_KEYS.COMMENTS, all);
    return !!likedMap[commentId];
  },
  isCommentLiked(commentId) {
    return !!this._get(LS_KEYS.COMMENT_LIKES, {})[commentId];
  },

  /* ---------- video meta (local engagement counters, ranking data) ---------- */
  getAllVideoMeta() { return this._get(LS_KEYS.VIDEO_META, {}); },
  getVideoMeta(id) {
    const all = this.getAllVideoMeta();
    return all[id] || { views: 0, likes: 0, comments: 0, saves: 0 };
  },
  setVideoMeta(id, meta) {
    const all = this.getAllVideoMeta();
    all[id] = { ...(all[id] || {}), ...meta };
    this._set(LS_KEYS.VIDEO_META, all);
  },
  bumpVideoMeta(id, deltas) {
    const all = this.getAllVideoMeta();
    const cur = all[id] || { views: 0, likes: 0, comments: 0, saves: 0 };
    Object.keys(deltas).forEach(k => {
      cur[k] = Math.max(0, (cur[k] || 0) + deltas[k]);
    });
    all[id] = cur;
    this._set(LS_KEYS.VIDEO_META, all);
  },

  /* ---------- watched tracking (avoid repeats) ---------- */
  getWatched() { return this._get(LS_KEYS.WATCHED, {}); },
  markWatched(id) {
    const w = this.getWatched();
    w[id] = Date.now();
    this._set(LS_KEYS.WATCHED, w);
  },

  /* ---------- notifications ---------- */
  getNotifications() { return this._get(LS_KEYS.NOTIFICATIONS, []); },
  addNotification(text, icon) {
    const list = this.getNotifications();
    list.unshift({ id: 'n_' + Date.now(), text, icon: icon || 'bell', createdAt: Date.now(), read: false });
    this._set(LS_KEYS.NOTIFICATIONS, list.slice(0, 60));
  },
  unreadCount() {
    return this.getNotifications().filter(n => !n.read).length;
  },
  markAllNotificationsRead() {
    const list = this.getNotifications().map(n => ({ ...n, read: true }));
    this._set(LS_KEYS.NOTIFICATIONS, list);
  },

  /* ---------- messages (demo local threads) ---------- */
  getMessages() {
    const existing = this._get(LS_KEYS.MESSAGES, null);
    if (existing) return existing;
    const seed = {
      'aria_moon': {
        name: 'Aria Moon', avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=aria_moon',
        messages: [
          { from: 'them', text: 'Hey! Loved your latest video 🔥', at: Date.now() - 3600_000 },
          { from: 'them', text: 'What camera do you use?', at: Date.now() - 3500_000 },
        ]
      },
      'kai_travels': {
        name: 'Kai Travels', avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=kai_travels',
        messages: [
          { from: 'them', text: 'Welcome to TikReel 👋', at: Date.now() - 86400_000 },
        ]
      },
    };
    this._set(LS_KEYS.MESSAGES, seed);
    return seed;
  },
  sendMessage(threadId, text) {
    const all = this.getMessages();
    if (!all[threadId]) return;
    all[threadId].messages.push({ from: 'me', text, at: Date.now() });
    this._set(LS_KEYS.MESSAGES, all);
  },

  /* ---------- settings ---------- */
  getSettings() {
    return this._get(LS_KEYS.SETTINGS, {
      theme: 'dark',
      autoplay: true,
      dataSaver: false,
      soundOn: false,
    });
  },
  saveSettings(s) { this._set(LS_KEYS.SETTINGS, s); },

  /* ---------- search history ---------- */
  getSearchHistory() { return this._get(LS_KEYS.SEARCH_HISTORY, []); },
  addSearchHistory(term) {
    let list = this.getSearchHistory().filter(t => t.toLowerCase() !== term.toLowerCase());
    list.unshift(term);
    this._set(LS_KEYS.SEARCH_HISTORY, list.slice(0, 12));
  },
  clearSearchHistory() { this._set(LS_KEYS.SEARCH_HISTORY, []); },

  /* ---------- API result cache (short-lived, avoids refetching) ---------- */
  getCache(key) {
    const cache = this._get(LS_KEYS.API_CACHE, {});
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > 1000 * 60 * 20) return null; // 20 min TTL
    return entry.data;
  },
  setCache(key, data) {
    const cache = this._get(LS_KEYS.API_CACHE, {});
    cache[key] = { ts: Date.now(), data };
    // keep cache from growing unbounded
    const keys = Object.keys(cache);
    if (keys.length > 40) delete cache[keys[0]];
    this._set(LS_KEYS.API_CACHE, cache);
  },

  /* ---------- wipe everything ---------- */
  clearAll() {
    Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
  },
};

/* ============================================================
   IndexedDB wrapper for locally-uploaded video blobs.
   Large binary data does NOT belong in localStorage (5-10MB
   quota, synchronous API) — IndexedDB handles blobs natively
   and scales far better.
   ============================================================ */
const VideoDB = (() => {
  const DB_NAME = 'tikreel_db';
  const STORE = 'videos';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  return {
    /** Save a locally-created video record. `blob` is the raw File/Blob. */
    async saveVideo(record) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
      });
    },
    async getVideos() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
        req.onerror = () => reject(req.error);
      });
    },
    async deleteVideo(id) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    },
  };
})();
