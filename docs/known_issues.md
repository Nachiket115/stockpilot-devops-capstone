# Known issues

## npm audit: esbuild <=0.24.2 via vite 5.4.21 (GHSA-67mh-4wv8-2f99, moderate)
- Affects the Vite dev server only: a malicious website could send requests to a running
  `npm run dev` server and read responses.
- Not present in the production image. The frontend Dockerfile is multi-stage, and only the
  compiled `dist/` static files are copied into the nginx image.
- The only fix npm offers is a major upgrade (Vite 8), which is a breaking change. Vite is pinned
  at 5.4.21, the latest 5.x release. Planned: upgrade to a current major version after the
  capstone is complete.
