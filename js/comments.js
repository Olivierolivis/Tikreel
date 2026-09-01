/* ============================================================
   TikReel — comments.js
   Mobile-friendly bottom sheet for viewing/adding/deleting
   comments on a video. Comments persist in localStorage.
   ============================================================ */

const Comments = {
  currentVideo: null,
  currentCard: null,

  open(video, card) {
    this.currentVideo = video;
    this.currentCard = card;
    const sheet = document.getElementById('comments-sheet');
    const backdrop = document.getElementById('comments-backdrop');
    sheet.classList.remove('translate-y-full');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    this.render();
  },

  close() {
    const sheet = document.getElementById('comments-sheet');
    const backdrop = document.getElementById('comments-backdrop');
    sheet.classList.add('translate-y-full');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
  },

  render() {
    if (!this.currentVideo) return;
    const list = Store.getComments(this.currentVideo.id);
    const countEl = document.getElementById('comments-count');
    const listEl = document.getElementById('comments-list');
    countEl.textContent = `${list.length} comment${list.length === 1 ? '' : ''}`;

    if (list.length === 0) {
      listEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-white/50 gap-2">
          <i data-lucide="message-circle" class="w-10 h-10"></i>
          <p class="text-sm">No comments yet — say something first.</p>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [listEl] });
      return;
    }

    listEl.innerHTML = list.map(c => `
      <div class="flex gap-3 py-3 border-b border-white/5" data-comment-id="${c.id}">
        <img src="${c.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(c.username)}`}" class="w-9 h-9 rounded-full object-cover flex-shrink-0">
        <div class="flex-1 min-w-0">
          <p class="text-xs text-white/50 mb-0.5">@${c.username} · ${timeAgo(c.createdAt)}</p>
          <p class="text-sm text-white/90 break-words">${escapeHtml(c.text)}</p>
          <div class="flex items-center gap-4 mt-1.5">
            <button class="comment-like-btn flex items-center gap-1 text-xs text-white/50" data-id="${c.id}">
              <i data-lucide="heart" class="w-3.5 h-3.5 ${Store.isCommentLiked(c.id) ? 'fill-[#FF1744] text-[#FF1744]' : ''}"></i>
              <span>${c.likes || 0}</span>
            </button>
            <button class="comment-reply-btn text-xs text-white/50" data-username="${c.username}">Reply</button>
            ${c.mine ? `<button class="comment-delete-btn text-xs text-[#FF1744]/80" data-id="${c.id}">Delete</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons({ nodes: [listEl] });

    listEl.querySelectorAll('.comment-like-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nowLiked = Store.toggleCommentLike(btn.dataset.id, this.currentVideo.id);
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');
        icon.setAttribute('class', `w-3.5 h-3.5 ${nowLiked ? 'fill-[#FF1744] text-[#FF1744]' : ''}`);
        span.textContent = Store.getComments(this.currentVideo.id).find(c => c.id === btn.dataset.id)?.likes || 0;
      });
    });
    listEl.querySelectorAll('.comment-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.deleteComment(this.currentVideo.id, btn.dataset.id);
        this.render();
        this._syncCountOnCard();
      });
    });
    listEl.querySelectorAll('.comment-reply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('comment-input');
        input.value = `@${btn.dataset.username} `;
        input.focus();
      });
    });
  },

  submit() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text || !this.currentVideo) return;
    Store.addComment(this.currentVideo.id, text);
    input.value = '';
    this.render();
    this._syncCountOnCard();
    Store.addNotification('Your comment was posted', 'message-circle');
  },

  _syncCountOnCard() {
    if (!this.currentCard || !this.currentVideo) return;
    const countEl = this.currentCard.querySelector('.comment-count');
    if (!countEl) return;
    const base = this.currentVideo.baseComments || 0;
    countEl.textContent = formatCount(Store.getComments(this.currentVideo.id).length + base);
  },
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
