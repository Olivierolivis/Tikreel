/* ============================================================
   TikReel — feed.js
   FeedManager owns the list of videos shown in a vertical feed:
   fetching from Pexels, mixing in local uploads, deduping,
   preferring portrait clips, light re-ranking, and lazy-loading
   more as the user nears the end.
   ============================================================ */

class FeedManager {
  /**
   * @param {Object} opts
   * @param {'home'|'search'|'category'} opts.mode
   * @param {string} [opts.query] search term, used when mode === 'search'
   * @param {string} [opts.category] category key, used when mode === 'category'
   */
  constructor(opts = {}) {
    this.mode = opts.mode || 'home';
    this.query = opts.query || '';
    this.category = opts.category || '';
    this.page = 1;
    this.videos = [];
    this.seenIds = new Set();
    this.exhausted = false;
    this.loading = false;
  }

  async _fetchPage() {
    if (this.mode === 'search') return Api.searchVideos(this.query, this.page, 8);
    if (this.mode === 'category') return Api.getVideosByCategory(this.category, this.page, 8);
    return Api.getMoreVideos(this.page, 8);
  }

  async _localVideos() {
    try {
      const local = await VideoDB.getVideos();
      return local.filter(v => v.privacy !== 'private').map(v => ({
        id: v.id,
        url: v.objectUrl,
        poster: v.thumbnail || null,
        portrait: true,
        creator: Store.getProfile().username,
        creatorDisplay: Store.getProfile().displayName,
        description: v.description || 'My new video',
        tags: v.tags || [],
        isLocal: true,
        privacy: v.privacy,
        commentsOn: v.commentsOn,
      }));
    } catch (e) {
      return [];
    }
  }

  _dedupe(list) {
    return list.filter(v => {
      if (this.seenIds.has(v.id)) return false;
      this.seenIds.add(v.id);
      return true;
    });
  }

  /** Prefer portrait videos first, keep everything else after. */
  _rankPortraitFirst(list) {
    const portrait = list.filter(v => v.portrait);
    const other = list.filter(v => !v.portrait);
    return [...portrait, ...other];
  }

  /** Light shuffle so repeated loads don't feel identical, without destroying relevance. */
  _lightShuffle(list) {
    return list
      .map(v => ({ v, k: Math.random() }))
      .sort((a, b) => a.k - b.k)
      .map(x => x.v);
  }

  async loadInitial() {
    this.loading = true;
    let fetched = [];
    try {
      fetched = await this._fetchPage();
    } catch (err) {
      this.loading = false;
      throw err;
    }
    fetched = this._dedupe(fetched);
    fetched = this._rankPortraitFirst(fetched);

    let combined = fetched;
    if (this.mode === 'home') {
      const local = this._dedupe(await this._localVideos());
      // Local uploads surface first (own content), Pexels results shuffled after.
      combined = [...local, ...this._lightShuffle(fetched)];
    }

    this.videos = combined;
    this.page += 1;
    this.loading = false;
    return this.videos;
  }

  async loadMore() {
    if (this.loading || this.exhausted) return [];
    this.loading = true;
    let fetched = [];
    try {
      fetched = await this._fetchPage();
    } catch (err) {
      this.loading = false;
      throw err;
    }
    fetched = this._dedupe(fetched);
    fetched = this._rankPortraitFirst(fetched);
    if (fetched.length === 0) this.exhausted = true;
    this.videos.push(...fetched);
    this.page += 1;
    this.loading = false;
    return fetched;
  }

  /** Call when the user scrolls near the end of the currently rendered feed. */
  shouldLoadMore(currentIndex) {
    return currentIndex >= this.videos.length - 3 && !this.loading && !this.exhausted;
  }
}

/* ── Local ranking algorithm for the Trending page ──────────
   score = views*1 + likes*3 + comments*4 + saves*5
   Applied to whatever engagement TikReel has recorded locally. */
function computeTrendingScore(meta) {
  const { views = 0, likes = 0, comments = 0, saves = 0 } = meta;
  return views * 1 + likes * 3 + comments * 4 + saves * 5;
}
