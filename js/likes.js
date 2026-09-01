/* ============================================================
   TikReel — likes.js
   Small helper layer on top of Store for anything that needs
   to reason about "which videos has this user liked" across
   pages (profile stats, trending ranking, etc). Per-card like
   toggling itself lives in player.js next to the button it
   controls.
   ============================================================ */

const Likes = {
  count() {
    return Object.keys(Store.getLikes()).length;
  },
  allLikedIds() {
    return Object.keys(Store.getLikes());
  },
  totalLikesReceivedByCreator(username) {
    // Sums local engagement recorded against videos attributed to `username`.
    const meta = Store.getAllVideoMeta();
    return Object.values(meta).reduce((sum, m) => sum + (m.likes || 0), 0);
  },
};
