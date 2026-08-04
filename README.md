# Backstory
Backstory is a personal web app I built for tracking the movies and shows I watch. It's inspired by tools like Letterboxd and Trakt, but I built it from scratch to fit how I actually want to log and rate things.
Live: [backstory0.vercel.app](https://backstory0.vercel.app)
## What it does
- **Library:** Log what you've watched or plan to watch, mark things as completed or on your watchlist, rate on a 0-10 scale, and track rewatches.
- **Discover:** Search movies and shows via TMDB, browse what's popular or new, and jump into related collections or similar titles.
- **Detail view:** Cast, trailers, streaming availability (Netflix, Prime, etc.), and collection info, all pulled together in one panel.
- **Stats dashboard:** Total watch time, genre breakdown, average rating, and other personal viewing stats.
- **Activity feed:** See what other users have recently logged or rated.
- **Realtime sync:** Changes made on one device (a new rating, a watchlist add) show up instantly on any other open tab or device, via Supabase realtime.
- **PWA support:** Installable as an app on phone or desktop.
## Why I built it
Most existing tracking apps were either full of ads or didn't quite give me the rating and stats setup I wanted. I started with a simple localStorage-based prototype, then moved to Supabase to add accounts, realtime sync, and a richer discovery experience.
## Tech stack
- **Next.js (App Router)**, built with React 19.
- **Supabase** for auth and the database (PostgreSQL). All data access is protected by Row Level Security, so each user can only modify their own records.
- **TMDB API**, proxied through a Next.js API route. The TMDB key stays serverside and never reaches the browser; the set of TMDB endpoints that can be called is also restricted to a fixed allowlist.
- **Tailwind CSS** for the UI, deployed and hosted on **Vercel**.
## Access
Signups are currently closed to the public, it's invite only for now. Reach out if you'd like an account.
- Website: [malionurlucan.me](https://malionurlucan.me)
- GitHub: [@malionurlucan](https://github.com/malionurlucan)
## Note
Movie and TV data is provided by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
## License
All rights reserved. Unauthorized copying, modification, or distribution of this software is prohibited.
