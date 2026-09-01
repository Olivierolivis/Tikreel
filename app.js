/* ============================================================
   TikReel — app.js
   Controller for the home vertical feed (index.html). Handles
   initial load, infinite scroll pagination, loading/error UI,
   and registering each card with the shared IntersectionObserver.
   ============================================================ */

const HomeApp = {
  feedManager: null,
  container: null,

  async init() {
    this.container = document.getElementById('feed-container');

    const params = new URLSearchParams(location.search);
    const search = params.get('search');
    const category = params.get('category');
    if (search) {
      this.feedManager = new FeedManager({ mode: 'search', query: search });
      Store.addSearchHistory(search);
    } else if (category) {
      this.feedManager = new FeedManager({ mode: 'category', category });
    } else {
      this.feedManager = new FeedManager({ mode: 'home' });
    }
    Player.initObserver();

    if (search || category) {
      const bar = document.getElementById('context-bar');
      bar.classList.remove('hidden');
      bar.classList.add('flex');
      document.getElementById('context-bar-label').textContent = search ? `"${search}"` : `#${category}`;
    }

    this._showLoading();
    try {
      const videos = await this.feedManager.loadInitial();
      this._clearLoading();
      if (videos.length === 0) {
        this._showEmpty();
        return;
      }
      videos.forEach((v, i) => this._appendCard(v, i));
      this._wireScrollPagination();
      // Kick off playback for the first card once it's in the DOM.
      requestAnimationFrame(() => {
        const first = this.container.querySelector('.video-card video');
        if (first) Player.playOnly(first);
      });
    } catch (err) {
      this._clearLoading();
      this._showError(err);
    }
  },

  _appendCard(video, index) {
    const card = Player.createCard(video, index);
    this.container.appendChild(card);
    Player.observe(card);
  },

  _wireScrollPagination() {
    let ticking = false;
    this.container.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(async () => {
        const cards = this.container.querySelectorAll('.video-card');
        const cardHeight = this.container.clientHeight;
        const currentIndex = Math.round(this.container.scrollTop / cardHeight);
        if (this.feedManager.shouldLoadMore(currentIndex)) {
          try {
            const more = await this.feedManager.loadMore();
            more.forEach((v, i) => this._appendCard(v, cards.length + i));
          } catch (e) {
            // Silent — pagination failures shouldn't interrupt viewing.
          }
        }
        ticking = false;
      });
    }, { passive: true });
  },

  _showLoading() {
    this.container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.id = 'feed-loading';
    wrap.className = 'w-full h-full flex flex-col items-center justify-center gap-3 text-white/70 snap-start';
    wrap.innerHTML = `
      <div class="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#FF1744] animate-spin"></div>
      <p class="text-sm font-medium">Loading videos...</p>
    `;
    this.container.appendChild(wrap);
  },
  _clearLoading() {
    document.getElementById('feed-loading')?.remove();
  },
  _showEmpty() {
    this.container.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center gap-3 text-white/70 snap-start px-8 text-center">
        <i data-lucide="video-off" class="w-10 h-10"></i>
        <p class="font-semibold">No videos found</p>
        <p class="text-sm text-white/50">Try again in a moment.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
  },
  _showError(err) {
    const msg = err?.message === 'MISSING_KEY'
      ? 'Add your Pexels API key in js/api.js to load videos.'
      : 'Unable to load videos. Try again.';
    this.container.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center gap-3 text-white/70 snap-start px-8 text-center">
        <i data-lucide="wifi-off" class="w-10 h-10"></i>
        <p class="font-semibold">${msg}</p>
        <button id="retry-feed-btn" class="mt-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#FF1744] to-[#FF6D00] text-white text-sm font-semibold">Retry</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    document.getElementById('retry-feed-btn')?.addEventListener('click', () => this.init());
  },
};

document.addEventListener('DOMContentLoaded', () => {
  UI.init('index.html');
  HomeApp.init();
});
