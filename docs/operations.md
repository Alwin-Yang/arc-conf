# Operations — common commands & workflows

A quick reference for running arc-conf day to day. This project uses **pnpm**
(there's a `pnpm-lock.yaml`, not a `package-lock.json`). Don't mix in `npm` /
`yarn` — they'd create a conflicting lockfile and dependency tree.

---

## 0. First-time setup

```bash
pnpm install
```

> On the first install, pnpm gates native post-install scripts. The ones this
> project needs (`esbuild`, `sharp`, `unrs-resolver`) are already allow-listed in
> `pnpm-workspace.yaml` (`onlyBuiltDependencies`). If you ever see
> `Ignored build scripts: …`, add the package there and re-run `pnpm install`.

---

## 1. The everyday commands

| Command | What it does | When to run |
|---|---|---|
| `pnpm dev` | Start the Next.js dev server (hot reload) at `http://localhost:3000` | While developing the UI |
| `pnpm sync` | Regenerate `data/conferences.json` from the upstream feeds + your YAML overrides | After editing any `data/*.yml`, or to pull fresh upstream deadlines |
| `pnpm build` | Production build (`next build`) | Before deploy / to verify the build is clean |
| `pnpm start` | Serve the production build locally | To smoke-test the built site |
| `pnpm lint` | Run ESLint | Before committing |
| `pnpm exec tsc --noEmit` | Typecheck the whole project (no output files) | After touching types / the sync script |

---

## 2. The data flow (important)

```
data/*.yml  (hand-maintained SOURCE)
     │   pnpm sync
     ▼
data/conferences.json  (GENERATED build artifact — read by the app)
     │   pnpm build
     ▼
the static site
```

- **`data/conferences.yml`** and **`data/areas.yml`** are the source you edit by hand.
- **`data/conferences.json`** is generated. **Never hand-edit it** — `pnpm sync`
  rewrites it from scratch every time.
- The app reads the **JSON**, not the YAML. So:

> **Editing a `*.yml` and only running `pnpm build` changes nothing.**
> You must run `pnpm sync` first to regenerate the JSON.

See [`step6-data-sync.md`](./step6-data-sync.md) for how the sync merges its
sources and resolves conference areas.

---

## 3. Common workflows

### Update / add conference data

```bash
# 1. edit data/conferences.yml (add a venue, fix a deadline, …)
#    or data/areas.yml (fix an area classification)
pnpm sync                 # 2. regenerate data/conferences.json
pnpm dev                  # 3. verify it looks right locally
```

### Refresh upstream deadlines

`pnpm sync` always pulls the latest from ai-deadlines + ccf-deadlines, so just:

```bash
pnpm sync
git diff data/conferences.json   # the diff is a human-readable deadline changelog
```

### Fix a conference's area classification

Pin it in `data/areas.yml` (highest-priority, replaces on both feeds):

```yaml
AAAI: [ai]      # stop a RO-tagged AI venue leaking into robotics
```

Then `pnpm sync`. (See the classification principle in `step6-data-sync.md` §2.3.)

### Ship a change

```bash
pnpm sync                 # if data changed
pnpm lint
pnpm exec tsc --noEmit
pnpm build                # must be clean
```

---

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Edited a `*.yml` but nothing changed | the app reads the generated JSON | `pnpm sync` |
| `Ignored build scripts: esbuild` | pnpm gates native deps | allow-list it in `pnpm-workspace.yaml`, `pnpm install` |
| `ccf dir listing failed: 403` | GitHub API rate limit (60/hr unauth) | wait, or set `GITHUB_TOKEN` |
| A venue is in the wrong area | a `sub` code leaked, or it's unmapped | pin it in `data/areas.yml` |
| Lockfile / phantom dep weirdness | `npm`/`yarn` got mixed in | delete stray `package-lock.json`/`yarn.lock`, `pnpm install` |
