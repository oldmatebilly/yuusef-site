# yuusef.com

The yuusef.com artist site. Plain static files, no build step. Netlify publishes the repo root.

- `main` is what's live on yuusef.com.
- Changes go on a branch and a pull request. Netlify builds a preview link for each pull request; merging publishes to the live site.
- Upcoming release banner: set `NEXT_TAPE` at the top of `assets/data.js` (once the redesign is merged).
