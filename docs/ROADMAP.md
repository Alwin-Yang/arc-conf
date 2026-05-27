# Roadmap

Build order for arc-conf. Each step has a corresponding `docs/stepN-*.md` walkthrough.

## Phase 1: Foundation

- [x] **Step 1**: Initialize Next.js project — [walkthrough](./step1-init-nextjs.md)
- [x] **Step 2**: Install and initialize shadcn/ui — [walkthrough](./step2-shadcn-ui.md)
- [ ] **Step 3**: Add core dependencies — [walkthrough](./step3-core-deps.md)
  - `date-fns-tz` — time zone conversion (AoE / Munich / local)
  - `js-yaml` — read upstream YAML data
  - `zod` — runtime schema validation
  - `next-themes` — dark mode
- [ ] **Step 4**: Configure static export + project structure

## Phase 2: Data Layer

- [ ] **Step 5**: Define `Conference` schema (Zod)
- [ ] **Step 6**: Build data sync script
  - Pull `paperswithcode/ai-deadlines` YAML
  - Filter to AI / Robotics / Control venues
  - Merge with custom `data/conferences.yml` overrides (RA-L cycles, multi-deadline, etc.)
  - Output `data/conferences.json` at build time

## Phase 3: UI

- [ ] **Step 7**: Deadline list page
  - Cards with countdown
  - Filters (area / rank / month)
  - URL-synced filter state
- [ ] **Step 8**: Conference detail page
  - All deadlines (abstract / paper / supplementary / rebuttal / camera-ready)
  - RA-L ↔ ICRA / IROS cycle linkage
- [ ] **Step 9**: Personal status tracker (localStorage)
  - In Progress / Submitted / Under Review / Rebuttal / Accepted / Rejected
- [ ] **Step 10**: Time zone toggle (AoE / Munich / local)

## Phase 4: Export & Automation

- [ ] **Step 11**: `.ics` calendar export per conference + bulk
- [ ] **Step 12**: Sitemap + Open Graph metadata
- [ ] **Step 13**: GitHub Actions for daily auto-rebuild

## Phase 5: Deploy

- [ ] **Step 14**: Deploy to Cloudflare Pages (or GitHub Pages)
- [ ] **Step 15**: Custom domain + HTTPS (optional)

## Future Ideas (post-v1)

- Workshop / Special Issue tracker (TRO SI, RA-L SI)
- Browser extension for one-click deadline import
- Email notifications (would require backend — only if demand exists)
- Community PRs for new venues
