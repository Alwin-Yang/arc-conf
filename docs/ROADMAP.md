# Roadmap

Build order for arc-conf. Each step has a corresponding `docs/stepN-*.md` walkthrough.

## Phase 1: Foundation

- [x] **Step 1**: Initialize Next.js project — [walkthrough](./step1-init-nextjs.md)
- [x] **Step 2**: Install and initialize shadcn/ui — [walkthrough](./step2-shadcn-ui.md)
- [x] **Step 3**: Add core dependencies — [walkthrough](./step3-core-deps.md)
  - `date-fns-tz` — time zone conversion (AoE / Munich / local)
  - `js-yaml` — read upstream YAML data
  - `zod` — runtime schema validation
  - `next-themes` — dark mode
- [x] **Step 4**: Configure static export + project structure — [walkthrough](./step4-static-export.md)

## Phase 2: Data Layer

- [x] **Step 5**: Define `Conference` schema (Zod) — [walkthrough](./step5-conference-schema.md)
- [x] **Step 6**: Build dual-source data sync script — [walkthrough](./step6-data-sync.md)
  - Pull `paperswithcode/ai-deadlines` YAML (area authority via `sub` codes)
  - Enrich with `ccfddl/ccf-deadlines` (CCF/CORE rank, newer years, multi-round timelines)
  - Merge with custom `data/conferences.yml` overrides (RA-L cycles, control venues, etc.)
  - Output `data/conferences.json` at build time

## Phase 3: UI

- [x] **Step 7**: Deadline list page — [walkthrough](./step7-deadline-list.md)
  - Cards with countdown
  - Filters (area / rank / month)
  - URL-synced filter state
- [ ] **Step 8**: Conference detail page
  - All deadlines (abstract / paper / supplementary / rebuttal / camera-ready)
  - RA-L ↔ ICRA / IROS cycle linkage
- [ ] **Step 9**: Time zone toggle (AoE / Munich / local)

## Phase 4: Export & Automation

- [ ] **Step 10**: `.ics` calendar export per conference + bulk
- [ ] **Step 11**: Sitemap + Open Graph metadata
- [ ] **Step 12**: GitHub Actions for daily auto-rebuild

## Phase 5: Deploy

- [ ] **Step 13**: Deploy to Cloudflare Pages (or GitHub Pages)
- [ ] **Step 14**: Custom domain + HTTPS (optional)

## Future Ideas (post-v1)

- Personal status tracker (localStorage: In Progress / Submitted / Under Review / Rebuttal / Accepted / Rejected)
- Workshop / Special Issue tracker (TRO SI, RA-L SI)
- Browser extension for one-click deadline import
- Email notifications (would require backend — only if demand exists)
- Community PRs for new venues
