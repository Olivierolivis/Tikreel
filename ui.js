/* ============================================================
   TikReel — ui.js
   Shared chrome: sidebar/bottom nav, toasts, share modal,
   theme toggle. Injected into every page for consistency.
   ============================================================ */

const NAV_ITEMS = [
  { href: 'index.html', icon: 'house', label: 'Home' },
  { href: 'trending.html', icon: 'flame', label: 'Trending' },
  { href: 'discover.html', icon: 'compass', label: 'Discover' },
  { href: 'create.html', icon: 'circle-plus', label: 'Create' },
  { href: 'messages.html', icon: 'send', label: 'Inbox' },
  { href: 'notifications.html', icon: 'bell', label: 'Notifications' },
  { href: 'saved.html', icon: 'bookmark', label: 'Saved' },
  { href: 'profile.html', icon: 'user', label: 'Profile' },
  { href: 'settings.html', icon: 'settings', label: 'Settings' },
];

const MOBILE_NAV_ITEMS = [
  { href: 'index.html', icon: 'house', label: 'Home' },
  { href: 'discover.html', icon: 'compass', label: 'Discover' },
  { href: 'create.html', icon: 'circle-plus', label: '' , isCreate: true},
  { href: 'messages.html', icon: 'send', label: 'Inbox' },
  { href: 'profile.html', icon: 'user', label: 'Profile' },
];

