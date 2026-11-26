# OBLAST.STUDIO

Website for Oblast — an independent studio for design, technology and digital experiences.
Built from `OBLAST-WEBSITE-SPEC.md` (v1), one phase at a time.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · SCSS modules · Zod · pnpm · Vercel

## Commands

```bash
pnpm dev            # http://localhost:3000
pnpm check          # lint + typecheck + production build
pnpm placeholders   # regenerate MOCK posters in public/media/projects
```

## Structure

```text
src/
  app/                    routes: /, /work, /work/[slug], /about, /contact, sitemap, robots
  components/
    shell/                SiteHeader (segmented nav), LocalClock, SiteFooter, PageIntro
    hero/                 Hero, HeroPoster (static fallback; WebGL cube arrives in Phase 1)
    projects/             ProjectGrid, ProjectTile (6/3/2/1-column modular grid)
    case-study/           CaseHero, ProjectMetadata, ContentBlocks, ProjectPagination
  content/projects/       typed project entries (currently MOCK)
  lib/                    site config, Zod content schema, project loaders + validation
  styles/                 tokens, typography, grid
```

## Content

Projects live in `src/content/projects/index.ts` and are validated at build time by
`src/lib/projects.ts` (Zod schema + unique slugs/orders + alt text + spans within column
counts). A bad entry fails the build.

Grid spans are set per breakpoint (`desktop` 6 cols, `tablet` 3, `mobile` 2; narrow is
always 1). Rows are half a column wide, so `{ x: 1, y: 2 }` is square. Order is source
order — no `dense` packing — so choose spans that tile cleanly.

## Before launch

Everything marked **PLACEHOLDER** or **MOCK** must be replaced:

- [ ] `src/lib/site.ts` — studio copy, contact email, clock timezone (currently UTC), then set `preLaunch: false`
- [ ] `src/content/projects/` — real projects, media, credits (all mocks have `placeholder: true`)
- [ ] `src/app/about/page.tsx` — approach, people, capabilities
- [ ] `src/components/hero/HeroPoster.tsx` — real still of the production cube

While `preLaunch` is true the whole site is `noindex` and `robots.txt` disallows crawling.
Mock project pages are always `noindex` and excluded from the sitemap.

## Phases

- [x] **0 — Foundation:** tokens, fonts, shell, grid primitives, typed fixtures, all routes server-rendered
- [ ] **1 — Cube prototype:** R3F video cube, BoxGeometry baseline → rounded triplanar shader, poster/lifecycle
- [ ] **2 — Homepage & archive:** cube in hero, media loading, video previews, filters
- [ ] **3 — Intro & cursor:** centred strip → header Flip intro, metadata cursor
- [ ] **4 — Case studies & transitions:** tile → hero overlay controller, scroll restoration
- [ ] **5 — Polish & deploy:** real content, cross-browser/device testing, Vercel + domain
