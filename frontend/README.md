# Prelegal frontend

Next.js (App Router) app, statically exported to `out/` and served by the FastAPI backend.
The Mutual NDA Standard Terms are read from `../templates/mutual-nda.md` at build time.

```bash
npm install
npm run dev     # http://localhost:3000 during development
npm test        # Vitest unit + component tests
npm run build   # static export to out/ (served by backend at http://localhost:8000)
```