const UI = {
  currentPage: '',

  init(pageName) {
    this.currentPage = pageName;
    this._applyTheme();
    this._renderSidebar();
    this._renderMobileNav();
    this._renderShareModal();
    this._wireGlobalUI();
  },

  _applyTheme() {
    const settings = Store.getSettings();
    document.documentElement.classList.toggle('light', settings.theme === 'light');
  },

  toggleTheme() {
    const settings = Store.getSettings();
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    Store.saveSettings(settings);
    this._applyTheme();
  },

  _renderSidebar() {
    const el = document.getElementById('sidebar-nav');
    if (!el) return;
    const unread = Store.unreadCount();
    el.innerHTML = `
      <a href="index.html" class="flex items-center gap-2.5 px-3 mb-8 mt-1">
        <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF1744] to-[#FF6D00] flex items-center justify-center">
          <i data-lucide="play" class="w-5 h-5 text-white fill-white"></i>
        </span>
        <span class="text-xl font-black tracking-tight brand-text">TikReel</span>
      </a>
      <nav class="flex flex-col gap-1">
        ${NAV_ITEMS.map(item => `
          <a href="${item.href}" class="nav-link relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-medium text-[15px] transition-colors ${this.currentPage === item.href ? 'nav-active' : ''}">
            <i data-lucide="${item.icon}" class="w-5 h-5"></i>
            <span>${item.label}</span>
            ${item.label === 'Notifications' && unread > 0 ? `<span class="ml-auto bg-[#FF1744] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">${unread}</span>` : ''}
          </a>
        `).join('')}
      </nav>
      <button id="theme-toggle-sidebar" class="mt-auto mx-3 mb-2 flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-[15px] muted-surface">
        <i data-lucide="${Store.getSettings().theme === 'light' ? 'sun' : 'moon'}" class="w-5 h-5"></i>
        <span>${Store.getSettings().theme === 'light' ? 'Light mode' : 'Dark mode'}</span>
      </button>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [el] });
    document.getElementById('theme-toggle-sidebar')?.addEventListener('click', () => {
      this.toggleTheme();
      this._renderSidebar();
    });
  },

  _renderMobileNav() {
    const el = document.getElementById('mobile-nav');
    if (!el) return;
    el.innerHTML = MOBILE_NAV_ITEMS.map(item => {
      if (item.isCreate) {
        return `<a href="${item.href}" class="flex items-center justify-center -mt-4">
          <span class="w-12 h-9 rounded-xl bg-gradient-to-br from-[#FF1744] to-[#FF6D00] flex items-center justify-center shadow-lg shadow-[#FF1744]/30">
            <i data-lucide="plus" class="w-5 h-5 text-white"></i>
          </span>
        </a>`;
      }
      const active = this.currentPage === item.href;
      return `<a href="${item.href}" class="flex flex-col items-center gap-0.5 py-1 px-2 ${active ? 'text-[#FF1744]' : 'nav-mobile-inactive'}">
        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
        <span class="text-[10px] font-medium">${item.label}</span>
      </a>`;
    }).join('');
    if (window.lucide) lucide.createIcons({ nodes: [el] });
  },

  _renderShareModal() {
    if (document.getElementById('share-modal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div id="share-modal" class="fixed inset-0 z-[70] flex items-end md:items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200">
        <div id="share-backdrop" class="absolute inset-0 bg-black/60"></div>
        <div class="relative surface w-full md:w-96 md:rounded-2xl rounded-t-2xl p-5 pb-8 md:pb-5 z-10">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg">Share to</h3>
            <button id="share-close" class="p-1"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>
          <div class="grid grid-cols-4 gap-4 mb-4" id="share-options"></div>
          <button id="share-native" class="hidden w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF1744] to-[#FF6D00] text-white font-semibold text-sm mb-2">
            Use device share sheet
          </button>
          <div class="flex items-center gap-2 muted-surface rounded-xl px-3 py-2.5">
            <input id="share-link-input" readonly class="flex-1 bg-transparent text-sm outline-none truncate" value="">
            <button id="share-copy" class="text-xs font-semibold text-[#FF1744]">Copy</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);

    const options = [
      { key: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', url: (u, t) => `https://wa.me/?text=${encodeURIComponent(t + ' ' + u)}` },
      { key: 'facebook', label: 'Facebook', icon: 'facebook', url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
      { key: 'x', label: 'X', icon: 'twitter', url: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
      { key: 'telegram', label: 'Telegram', icon: 'send', url: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
    ];
    const optionsEl = document.getElementById('share-options');
    optionsEl.innerHTML = options.map(o => `
      <button class="share-option flex flex-col items-center gap-1.5" data-key="${o.key}">
        <span class="w-12 h-12 rounded-full muted-surface flex items-center justify-center"><i data-lucide="${o.icon}" class="w-5 h-5"></i></span>
        <span class="text-xs">${o.label}</span>
      </button>
    `).join('');
    if (window.lucide) lucide.createIcons({ nodes: optionsEl ? [optionsEl] : [] });

    document.getElementById('share-close').addEventListener('click', () => this.closeShareModal());
    document.getElementById('share-backdrop').addEventListener('click', () => this.closeShareModal());
  },

  openShareModal(video) {
    const modal = document.getElementById('share-modal');
    const link = `${location.origin}${location.pathname}?video=${encodeURIComponent(video.id)}`;
    const text = `Check out this video on TikReel by @${video.creator}`;
    document.getElementById('share-link-input').value = link;

    const optionsEl = document.getElementById('share-options');
    optionsEl.querySelectorAll('.share-option').forEach(btn => {
      btn.onclick = () => {
        const cfg = { whatsapp: (u, t) => `https://wa.me/?text=${encodeURIComponent(t + ' ' + u)}`,
          facebook: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
          x: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`,
          telegram: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` }[btn.dataset.key];
        window.open(cfg(link, text), '_blank', 'noopener');
        Store.addNotification('You shared a video', 'share-2');
      };
    });

    const nativeBtn = document.getElementById('share-native');
    if (navigator.share) {
      nativeBtn.classList.remove('hidden');
      nativeBtn.onclick = () => navigator.share({ title: 'TikReel', text, url: link }).catch(() => {});
    } else {
      nativeBtn.classList.add('hidden');
    }

    document.getElementById('share-copy').onclick = () => {
      navigator.clipboard?.writeText(link).then(() => this.toast('Link copied'));
    };

    modal.classList.remove('opacity-0', 'pointer-events-none');
  },
  closeShareModal() {
    document.getElementById('share-modal')?.classList.add('opacity-0', 'pointer-events-none');
  },

  toast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 pointer-events-none';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast-item bg-[#0f0f0f] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-xl border border-white/10';
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));
    setTimeout(() => {
      el.classList.remove('toast-in');
      setTimeout(() => el.remove(), 250);
    }, 2200);
  },

  pulse(el) {
    el.classList.remove('pulse-anim');
    void el.offsetWidth;
    el.classList.add('pulse-anim');
  },

  skeletonCard() {
    const div = document.createElement('div');
    div.className = 'w-full h-full flex items-center justify-center bg-black snap-start';
    div.innerHTML = `<div class="phone-frame w-full h-full md:w-[420px] md:h-[92vh] md:rounded-[28px] overflow-hidden skeleton-shimmer"></div>`;
    return div;
  },

  _wireGlobalUI() {
    document.getElementById('comments-close')?.addEventListener('click', () => Comments.close());
    document.getElementById('comments-backdrop')?.addEventListener('click', () => Comments.close());
    document.getElementById('comment-send')?.addEventListener('click', () => Comments.submit());
    document.getElementById('comment-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') Comments.submit();
    });
  },
};
