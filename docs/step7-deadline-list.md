# Step 7: Deadline list page

The first real screen: a responsive grid of conference cards, each with a live countdown, plus area / rank / month filters whose state lives in the URL. Everything is pre-rendered into static HTML at build time and enhanced on the client.

```
app/page.tsx                     ← server: loads data, renders header + explorer
└─ components/conference-explorer ← client: filters (URL-synced) + grid
   └─ components/deadline-card    ← one card
      └─ components/countdown     ← client: live ticking
```

---

## 1. The static-export constraint that shaped the design

The natural way to URL-sync filters is `useSearchParams()`. **Don't** — under `output: "export"` it forces a client-side-render bailout, so the prerendered HTML ships *empty* (only the Suspense fallback) and every card appears blank until JS hydrates. Bad for first paint and SEO.

Instead the explorer:

1. Holds filter state in plain `useState`, initialized to "all".
2. The **server prerenders the full, unfiltered grid** → all cards are in the HTML.
3. After mount, a `useEffect` reads `window.location.search` and applies any incoming filters.
4. Changing a filter updates state **and** `window.history.replaceState(...)` — shareable URLs, no navigation, no bailout.

> Rule of thumb for static export: read the query string from `window.location` in an effect, not via `useSearchParams`, when you also want the content prerendered.

---

## 2. Data flow (server → client)

`app/page.tsx` is a Server Component. At build time it calls `upcomingConferences()` (from `@/lib/conferences`), which:

- validates `data/conferences.json` against the schema,
- keeps only conferences with a **future** deadline (`nextDeadline`),
- sorts by how soon, and
- returns `{ conference, next }[]`.

That array is passed as a prop to the client `<ConferenceExplorer>`. Plain objects serialize fine across the server/client boundary.

### Why two lib files

| File | Imports JSON? | Used by |
|---|---|---|
| `lib/conferences.ts` | **yes** (`@/data/conferences.json`) | server only |
| `lib/conference-utils.ts` | no — pure functions/types | server **and** client |

The explorer is a client component; if it imported `lib/conferences.ts`, the whole dataset would be bundled into the client *twice* (once in the bundle, once as serialized props). Pure helpers (`coreTier`, `nextDeadline`, `AREA_LABELS`, `RANK_TIERS`) live in `conference-utils.ts` so the client can use them without dragging in the JSON.

---

## 3. The three filters

| Filter | Source | Notes |
|---|---|---|
| **Area** | `conference.areas` | `ai` / `robotics` / `control` |
| **Rank** | `coreTier(conference)` | distills the messy `rank` string ("CORE A* · CCF B") to a single CORE tier (`A*`/`A`/`B`/`C`); journal ranks like `Q1` don't match |
| **Month** | `monthKey(next.date)` | `YYYY-MM` of the next deadline; options are derived from the data so empty months never appear |

Filtering is a pure `useMemo` over the items. The result count and a **Clear** button (shown only when a filter is active) sit in the toolbar.

---

## 4. The card & countdown

`DeadlineCard` (server-renderable) shows: title (links to the official site), full name, rank badge, area badges, the next deadline's type/label, the as-published `localTime` + `timezone`, a live `Countdown`, and a footer with place / dates.

`Countdown` is a Client Component. It:

- renders a stable `—` placeholder until mounted (so SSR markup matches the first client render — no hydration mismatch),
- ticks every second via `setInterval`,
- shows `Nd HH:MM:SS`, or `closed` once the instant passes.

Deadlines under 7 days away render the countdown in the destructive color as a soft urgency cue.

---

## 5. shadcn components added

```bash
pnpm dlx shadcn@latest add badge select
```

`badge` (area/rank chips) and `select` (the three filter dropdowns). `card` and `button` were already present from earlier steps.

---

## 6. Verify

```bash
pnpm exec tsc --noEmit
pnpm build                       # static export to out/
```

Confirm the grid is actually in the prerendered HTML (not just hydrated in):

```bash
grep -c 'data-slot="card"' out/index.html   # > 0
```

Then smoke-test interactively:

```bash
pnpm dlx serve out
```

Check:

1. Cards are visible immediately (before/without JS — they're in the HTML).
2. Countdowns tick every second.
3. Changing Area/Rank/Month updates the grid **and** the URL (`?area=robotics`).
4. Reloading a filtered URL restores the same filtered view.
5. **Clear** resets filters and the URL.
6. Theme toggle still flips light/dark.

> The grid may be short — only conferences whose deadline is still in the future show up. With a stale upstream snapshot most entries are historical; re-run `pnpm sync` to refresh.

---

## 7. Commit

```bash
git add app/page.tsx components/ lib/ docs/ROADMAP.md docs/step7-deadline-list.md
git commit -m "step 7: deadline list page with countdowns + URL-synced filters"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Cards blank until JS loads / empty `out/index.html` body | `useSearchParams` CSR bailout | Use `window.location` + `history.replaceState` instead (see §1) |
| `Hydration failed` on the countdown | rendering a live time during SSR | Gate on a `mounted` flag, render a placeholder first |
| Whole dataset in the client bundle | client component imported `lib/conferences.ts` | Import pure helpers from `lib/conference-utils.ts` |
| Rank filter hides everything | venue has a journal rank (`Q1`) with no CORE tier | expected — those don't match A*/A/B/C; filter by area instead |

---

## Done?

Report back with:

- `grep -c 'data-slot="card"' out/index.html` (should be > 0)
- Whether filters update the URL and survive a reload
- Countdowns ticking, no console errors

Next: **Step 8** — the conference detail page (`/conf/[id]`) with the full deadline timeline and RA-L ↔ ICRA/IROS cycle linkage, using `generateStaticParams`.
