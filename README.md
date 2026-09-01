# TikReel — Short Video Web App

A frontend-only, TikTok-style vertical short-video experience built with **HTML5, Tailwind CSS (CDN), vanilla JavaScript, and the Pexels Video API**. No PHP, no Node.js, no framework, no server — it can be dropped directly onto any static host.

## 1. Add your Pexels API key

Open `js/api.js` and replace the placeholder:

```js
const PEXELS_API_KEY = "YOUR_API_KEY_HERE";
```

with your real key from [pexels.com/api](https://www.pexels.com/api/). Get a free key by creating a Pexels account.

> ⚠️ **Security note:** this key lives in client-side JavaScript, which means anyone can read it via browser dev tools or network requests. That's fine for a demo/portfolio project, but **not safe for a real production app**. Before shipping this for real users, move all Pexels requests behind a small backend/serverless proxy that holds the key server-side and rate-limits requests. The API calls in `js/api.js` are isolated in one place specifically so this swap is easy later.

## 2. Run it locally

Because the app uses `fetch()` and IndexedDB, open it through a local web server rather than `file://`. Any static server works, for example:

```bash
# Python
python3 -m http.server 8080

# or Node's http-server (if you have Node installed for local dev only —
# the app itself still doesn't need Node to run)
npx http-server -p 8080
```

Then visit `http://localhost:8080`.

## 3. Deploy

TikReel is 100% static — copy the whole `tikreel/` folder to:

- **GitHub Pages** — push to a repo, enable Pages on the `main` branch
- **Netlify** — drag-and-drop the folder onto the Netlify dashboard, or connect the repo
- **Cloudflare Pages** — connect the repo, build command: none, output directory: `/`

No environment variables or build step are required. If you want the API key out of source control, most static hosts let you inject it at deploy time by templating `js/api.js`, but that still ends up visible in the shipped JS — see the security note above.

## Project structure

```
tikreel/
├── index.html            Home feed (also handles ?search= and ?category=)
├── discover.html          Search, categories, hashtags, popular grid
├── trending.html          Locally-ranked trending + popular
├── profile.html           Own profile / other creators' profiles
├── saved.html              Saved videos
├── messages.html           Local demo inbox
├── notifications.html      Local notification feed
├── settings.html           Theme, playback, data controls
├── create.html              Local video upload (IndexedDB)
├── css/style.css            Scroll-snap, theming, animations
├── js/
│   ├── storage.js           localStorage + IndexedDB wrapper
│   ├── api.js                Pexels API integration (⚠️ key lives here)
│   ├── feed.js                Feed loading/ranking/pagination
│   ├── player.js               Video card rendering + controls + gestures
│   ├── likes.js                 Small helpers over Store for like stats
│   ├── comments.js               Comments bottom sheet
│   ├── profile.js                 Profile page logic
│   ├── ui.js                       Nav, toasts, share modal, theming
│   └── app.js                       Home feed page controller
└── assets/
```

## What's stored where

- **localStorage** — profile, likes, saves, follows, comments, notifications, messages, settings, search history, and lightweight per-video engagement counters (views/likes/comments/saves) used for the Trending ranking.
- **IndexedDB** (`js/storage.js` → `VideoDB`) — the actual video files a user uploads on the Create page. Large binary blobs don't belong in localStorage (small quota, synchronous API), so IndexedDB is used instead via `saveVideo()`, `getVideos()`, and `deleteVideo()`.

Uploaded videos only exist in the current browser, on the current device, for as long as the site's storage isn't cleared — there's no server, so nothing is backed up or shared with anyone else.

## Notes on the "real feature, frontend-only" approach

- Autoplay/pause is driven by `IntersectionObserver` in `js/player.js` — exactly one video plays at a time.
- The trending ranking is a simple, transparent local formula: `score = views×1 + likes×3 + comments×4 + saves×5`, computed in `js/feed.js`.
- Everything you can click actually does something: likes/saves/follows persist and reflect across pages, comments can be posted and deleted, search has real history, and the Create flow really writes a playable video into IndexedDB and surfaces it in your own feed and profile grid.
