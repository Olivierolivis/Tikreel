/* ============================================================
   TikReel — profile.js
   Drives profile.html: renders the profile header/stats, the
   edit-profile form, and a grid of the user's local videos.
   ============================================================ */

const ProfilePage = {
  async init() {
    const params = new URLSearchParams(location.search);
    const creatorParam = params.get('creator');

    if (creatorParam) {
      this._renderOtherCreator(creatorParam);
      return;
    }

    this._renderOwnProfile();
    this._wireEditForm();
    await this._renderVideoGrid();
  },

  _renderOwnProfile() {
    const p = Store.getProfile();
    document.getElementById('profile-avatar').src = p.avatar;
    document.getElementById('profile-display-name').textContent = p.displayName;
    document.getElementById('profile-username').textContent = '@' + p.username;
    document.getElementById('profile-bio').textContent = p.bio || '';
    document.getElementById('profile-followers').textContent = formatCount(p.followers || 0);
    document.getElementById('profile-following').textContent = formatCount(Object.keys(Store.getFollows()).length || p.following || 0);
    document.getElementById('profile-likes').textContent = formatCount(Likes.count());
    document.getElementById('profile-edit-btn').classList.remove('hidden');
    document.getElementById('profile-follow-btn').classList.add('hidden');
  },

  _renderOtherCreator(creator) {
    document.getElementById('profile-avatar').src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(creator)}`;
    document.getElementById('profile-display-name').textContent = creator.replace(/_/g, ' ');
    document.getElementById('profile-username').textContent = '@' + creator;
    document.getElementById('profile-bio').textContent = 'Creating short videos on TikReel 🎬';
    document.getElementById('profile-followers').textContent = formatCount(1200 + creator.length * 37);
    document.getElementById('profile-following').textContent = formatCount(180);
    document.getElementById('profile-likes').textContent = formatCount(9800 + creator.length * 210);
    document.getElementById('profile-edit-btn').classList.add('hidden');

    const followBtn = document.getElementById('profile-follow-btn');
    followBtn.classList.remove('hidden');
    followBtn.dataset.creator = creator;
    const syncBtn = () => {
      const following = Store.isFollowing(creator);
      followBtn.querySelector('.follow-state').textContent = following ? 'Following' : 'Follow';
      followBtn.classList.toggle('bg-gradient-to-r', !following);
      followBtn.classList.toggle('from-[#FF1744]', !following);
      followBtn.classList.toggle('to-[#FF6D00]', !following);
      followBtn.classList.toggle('muted-surface', following);
    };
    syncBtn();
    followBtn.onclick = () => {
      const nowFollowing = Store.toggleFollow(creator);
      UI.toast(nowFollowing ? `Following @${creator}` : `Unfollowed @${creator}`);
      if (nowFollowing) Store.addNotification(`You followed @${creator}`, 'user-plus');
      syncBtn();
    };

    document.getElementById('video-grid-empty').classList.remove('hidden');
    document.getElementById('video-grid-empty').querySelector('p').textContent = `@${creator} hasn't posted with this local demo — try Discover for real clips.`;
  },

  _wireEditForm() {
    const openBtn = document.getElementById('profile-edit-btn');
    const modal = document.getElementById('edit-profile-modal');
    const closeBtn = document.getElementById('edit-profile-close');
    const backdrop = document.getElementById('edit-profile-backdrop');
    const form = document.getElementById('edit-profile-form');

    openBtn?.addEventListener('click', () => {
      const p = Store.getProfile();
      form.username.value = p.username;
      form.displayName.value = p.displayName;
      form.bio.value = p.bio || '';
      form.avatarSeed.value = p.avatar.split('seed=')[1] || p.username;
      modal.classList.remove('opacity-0', 'pointer-events-none');
    });
    const close = () => modal.classList.add('opacity-0', 'pointer-events-none');
    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const p = Store.getProfile();
      p.username = form.username.value.trim() || p.username;
      p.displayName = form.displayName.value.trim() || p.displayName;
      p.bio = form.bio.value.trim();
      p.avatar = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(form.avatarSeed.value.trim() || p.username)}`;
      Store.saveProfile(p);
      close();
      this._renderOwnProfile();
      UI.toast('Profile updated');
    });

    document.getElementById('shuffle-avatar')?.addEventListener('click', () => {
      form.avatarSeed.value = 'seed-' + Math.floor(Math.random() * 100000);
    });
  },

  async _renderVideoGrid() {
    const grid = document.getElementById('video-grid');
    const empty = document.getElementById('video-grid-empty');
    const local = await VideoDB.getVideos();
    if (local.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    grid.innerHTML = local.map(v => `
      <div class="relative aspect-[9/16] rounded-lg overflow-hidden bg-black/40 group">
        <video src="${v.objectUrl}" class="w-full h-full object-cover" muted></video>
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-end p-2">
          <span class="text-white text-xs flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i>${formatCount(Store.getVideoMeta(v.id).likes || 0)}</span>
        </div>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
  },
};
