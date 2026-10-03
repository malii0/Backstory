# Backstory
Backstory is a personal web app I built for tracking the movies and shows I watch. It's inspired by tools like Letterboxd and Trakt, but I built it from scratch to fit how I actually want to log and rate things.
Live: [backstory0.vercel.app](https://backstory0.vercel.app)
## What it does
- **Library:** Log what you've watched or plan to watch, mark things as completed or on your watchlist, rate on a 0-10 scale, and track rewatches.
- **Discover:** Search movies and shows via TMDB, browse what's popular or new, and jump into related collections or similar titles.
- **Detail view:** Cast, trailers, streaming availability (Netflix, Prime, etc.), and collection info, all pulled together in one panel.
- **Stats dashboard:** Total watch time, genre breakdown, average rating, and other personal viewing stats.
- **Recommendations:** A personalized discovery feed computed from your logged titles and genre preferences, plus an optional AI-generated analysis of your taste in the stats dashboard that suggests what to watch next.
- **Cloud sync:** Your library is stored in your personal account and remains available across your devices after signing in.
- **PWA support:** Installable as an app on phone or desktop.
## Why I built it
Most existing tracking apps were either full of ads or didn't quite give me the rating and stats setup I wanted. I started with a simple localStorage-based prototype, then moved to Supabase to add accounts, cloud sync, and a richer discovery experience.
## Tech stack
- **Next.js (App Router)**, built with React 19.
- **Supabase** for auth and the database (PostgreSQL). All data access is protected by Row Level Security, restricting each user to reading and modifying only their own records.
- **TMDB API**, proxied through a Next.js API route. The TMDB key stays serverside and never reaches the browser; the set of TMDB endpoints that can be called is also restricted to a fixed allowlist.
- **Upstash Redis** for rate limiting on the TMDB and AI API routes, and for caching TMDB responses.
- **Groq**, via the Vercel AI SDK, powers the AI recommendations. It only runs when you ask for it, and only the titles of up to 30 favorites and 30 watchlist items are sent for the analysis.
- **Tailwind CSS** for the UI, deployed and hosted on **Vercel**.
## Access
Signups are currently closed to the public, it's invite only for now. Reach out if you'd like an account.
- Website: [malionurlucan.me](https://malionurlucan.me)
- GitHub: [@malii0](https://github.com/malii0)
## Note
Movie and TV data is provided by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
## License
All rights reserved. Unauthorized copying, modification, or distribution of this software is prohibited.
