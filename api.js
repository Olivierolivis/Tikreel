/* ============================================================
   TikReel — api.js
   All Pexels Video API integration lives here.
   ============================================================ */

// ── Configuration ──────────────────────────────────────────
// WARNING:
// Frontend API keys are publicly visible. Anyone can open dev
// tools, view this file, or inspect network requests and read
// this key. It is NOT secret once shipped in browser JS.
// For production, do not call Pexels directly from the client —
// proxy these requests through a small backend (or serverless
// function) that holds the real key server-side, applies rate
// limiting, and only returns the fields the client needs. The
// functions below are written so that swapping the base URL for
// your own backend endpoint later requires no other code changes.
const PEXELS_API_KEY = "YOUR_API_KEY_HERE";
const PEXELS_BASE = "https://api.pexels.com/videos";

const CATEGORY_QUERIES = {
  music: 'live music concert',
  comedy: 'funny people laughing',
  travel: 'travel adventure',
  food: 'cooking food',
  fashion: 'fashion model style',
  gaming: 'gaming setup neon',
  technology: 'technology gadgets',
  sports: 'sports action',
  nature: 'nature landscape',
  animals: 'cute animals',
  education: 'study learning',
};

const TRENDING_HASHTAGS = ['#Travel', '#Nature', '#Rwanda', '#Foodie', '#Fitness', '#Tech', '#Fashion', '#Music', '#Comedy', '#Sunset'];

const Api = {
  _headers() {
    return { Authorization: PEXELS_API_KEY };
  },

  async _request(url, cacheKey) {
    if (cacheKey) {
      const cached = Store.getCache(cacheKey);
      if (cached) return cached;
    }
    if (!PEXELS_API_KEY || PEXELS_API_KEY === 'YOUR_API_KEY_HERE') {
      throw new Error('MISSING_KEY');
    }
    let res;
    try {
      res = await fetch(url, { headers: this._headers() });
    } catch (netErr) {
      throw new Error('NETWORK');
    }
    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (!res.ok) throw new Error('HTTP_' + res.status);
    const data = await res.json();
    if (cacheKey) Store.setCache(cacheKey, data);
    return data;
  },

  /** Normalize a raw Pexels video object into TikReel's internal shape. */
  _normalize(v) {
    // Prefer a portrait (h > w) video file; fall back to the best available.
    const files = (v.video_files || []).slice().sort((a, b) => (b.height || 0) - (a.height || 0));
    const portraitFile = files.find(f => f.height > f.width && f.quality !== 'hls');
    const hdFile = files.find(f => f.quality === 'hd' && f.width <= 1080) || files[0];
    const file = portraitFile || hdFile || files[0];
    const isPortrait = file ? file.height > file.width : (v.height > v.width);
    return {
      id: 'pexels_' + v.id,
      sourceId: v.id,
      url: file ? file.link : null,
      poster: v.image,
      width: file?.width || v.width,
      height: file?.height || v.height,
      portrait: isPortrait,
      duration: v.duration,
      creator: (v.user?.name || 'Unknown Creator').replace(/\s+/g, '').toLowerCase(),
      creatorDisplay: v.user?.name || 'Unknown Creator',
      creatorUrl: v.user?.url,
      description: pickDescription(v),
      tags: pickTags(v),
      isLocal: false,
    };
  },

  async getPopularVideos(page = 1, perPage = 12) {
    const url = `${PEXELS_BASE}/popular?min_width=480&per_page=${perPage}&page=${page}`;
    const data = await this._request(url, `popular_${page}_${perPage}`);
    return (data.videos || []).map(this._normalize);
  },

  async searchVideos(query, page = 1, perPage = 12) {
    const url = `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}&page=${page}`;
    const data = await this._request(url, `search_${query}_${page}_${perPage}`);
    return (data.videos || []).map(this._normalize);
  },

  async getVideosByCategory(category, page = 1, perPage = 12) {
    const query = CATEGORY_QUERIES[category] || category;
    return this.searchVideos(query, page, perPage);
  },

  /** Generic "get more" used by the feed to page through popular videos. */
  async getMoreVideos(page, perPage = 8) {
    return this.getPopularVideos(page, perPage);
  },

  async getTrendingHashtags() {
    return TRENDING_HASHTAGS;
  },
};

function pickDescription(v) {
  const descs = [
    'Golden hour never disappoints 🌅',
    'Just another day, another vibe ✨',
    'Chasing moments worth remembering 🎬',
    'This view though 😍',
    'Nothing but good energy today 🔥',
    'Slow down and watch this 🎥',
    'Can we talk about this for a sec?',
    'Found this and had to share 💫',
    'POV: you needed this today',
    'Save this for later 🔖',
  ];
  return descs[v.id % descs.length];
}

function pickTags(v) {
  const pool = ['fyp', 'viral', 'trending', 'travel', 'nature', 'aesthetic', 'mood', 'sunset', 'life', 'explore', 'reels', 'rwanda'];
  const shuffled = pool.slice().sort(() => (v.id % 7) - 3);
  return shuffled.slice(0, 3).map(t => '#' + t);
}
