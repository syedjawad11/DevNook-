# DevNook — Dev Workspace

> Always read this file first at the start of a new session.
> Content pipeline lives in `../pipeline/` — no pipeline code or registry here.
> Detailed site architecture → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Monorepo overview → [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
> Current operational state (routines, queue, tasks) → [`../docs/STATUS.md`](../docs/STATUS.md).

## Session start

Do not auto-read: `docs/archives/` (includes archived session history + stale artifacts). Start from this file + MEMORY.md only.

---

## Project Overview

**DevNook** (devnook.dev) — developer resource site. ~91 posts + 18 client-side browser tools.
**Stack:** Astro + Cloudflare Pages. `main` branch auto-deploys on every push.
**Content:** Published by `../pipeline/agents/publish/publish.py` — no pipeline code lives here.

---

## Key Paths

| Path | Purpose |
|------|---------|
| `src/` | Astro site source |
| `src/layouts/` | Layouts (PostLayout.astro, etc.) |
| `src/content/` | Published markdown content (written by content workspace) |
| `src/components/` | Astro components |
| `public/styles/` | Global CSS (NOT src/styles/) |
| `src/pages/tools/[slug].astro` | Tools dynamic route |
| `public/tools/*.html` | Tool HTML files |
| `src/plugins/auto-internal-links/index.mjs` | Build-time internal link insertion |
| `src/plugins/related-callouts/index.mjs` | Build-time related post callouts |
| `agents/subagent-prompts/builder.md` | Dev subagent prompt |
| `agents/skills/astro-conventions.md` | Astro coding conventions |
| `scripts/seo_audit.py` | SEO audit — `D:\miniconda3\python.exe scripts/seo_audit.py` |
| `scripts/fix_trailing_slashes.py` | Trailing slash fixer |
| `docs/` | Architecture docs, session history, planning docs |

---

## Dev Subagent

```
ORCHESTRATOR (Sonnet main session)
  └── Builder (Sonnet) — agents/subagent-prompts/builder.md
      Handles: Astro edits, new tools, npm run build verification
```

Spawn with: `Agent(prompt=open('agents/subagent-prompts/builder.md').read(), ...)`

**Workflow B** — new tool: Orchestrator → Builder → review + commit
**Workflow C** — bug fix: Orchestrator → Builder → review + commit

---

## Important Decisions

> Live guardrails — forgetting these will break something.

| Decision | Impact |
|----------|--------|
| No Tailwind | All styles in `tokens.css` custom properties |
| All tools client-side only | 18 tools, no Workers, no AI-powered tools |
| Static output (not hybrid) | `output: 'static'`, no adapter — satori crashes Workers runtime |
| Global CSS in `public/styles/` not `src/styles/` | Astro only copies `public/` to `dist/`; absolute `/styles/*` refs need public/ |
| PostCard prop is `href` not `slug` | All 5 call sites use `href`; never rename to slug/url/path |
| `tools/[slug].astro` uses `import.meta.glob` | Dynamic `await import()` crashes Vite static analysis |
| Never call `build-tool.py build_tool()` for existing tools | Writes page that collides with dynamic route |
| Auto internal links plugin (rehype, build-time) | `src/plugins/auto-internal-links/index.mjs`; language concept URLs use `frontmatter.language`+`frontmatter.concept`, NOT filename |
| Use `@astrojs/sitemap@3.2.1` not custom | v3.7+ incompatible with Astro 4.x; generates `sitemap-0.xml` (0-indexed) |
| Related posts auto-derived at render time | `PostLayout.astro` builds related list from `getCollection()` — never from hand-written `## Related` sections. `frontmatter.related_posts` unused; leave as `[]`. |
| Content pipeline is external | No registry, staging, or publish scripts here. `src/content/` written by `../pipeline/agents/publish/publish.py`. |
| Language post URLs use `concept`, not filename | Correct path: `/languages/{lang}/{concept}`. `publish.py` has `validate_language_links()` guard. |
| React is a language category (`/languages/react/`) | Added 2026-06-21. Languages are data-driven: to add one, edit ONLY `src/content/config.ts` (`LANGUAGE_ENUM`) + `src/lib/language-colors.ts` (`LANGUAGE_COLORS`+`LANGUAGE_NAMES`). Index/hub/concept pages auto-generate; `/languages/` index card needs `postCount >= 5`. |
| Tool slugs: link only canonical built slugs | The registry `tools` rows hold stale slugs (e.g. `regex-tester-online-java`); the real routes are `/tools/regex-tester/` etc. (17 tools, see `public/tools/*.html`). Never derive a `/tools/` link from a registry tool slug — use the canonical built slug or it 404s. |
| Auto-internal-links covers all categories | Scans full `contentDir` — guides, blog, cheatsheets, languages. Not language-only. |
| Related callouts plugin (session 32) | Injects up to 3 `<aside class="related-callout">` nodes at interior H2s. Per-post opt-out: `excludeRelatedCallouts: true`. |
| No H1 in markdown body | `PostLayout.astro` renders title as `<h1>`. Body `# Title` = duplicate H1, Ahrefs flags it. |
| Author identity is single-sourced | `src/lib/author.ts` exports `AUTHOR` ("Syed J.") + `ORGANIZATION`. `PostLayout.astro` injects the "By Syed J." byline + Article/Person/Organization JSON-LD on every content page; bio at `/about/syed-j/`. Never hardcode an author name — pull from `author.ts`. No AI-process disclosure on bylines (user decision). |
| Same-topic duplicates → 301, don't co-exist | Cannibalizing pages get merged: retire the weaker file, add a `/old/ /canonical/ 301` line to `public/_redirects`, repoint inbound links. |
| Never use `[skip ci]` in devnook commits | Cloudflare Pages skips build. The `[skip ci]` in `drip-publish.yml` is intentional (content-workspace side only). |
| `/languages/` index lists every language with ≥1 post | The old `postCount >= 5` gate orphaned 8 of 13 hubs: they still built and sat in the sitemap, but nothing linked to them. Never gate a hub card on volume — gate on "has content". |
| Language hubs cross-link each other | `[lang]/index.astro` renders an "Other languages" row so the 13 hubs form a mesh, not 13 dead ends off one index page. |
| `devnookUrlBuilder` branches on `category === 'languages'` | Cheatsheets may also carry `language` + `concept` (`javascript-array-cheatsheet` = javascript/array-methods, which is also a real language post). Without the category check they resolve onto the language article's URL. |
| Sitemap emits per-page `<lastmod>` | `src/lib/sitemap-lastmod.mjs` reads `published_date` off disk and feeds `sitemap({ serialize })`. Never use the integration's top-level `lastmod` option — it stamps one identical date on all ~150 URLs, which Google discounts. Hubs inherit their newest child's date. |
| Breadcrumb labels are display names | `Breadcrumb.astro` feeds its labels straight into BreadcrumbList schema, so `PostLayout` maps `csharp` → `C#` and `languages` → `Languages`. Never pass raw URL segments. |

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...    # Builder subagent (if needed)
```

---

## How to Run

```bash
npm run dev        # Dev server
npm run build      # Production build (always verify before committing)
npm run preview    # Preview production build
```
