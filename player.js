/* ============================================================
   TikReel — player.js
   Builds each video "card" in the vertical feed and wires up
   playback, controls, gestures, and the IntersectionObserver
   that keeps exactly one video playing at a time.
   ============================================================ */

const Player = {
  observer: null,
  activeVideoEl: null,
  hideControlsTimer: null,

  /** Create the observer once per page. */
  initObserver(onVisible) {
    if (this.observer) this.observer.disconnect();
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const videoEl = entry.target.querySelector('video');
        if (!videoEl) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          this.playOnly(videoEl);
          onVisible && onVisible(entry.target);
        } else {
          videoEl.pause();
          entry.target.classList.remove('is-playing');
        }
      });
    }, { threshold: [0, 0.6, 1] });
  },

  observe(cardEl) {
    if (this.observer) this.observer.observe(cardEl);
  },

  /** Pause every other video, play this one (respecting the global sound setting). */
  playOnly(videoEl) {
    document.querySelectorAll('video[data-tikreel]').forEach(v => {
      if (v !== videoEl) v.pause();
    });
    const settings = Store.getSettings();
    videoEl.muted = !settings.soundOn;
    if (settings.autoplay) {
      const p = videoEl.play();
      if (p && p.catch) p.catch(() => { /* autoplay may be blocked until user gesture */ });
    }
    videoEl.closest('.video-card')?.classList.add('is-playing');
    this.activeVideoEl = videoEl;
  },

  /**
   * Build a full video card: <video>, gradient overlay, info, right-rail
   * actions, progress bar, and gesture handlers. Returns the card element.
   */
  createCard(video, index) {
    const meta = Store.getVideoMeta(video.id);
    const liked = Store.isLiked(video.id);
    const saved = Store.isSaved(video.id);
    const following = Store.isFollowing(video.creator);
    const likeCount = (meta.likes || 0) + (liked ? 1 : 0) + (video.baseLikes || 0);
    const commentCount = Store.getComments(video.id).length + (video.baseComments || 0);

    const card = document.createElement('section');
    card.className = 'video-card relative w-full h-full snap-start flex items-center justify-center bg-black overflow-hidden';
    card.dataset.videoId = video.id;

    card.innerHTML = `
      <div class="phone-frame relative w-full h-full md:w-[420px] md:h-[92vh] md:rounded-[28px] md:shadow-2xl md:shadow-black/60 overflow-hidden bg-black">
        <video
          data-tikreel
          class="w-full h-full object-cover"
          src="${video.url || ''}"
          poster="${video.poster || ''}"
          loop
          muted
          playsinline
          preload="${index < 2 ? 'auto' : 'none'}"
        ></video>

        <div class="tap-layer absolute inset-0 z-10"></div>
        <div class="heart-burst-container absolute inset-0 z-20 pointer-events-none"></div>

        <!-- top gradient (readability for header if any) -->
        <div class="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none"></div>

        <!-- bottom gradient -->
        <div class="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"></div>

        <!-- controls (progress, mute, fullscreen) -->
        <div class="video-controls absolute inset-x-0 bottom-0 z-30 px-3 pb-3 transition-opacity duration-300">
          <div class="progress-track relative h-1 rounded-full bg-white/25 mb-3 cursor-pointer">
            <div class="progress-fill absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#FF1744] to-[#FF6D00]" style="width:0%"></div>
          </div>
        </div>

        <!-- play/pause center icon (shown briefly on toggle) -->
        <button class="center-play-btn absolute inset-0 z-20 flex items-center justify-center opacity-0 pointer-events-none">
          <span class="bg-black/40 rounded-full p-5"><i data-lucide="play" class="w-10 h-10 text-white"></i></span>
        </button>

        <!-- mute button -->
        <button class="mute-btn absolute top-4 right-4 z-30 bg-black/40 backdrop-blur rounded-full p-2 text-white active:scale-90 transition">
          <i data-lucide="volume-x" class="w-4 h-4"></i>
        </button>

        <!-- fullscreen button -->
        <button class="fullscreen-btn absolute top-4 left-4 z-30 bg-black/40 backdrop-blur rounded-full p-2 text-white active:scale-90 transition md:flex hidden">
          <i data-lucide="maximize" class="w-4 h-4"></i>
        </button>

        <!-- bottom-left info -->
        <div class="absolute left-3 right-20 bottom-5 z-30 text-white">
          <button class="creator-link flex items-center gap-2 mb-2">
            <img src="https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(video.creator)}" class="w-9 h-9 rounded-full ring-2 ring-white/70 object-cover" alt="">
            <span class="font-semibold text-sm">@${video.creator}</span>
          </button>
          <p class="text-sm leading-snug mb-1.5 line-clamp-2">${video.description || ''}</p>
          <p class="text-xs text-white/80 mb-1.5">${(video.tags || []).join(' ')}</p>
          <div class="flex items-center gap-1.5 text-xs text-white/85">
            <i data-lucide="music" class="w-3.5 h-3.5"></i>
            <span class="marquee-text">Original sound — ${video.creatorDisplay || video.creator}</span>
          </div>
        </div>

        <!-- right action rail -->
        <div class="action-rail absolute right-2.5 bottom-6 z-30 flex flex-col items-center gap-5 text-white">
          <button class="follow-avatar-btn relative">
            <img src="https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(video.creator)}" class="w-11 h-11 rounded-full ring-2 ring-white object-cover" alt="">
            <span class="follow-plus absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FF1744] to-[#FF6D00] rounded-full w-5 h-5 flex items-center justify-center ${following ? 'hidden' : ''}">
              <i data-lucide="plus" class="w-3 h-3 text-white"></i>
            </span>
          </button>

          <button class="like-btn action-btn flex flex-col items-center gap-1">
            <i data-lucide="heart" class="w-7 h-7 ${liked ? 'fill-[#FF1744] text-[#FF1744]' : 'text-white'} transition-transform"></i>
            <span class="like-count text-xs font-semibold drop-shadow">${formatCount(likeCount)}</span>
          </button>

          <button class="comment-btn action-btn flex flex-col items-center gap-1">
            <i data-lucide="message-circle" class="w-7 h-7 text-white"></i>
            <span class="comment-count text-xs font-semibold drop-shadow">${formatCount(commentCount)}</span>
          </button>

          <button class="share-btn action-btn flex flex-col items-center gap-1">
            <i data-lucide="share-2" class="w-7 h-7 text-white"></i>
            <span class="text-xs font-semibold drop-shadow">Share</span>
          </button>

          <button class="save-btn action-btn flex flex-col items-center gap-1">
            <i data-lucide="bookmark" class="w-7 h-7 ${saved ? 'fill-[#FF6D00] text-[#FF6D00]' : 'text-white'}"></i>
            <span class="text-xs font-semibold drop-shadow">${saved ? 'Saved' : 'Save'}</span>
          </button>

          <button class="more-btn action-btn flex flex-col items-center gap-1">
            <i data-lucide="ellipsis" class="w-6 h-6 text-white"></i>
          </button>
        </div>
      </div>
    `;

    this._wireCard(card, video);
    return card;
  },

  _wireCard(card, video) {
    const videoEl = card.querySelector('video');
    const tapLayer = card.querySelector('.tap-layer');
    const controls = card.querySelector('.video-controls');
    const progressTrack = card.querySelector('.progress-track');
    const progressFill = card.querySelector('.progress-fill');
    const muteBtn = card.querySelector('.mute-btn');
    const fullscreenBtn = card.querySelector('.fullscreen-btn');
    const centerPlayBtn = card.querySelector('.center-play-btn');
    const likeBtn = card.querySelector('.like-btn');
    const saveBtn = card.querySelector('.save-btn');
    const commentBtn = card.querySelector('.comment-btn');
    const shareBtn = card.querySelector('.share-btn');
    const moreBtn = card.querySelector('.more-btn');
    const followBtn = card.querySelector('.follow-avatar-btn');
    const creatorLink = card.querySelector('.creator-link');
    const heartLayer = card.querySelector('.heart-burst-container');

    let lastTap = 0;
    let controlsVisible = true;
    let hideTimer = null;

    const showControls = () => {
      controlsVisible = true;
      controls.style.opacity = '1';
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        controls.style.opacity = '0.25';
      }, 2600);
    };
    showControls();

    // Sync mute icon + global sound setting
    const syncMuteIcon = () => {
      muteBtn.innerHTML = `<i data-lucide="${videoEl.muted ? 'volume-x' : 'volume-2'}" class="w-4 h-4"></i>`;
      if (window.lucide) lucide.createIcons({ nodes: [muteBtn] });
    };
    syncMuteIcon();

    videoEl.addEventListener('timeupdate', () => {
      if (!videoEl.duration) return;
      progressFill.style.width = `${(videoEl.currentTime / videoEl.duration) * 100}%`;
    });

    videoEl.addEventListener('play', () => {
      Store.bumpVideoMeta(video.id, { views: 1 });
      Store.markWatched(video.id);
    });

    // Tap = toggle play/pause + show controls; double-tap = like
    tapLayer.addEventListener('click', (e) => {
      const now = Date.now();
      const rect = tapLayer.getBoundingClientRect();
      const x = (e.clientX || rect.width / 2) - rect.left;
      const y = (e.clientY || rect.height / 2) - rect.top;

      if (now - lastTap < 320) {
        // double tap
        clearTimeout(tapLayer._singleTapTimer);
        this._likeVideo(card, video, true);
        this._spawnHeart(heartLayer, x, y);
        lastTap = 0;
        return;
      }
      lastTap = now;

      // single-tap toggle after a short delay to allow double-tap detection
      clearTimeout(tapLayer._singleTapTimer);
      tapLayer._singleTapTimer = setTimeout(() => {
        if (videoEl.paused) {
          videoEl.play();
          this._flashCenterIcon(centerPlayBtn, 'play');
        } else {
          videoEl.pause();
          this._flashCenterIcon(centerPlayBtn, 'pause');
        }
        showControls();
      }, 260);
    });

    tapLayer.addEventListener('mousemove', showControls);
    tapLayer.addEventListener('touchstart', showControls, { passive: true });

    // Progress bar scrub
    progressTrack.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = progressTrack.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      if (videoEl.duration) videoEl.currentTime = pct * videoEl.duration;
    });

    // Mute toggle also updates the app-wide sound preference
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      videoEl.muted = !videoEl.muted;
      const s = Store.getSettings();
      s.soundOn = !videoEl.muted;
      Store.saveSettings(s);
      syncMuteIcon();
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const frame = card.querySelector('.phone-frame');
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        (frame.requestFullscreen || frame.webkitRequestFullscreen)?.call(frame);
      }
    });

    // Like button
    likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._likeVideo(card, video, false);
    });

    // Save button
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nowSaved = Store.toggleSave(video.id, {
        poster: video.poster, creator: video.creator, description: video.description, url: video.url,
      });
      Store.bumpVideoMeta(video.id, { saves: nowSaved ? 1 : -1 });
      const icon = saveBtn.querySelector('i');
      const label = saveBtn.querySelector('span');
      icon.setAttribute('class', `w-7 h-7 ${nowSaved ? 'fill-[#FF6D00] text-[#FF6D00]' : 'text-white'}`);
      label.textContent = nowSaved ? 'Saved' : 'Save';
      UI.pulse(saveBtn);
      UI.toast(nowSaved ? 'Saved to your collection' : 'Removed from saved');
      if (nowSaved) Store.addNotification(`You saved @${video.creator}'s video`, 'bookmark');
    });

    // Comment button → open bottom sheet
    commentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Comments.open(video, card);
    });

    // Share button → open share modal
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.openShareModal(video);
    });

    // More button → simple menu
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.toast('Report / Not interested — coming soon');
    });

    // Follow avatar
    const doFollow = (e) => {
      e.stopPropagation();
      const nowFollowing = Store.toggleFollow(video.creator);
      const plus = card.querySelector('.follow-plus');
      plus.classList.toggle('hidden', nowFollowing);
      UI.toast(nowFollowing ? `Following @${video.creator}` : `Unfollowed @${video.creator}`);
      if (nowFollowing) Store.addNotification(`You followed @${video.creator}`, 'user-plus');
      document.querySelectorAll(`[data-creator="${video.creator}"] .follow-state`).forEach(el => {
        el.textContent = nowFollowing ? 'Following' : 'Follow';
      });
    };
    followBtn.addEventListener('click', doFollow);
    creatorLink.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `profile.html?creator=${encodeURIComponent(video.creator)}`;
    });

    if (window.lucide) lucide.createIcons({ nodes: [card] });
  },

  _likeVideo(card, video, fromDoubleTap) {
    const likeBtn = card.querySelector('.like-btn');
    const icon = likeBtn.querySelector('i');
    const countEl = likeBtn.querySelector('.like-count');
    const wasLiked = Store.isLiked(video.id);

    if (fromDoubleTap && wasLiked) {
      // Already liked — double tap should NOT toggle it off or double count.
      return;
    }
    const nowLiked = Store.toggleLike(video.id);
    Store.bumpVideoMeta(video.id, { likes: nowLiked ? 1 : -1 });

    icon.setAttribute('class', `w-7 h-7 ${nowLiked ? 'fill-[#FF1744] text-[#FF1744]' : 'text-white'} transition-transform`);
    const meta = Store.getVideoMeta(video.id);
    const base = video.baseLikes || 0;
    countEl.textContent = formatCount((meta.likes || 0) + base);
    UI.pulse(likeBtn);
    if (nowLiked) Store.addNotification(`You liked @${video.creator}'s video`, 'heart');
  },

  _spawnHeart(container, x, y) {
    const heart = document.createElement('div');
    heart.className = 'burst-heart absolute';
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    heart.innerHTML = `<i data-lucide="heart" class="w-24 h-24 fill-[#FF1744] text-[#FF1744]"></i>`;
    container.appendChild(heart);
    if (window.lucide) lucide.createIcons({ nodes: [heart] });
    requestAnimationFrame(() => heart.classList.add('burst-heart-animate'));
    setTimeout(() => heart.remove(), 900);
  },

  _flashCenterIcon(btn, type) {
    btn.querySelector('i').setAttribute('data-lucide', type);
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
    btn.classList.remove('opacity-0');
    btn.classList.add('opacity-100');
    setTimeout(() => {
      btn.classList.remove('opacity-100');
      btn.classList.add('opacity-0');
    }, 450);
  },
};

function formatCount(n) {
  n = Math.max(0, n || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
