# Step 6: Build the data sync script (dual-source)

This is the data layer's workhorse. It runs **at build time only** (never in the browser) and turns several messy inputs into one clean, validated file:

```
ai-deadlines      ─┐  (auxiliary: areas + gap-fill)
ccf-deadlines     ─┼─►  scripts/sync-conferences.ts  ─►  data/conferences.json
conferences.yml   ─┤  (full per-venue overrides)
areas.yml         ─┘  (area-only override, highest priority)
```

ccf-deadlines is the **primary** data source; ai-deadlines is **auxiliary** (it
classifies areas and fills venue-years ccf doesn't track); `conferences.yml`
overrides win over both; `areas.yml` overrides the area classification above
everything.

> **Source vs. generated.** The `*.yml` files are **hand-maintained source**;
> `data/conferences.json` is a **generated build artifact** — every `pnpm sync`
> rewrites it from scratch. Never hand-edit the JSON (changes are lost on the
> next sync). To change data: edit the YAML, then run `pnpm sync`.

Per the Step 4 boundary rules, build-time Node scripts live in `scripts/`, raw curated data in `data/*.yml`, and generated data in `data/*.json`.

---

## 1. Run it

```bash
pnpm sync
```

Expected output:

```
→ fetching ai-deadlines…
  188 venues (area authority)
→ fetching ccf-deadlines (conference/AI)…
  170 venue-years
→ 3 override(s)
✓ wrote 306 conferences → data/conferences.json
  by source: {"ai-deadlines":133,"ccf-deadlines":170,"override":3}
```

The `sync` script is `tsx scripts/sync-conferences.ts`. We use **`tsx`** (a devDependency) to run the TypeScript directly — no separate compile step, and it resolves the `@/types` import the same way Next does.

> First run only: `tsx` pulls in `esbuild`, whose post-install build is gated by pnpm. If you see `Ignored build scripts: esbuild`, allow it (add `esbuild` under `onlyBuiltDependencies` in `pnpm-workspace.yaml`, then `pnpm install`).

---

## 2. The three sources

| Source | Role | What it uniquely provides |
|---|---|---|
| [`ccfddl/ccf-deadlines`](https://github.com/ccfddl/ccf-deadlines) | **Primary** | CCF/CORE rankings, recent conference years, authoritative deadlines + multi-round timelines |
| [`paperswithcode/ai-deadlines`](https://github.com/paperswithcode/ai-deadlines) | **Auxiliary** | `sub` codes (RO, ML, CV, …) — the *only* signal for whether a venue is robotics vs. ai; also gap-fills venue-years ccf doesn't track |
| `data/conferences.yml` | **Overrides** | venues neither feed tracks (RA-L, control conferences); full per-venue records |
| `data/areas.yml` | **Area override (highest)** | a `title → areas` map that *replaces* the inferred areas for a venue, across both feeds and all years — without re-specifying the whole venue |

### 2.1 Why two upstreams?

They complement each other almost perfectly:

- **ccf-deadlines** is the primary feed: it has **CCF/CORE ranks**, is more current (e.g. it already lists ICRA 2026), and models **multi-round timelines** (`abstract_deadline` + `deadline` + `comment` per timeline item). On any overlapping field — including the deadline set — ccf wins over ai-deadlines. Its own `sub` is always the generic `AI`, so it can't tell us robotics from ml on its own.
- **ai-deadlines** is auxiliary: it tags each venue with a `sub` code, so it's the only place we learn ICRA is *robotics* and CVPR is *ai*, and it fills in venues/years ccf doesn't track. But it carries **no ranking** and its data yields to ccf on conflict.

So ccf-deadlines is authoritative for *rank*, *deadlines*, and *recent years*; ai-deadlines only decides *areas* and gap-fills; overrides win over both.

### 2.2 How areas are resolved for ccf entries

ccf has no robotics sub, so the script:

1. Builds a `title → areas` dictionary from the normalized ai-deadlines data (ICRA appears there as `RO` ⇒ robotics).
2. Layers a small hand-kept `TITLE_AREA` map for venues ai-deadlines doesn't cover (`CDC`, `ACC`, `L4DC`, `RA-L`, …).
3. Falls back to `["ai"]` for any other ccf venue (it's in the CCF "AI" category, after all).

This is why a ccf-only year like **ICRA 2026** still lands in `robotics` — the title dictionary learned it from ai-deadlines' 2025 entry.

### 2.3 `data/areas.yml` — the area override of last resort

ai-deadlines' `sub` codes leak. A flagship like AAAI carries a `RO` sub (it *has*
a robotics track), so the naive mapping drops it into `robotics` alongside ICRA.
`data/areas.yml` is a tiny hand-curated `title → areas` map that **fully replaces**
the inferred areas for a title — for **both feeds, every year** — without having
to re-author the whole venue in `conferences.yml`.

```yaml
AAAI: [ai]      # has a RO sub upstream; pin it to its real home
ICLR: [ai]
AAMAS: [ai]
```

It's the highest-priority area signal: in both code paths the script checks
`AREA_OVERRIDES` (loaded from `areas.yml`) **first** and, if present, uses it
verbatim — skipping the `sub`/`TITLE_AREA` logic entirely.

**Classification principle — tag the *center of gravity*, not every track.**
A venue's `areas` is its *community / home turf*, not the union of every topic
its CFP accepts. Almost every flagship has cross-cutting tracks (AAAI/ICML take
robotics papers; AAMAS touches control), so "tag what it accepts" would collapse
everything into `[ai, robotics, control]` and the area filter would carry no
signal. Add an area only if that community treats the venue as a *home venue to
submit to*:

| Venue | areas | why |
|---|---|---|
| ICRA / IROS / RSS / CoRL | `[robotics]` | robot-first |
| CDC / ACC / ECC | `[control]` | control-first |
| AAAI / ICML / ICLR / AAMAS | `[ai]` | general AI; a RO/control *track* ≠ a home |
| L4DC | `[control, ai]` | genuine learning-for-control bridge |
| RA-L | `[robotics, control]` | Robotics *and* Automation |

Fine-grained "this AI venue also has a robotics track" info isn't lost — it stays
in each record's `tags` (the raw `sub` codes), so a future track-level filter can
surface it without polluting `areas`.

> When fixing a misclassification, prefer `areas.yml` over `TITLE_AREA`:
> `TITLE_AREA` only affects the ccf path and *merges* (union), so it can't undo a
> `sub` leak on the ai path; `areas.yml` *replaces* on both paths.

---

## 3. The pipeline

| Stage | Detail |
|---|---|
| **Fetch ai** | `GET` the raw `ai-deadlines` YAML (gh-pages branch). |
| **Normalize ai** | Map each entry → `Conference`; drop venues whose `sub` maps to no area (e.g. HCI-only) or that have no deadline. Build the title→areas dictionary. |
| **Fetch ccf** | List `conference/AI/*.yml` via one GitHub contents API call, then fetch each file's `download_url` (these point at raw.githubusercontent — **no API rate limit**). |
| **Normalize ccf** | Flatten `confs[].timeline[]` into deadlines (an item may yield both an abstract and a paper deadline); resolve areas; map `rank`. |
| **Overrides** | Read `data/conferences.yml`, normalize the same way. |
| **Merge** | Index by slug id; upsert in ascending priority **ai (auxiliary) < ccf (primary) < override**, field-merging on collision. |
| **Validate + write** | Sort by primary (paper) deadline, `ConferencesSchema.parse(...)`, write pretty JSON. |

### 3.1 Merge rules (`mergeConf`)

When the same `id` appears in multiple sources, the higher-priority record wins, but enrichment is preserved:

| Field | Rule |
|---|---|
| `areas`, `tags` | **union** of both |
| `rank`, `hindex`, `fullName`, `place`, `note`, … | incoming if present, else keep base |
| `deadlines` | the **higher-priority source** wins (ccf over ai, override over both); the lower-priority set is kept only when the higher-priority source has no deadlines |
| `source` | the higher-priority origin |

### 3.2 Timezone normalization (the subtle part)

Both feeds use a grab-bag of zone labels — `UTC-12` / `AoE` (Anywhere-on-Earth), `GMT`, `America/Los_Angeles`, … `date-fns-tz`'s `fromZonedTime` only understands IANA zones, so `toIana()` maps them:

| Label | IANA | Gotcha |
|---|---|---|
| `UTC-12`, `AoE` | `Etc/GMT+12` | **Sign flips** — POSIX `Etc/GMT` zones invert the offset |
| `UTC+1` | `Etc/GMT-1` | same flip |
| `GMT`, `UTC` | `Etc/GMT` | — |
| `America/Los_Angeles` | *(unchanged)* | already IANA |

`toUtcIso()` then parses the loose wall-clock string, re-emits a strict `yyyy-mm-ddThh:mm:ss`, and converts to a UTC ISO instant. Each `Deadline` stores that instant **plus** the original `localTime` and `timezone` (Step 5 §1.2).

### 3.3 Defensive normalization

- Links without a protocol get `https://` prepended (`z.url()` would reject otherwise).
- `TBA`/`TBD`/empty deadlines are skipped; a conference left with zero deadlines is dropped.
- ccf timeline comments like *"submission open"* are dropped (an opening date isn't a deadline); comments mentioning *abstract / rebuttal / camera / supplementary* set the deadline `type`.
- CCF/CORE rank value `N` (unranked) is treated as no rank.

Anything it *can't* safely repair throws and fails the build — better a red build than silently wrong deadlines.

---

## 4. The overrides file

`data/conferences.yml` is where you add what neither feed tracks. Each entry uses a small raw format the script normalizes:

```yaml
- id: ral-2026
  title: RA-L
  year: 2026
  link: https://www.ieee-ras.org/publications/ra-l
  areas: [robotics, control]
  rank: Q1
  timezone: UTC-12          # entry-level default for the deadlines below
  deadlines:
    - type: paper
      time: "2025-09-01 23:59:59"   # `time` = as-published wall clock
      label: ICRA 2026 presentation option
```

Rules: an entry **wins** over the merged feeds for a matching `id` (or is added if new); a deadline's `timezone` falls back to the entry-level `timezone`; `areas` are explicit (overrides can introduce `control`, which no feed has).

Seed entries: **RA-L** (multi-cycle / ICRA-IROS linkage), **L4DC**, **CDC** — dates hand-curated, verify against each official CFP.

---

## 5. Committing the generated JSON

We **commit** `data/conferences.json` (it's not git-ignored) so the site builds without anyone running `pnpm sync` first, and so diffs act as a human-readable deadline changelog. Step 13's GitHub Action will re-run `pnpm sync` daily.

---

## 6. Verify

```bash
pnpm sync                 # regenerates data/conferences.json
pnpm exec tsc --noEmit    # script + schema typecheck clean
```

Spot-check the merge:

```bash
node -e "const c=require('./data/conferences.json');
  const f=id=>c.find(x=>x.id===id);
  console.log('icra-2026', f('icra-2026')?.areas, f('icra-2026')?.rank);
  console.log('with rank:', c.filter(x=>x.rank).length, '/', c.length);"
```

Sanity checks:

1. `icra-2025` is `robotics` (from ai) **and** carries a rank (from ccf) — proof the merge worked.
2. `icra-2026` (ccf-only year) is still `robotics` — proof the title dictionary worked.
3. A `UTC-12`/`AoE` deadline at `23:59:59` becomes `…T11:59:59.000Z` the next day.
4. Override entries (RA-L, L4DC, CDC) are present with `source: "override"`.

---

## 7. Commit

```bash
git add scripts/sync-conferences.ts data/conferences.yml data/areas.yml data/conferences.json \
        types/conference.ts package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "step 6: dual-source data sync (ai-deadlines + ccf-deadlines + overrides)"

git add docs/ROADMAP.md docs/step5-conference-schema.md docs/step6-data-sync.md
git commit -m "docs: update step5/step6 walkthroughs for dual-source sync"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Ignored build scripts: esbuild` | pnpm gates `tsx`'s native dep | Allow `esbuild` in `pnpm-workspace.yaml` → `pnpm install` |
| `ccf dir listing failed: 403` | GitHub API rate limit (60/hr unauth) | Wait, or set `GITHUB_TOKEN` and add an `Authorization` header to the dir fetch |
| `… fetch failed: 404` | a feed moved its file/branch | Re-check the raw URL + default branch |
| `Unparseable deadline "…"` | a date format the regex misses | Extend the parser in `toUtcIso()` |
| A venue lands in the wrong area | a `sub` code leaks (e.g. AAAI's `RO`), or it's ccf-only and unmapped | Pin it in `data/areas.yml` (replaces, both feeds) — preferred; or add to `TITLE_AREA` (ccf path only, merges) |
| Edited a `*.yml` but the site/JSON didn't change | `conferences.json` is generated, not read from YAML at runtime | Re-run `pnpm sync` to regenerate it (a plain `pnpm build` won't) |

---

## Done?

Report back with:

- The `pnpm sync` summary (`✓ wrote N` + the by-source counts)
- One merged entry where ai supplied the area and ccf supplied the rank
- `pnpm exec tsc --noEmit` clean

Next: **Phase 3 / Step 7** — the deadline list page that reads `data/conferences.json`, renders countdown cards, and wires up area / rank / month filters.
