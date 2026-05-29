# Step 5: Define the `Conference` schema (Zod)

This is the **contract** every later step speaks. The sync script (Step 6) produces data that satisfies it; the list page (Step 7), detail page (Step 8), and `.ics` export (Step 11) all consume it. Get the shape right once, here, and the rest of the app is just rendering.

We use **Zod** (already installed in Step 3) so the schema is simultaneously:

- a **runtime validator** — the build fails loudly if the merged data is malformed, and
- a **static type** via `z.infer<>` — no second, hand-maintained TypeScript interface to drift out of sync.

The file lives in `types/conference.ts` — per the Step 4 boundary rules, Zod schemas and shared types go in `types/`.

---

## 1. Design decisions

### 1.1 Coarse `areas`, fine `tags`

Upstream tags each venue with `sub` codes (`ML`, `CV`, `NLP`, `RO`, `HCI`, …). For arc-conf's filters we only need three buckets — **AI / Robotics / Control** — so we collapse the codes into an `areas` array and keep the original codes in `tags` for any finer filtering later.

| Upstream `sub` | arc-conf `area` |
|---|---|
| `ML`, `CV`, `CG`, `NLP`, `SP`, `DM`, `AP`, `KR` | `ai` |
| `RO` | `robotics` |
| `HCI` (and anything unmapped) | *(filtered out)* |
| *(none — overrides only)* | `control` |

`control` has no upstream code on purpose: control-theory venues (CDC, L4DC, …) aren't in `paperswithcode/ai-deadlines`, so they only ever enter via our `data/conferences.yml` overrides (Step 6).

### 1.2 Deadlines: store the instant **and** the wall clock

A `Deadline` keeps three things:

```ts
{ date: "2024-09-16T06:59:59.000Z",   // absolute UTC instant — for countdowns
  localTime: "2024-09-15 23:59:59",   // as published — for "23:59 AoE" labels
  timezone: "America/Los_Angeles" }   // how we derived `date`
```

Why both? Countdown math needs an absolute instant (`date`). But researchers think in "23:59 AoE", so the UI should echo the published wall clock verbatim rather than re-deriving it. Storing all three means neither the countdown nor the label can be wrong.

`type` is one of `abstract | paper | supplementary | rebuttal | camera-ready | other`, ordered chronologically — that ordering drives the detail page timeline (Step 8).

### 1.3 `discriminated`-friendly, but flat for now

The roadmap mentions RA-L-style multi-cycle venues. Rather than a `discriminatedUnion`, we model that with a plain `deadlines: Deadline[]` — a single-deadline conference just has a one-element array, and RA-L has several. Simpler to render, and good enough until a real variant forces a union.

---

## 2. The schema

`types/conference.ts` exports:

| Export | What it is |
|---|---|
| `AREAS`, `Area` | the three buckets + its union type |
| `SUB_TO_AREA` | the upstream-code → area map (also used by the sync script) |
| `DEADLINE_TYPES`, `DeadlineType` | the ordered deadline kinds |
| `DeadlineSchema`, `Deadline` | one deadline |
| `ConferenceSchema`, `Conference` | one conference |
| `ConferencesSchema` | `z.array(ConferenceSchema)` — what `data/conferences.json` must satisfy |

Key field choices (see the file for the full annotated schema):

| Field | Type | Note |
|---|---|---|
| `id` | `string` | stable slug, e.g. `icra-2025` — used in detail-page URLs |
| `areas` | `[Area, ...Area[]]` | non-empty; a venue out of all three areas is dropped, never stored |
| `link` | `z.url()` | validated URL — the sync script repairs protocol-less links first |
| `deadlines` | `Deadline[]` | always ≥1 (entries with no actionable deadline are dropped) |
| `source` | `"ai-deadlines" \| "ccf-deadlines" \| "override"` | which feed supplied the record (highest-priority origin after merge) |
| `rank`, `hindex`, `place`, … | optional | not all venues carry them |

> Zod v4 note: we use the v4-only `z.iso.datetime()` and `z.url()` namespaces. On v3 these are `z.string().datetime()` / `z.string().url()`.

---

## 3. Verify

Nothing renders yet — this step is pure types. Confirm it compiles:

```bash
pnpm exec tsc --noEmit   # silent = good
```

You can also sanity-check the inferred type in any scratch file:

```ts
import type { Conference } from "@/types/conference";
//        ^? hover — should show the full object shape, not `any`
```

---

## 4. Commit

```bash
git add types/conference.ts
git commit -m "step 5: define Conference Zod schema + inferred types"

git add docs/ROADMAP.md docs/step5-conference-schema.md
git commit -m "docs: add step5 walkthrough"
```

---

## Done?

Report back with:

- Output of `pnpm exec tsc --noEmit` (should be silent)
- The list of exports your editor shows for `types/conference.ts`

Next: **Step 6** — the sync script that pulls the upstream feed, filters to our areas, merges `data/conferences.yml` overrides, and writes a `data/conferences.json` that satisfies `ConferencesSchema`.
