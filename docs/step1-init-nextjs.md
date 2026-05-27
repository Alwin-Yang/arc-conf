# Step 1: Initialize the Next.js project

## Prerequisites

- **Node.js >= 20** (we'll install v22 LTS via `fnm`)
- **`pnpm`** (we'll enable it via `corepack`, Node's built-in package-manager manager)

> Modern stack (2026): **`fnm`** for Node version management (Rust-based, fast, replaces `nvm`) + **`corepack`** to pin `pnpm`. Entirely user-space, no `sudo` needed — same philosophy as `uv` in the Python world.

---

## 0. Install Node.js + pnpm (one-time setup)

Skip this section if `node -v` already prints `v20.x` or higher **and** `pnpm -v` works.

### 0.1 Install `fnm` (Fast Node Manager)

```bash
curl -fsSL https://fnm.vercel.app/install | bash
```

The installer adds `fnm` to your shell config (`~/.bashrc` or `~/.zshrc`). Reload it:

```bash
# bash
source ~/.bashrc
# or zsh
source ~/.zshrc
```

Verify:

```bash
fnm --version
```

### 0.2 Install Node.js 22 LTS

```bash
fnm install 22
fnm default 22
fnm use 22
```

Verify:

```bash
node -v   # v22.x.x
npm -v    # 10.x.x
```

### 0.3 Enable `pnpm` via `corepack`

`corepack` ships with Node — no extra download needed. It pins the `pnpm` version per-project via the `packageManager` field in `package.json`.

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Verify:

```bash
pnpm -v
```

---

## User-global vs project-local (mental model)

Sections `0.1`–`0.3` above install the **toolchain** once, into your home directory. The project's **local environment** is created later by `pnpm create next-app` (next section) and lives as `node_modules/` inside the project folder.

```
─────────────────────────────────────────────
  User-global  ← installed by 0.1 / 0.2 / 0.3
─────────────────────────────────────────────
  ~/.local/share/fnm/              fnm + all Node versions
  ~/.local/share/pnpm/store/       pnpm content-addressable store
  ~/.bashrc                        shell startup hooks

  Installed once, shared across all projects.
  No sudo, no system pollution.

─────────────────────────────────────────────
  Project-local  ← created by `pnpm create next-app .`
─────────────────────────────────────────────
  ~/Alwin-Yang/arc-conf/
  ├── package.json                 declared dependencies
  ├── pnpm-lock.yaml               exact version lock
  ├── node_modules/                this project's deps
  │                                (hard-linked into the global store)
  ├── .nvmrc                       (optional) pinned Node version
  └── app/ public/ ...             your code

  One per project. `rm -rf` the folder = fully gone.
```

**Python analogy** (for intuition):

| Layer | Python | Node (this setup) |
|---|---|---|
| Runtime version manager | `uv` / `pyenv` | **`fnm`** (0.1) |
| Runtime itself | `python3.12` | **Node v22** (0.2) |
| Package manager | `uv` / `pip` | **`pnpm`** (0.3) |
| **Project-local env** | `.venv/` + `pyproject.toml` | **`node_modules/` + `package.json`** (next section) |

> No `activate` step needed — `cd` into a Node project and tools automatically resolve `./node_modules/`.

---

## Run the installer

> ⚠️ Recent versions of `create-next-app` **refuse** to run if the target directory contains conflicting files (e.g. `README.md`). It no longer prompts "directory is not empty, continue?". Move conflicting files aside first.
>
> The installer has a built-in allow-list — `LICENSE`, `.gitignore`, `.git/`, `docs/`, etc. are tolerated. That's why we use `docs/` (not `note/`) for our walkthrough files: it bypasses the conflict check. The installer merges `.gitignore` automatically.

### Step A — Move conflicting files aside

```bash
cd ~/Alwin-Yang/arc-conf
mv README.md ../arc-conf-README.md.bak
```

(`LICENSE`, `.gitignore`, and `docs/` are on the allow-list — leave them in place.)

### Step B — Run the installer

```bash
pnpm create next-app@latest .
```

The trailing `.` means "initialize in the current directory". Answer the interactive prompts using the table in the next section.

### Step B.1 — Approve native build scripts (pnpm v10+)

After the installer finishes, pnpm v10+ aborts with:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: sharp@0.34.5, unrs-resolver@1.12.2
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
Aborting installation.
```

This is pnpm's supply-chain protection — third-party `postinstall` scripts are blocked by default. We need to whitelist the two native packages Next.js relies on:

- **`sharp`** — image processing for `<Image>` (native libvips bindings)
- **`unrs-resolver`** — Rust-based module resolver used by Next 16

```bash
pnpm approve-builds
```

In the interactive UI:

1. Use **↑ / ↓** to move
2. **Press `<space>`** on each of `sharp` and `unrs-resolver` to **select** them (a `●` appears)
   - ⚠️ **Don't just hit Enter without selecting** — that adds them to the *deny* list (you'll see "No items were selected"). If this happens, edit `pnpm-workspace.yaml` and replace its contents with:

     ```yaml
     onlyBuiltDependencies:
       - sharp
       - unrs-resolver
     ```
3. **Enter** to confirm
4. When asked `Do you approve?` → **`y`**

Then re-run install to actually execute the now-allowed build scripts:

```bash
pnpm install
```

Verify the native binary was built:

```bash
find node_modules/.pnpm -name "sharp-linux-x64.node" 2>/dev/null
```

Should print a path like `node_modules/.pnpm/@img+sharp-linux-x64@0.34.5/.../sharp-linux-x64.node`.

### Step C — Restore your files

Our project README has real content (project intro, features, tech stack), so we **keep ours and discard Next's generated boilerplate README**:

```bash
mv README.md README.nextjs-boilerplate.md       # park Next's generic README for reference
mv ../arc-conf-README.md.bak ./README.md        # restore ours as the main README
```

Optionally, peek inside `README.nextjs-boilerplate.md` for the standard "How to run / deploy" snippets and merge any useful parts into our `README.md`, then delete it:

```bash
rm README.nextjs-boilerplate.md
```

## Answer the interactive prompts

| Prompt | Answer | Reason |
|---|---|---|
| Would you like to use TypeScript? | **Yes** | type safety for conference schema |
| Would you like to use ESLint? | **Yes** | catches bugs early |
| Would you like to use Tailwind CSS? | **Yes** | required by shadcn/ui |
| Would you like your code inside a `src/` directory? | **No** | shadcn defaults assume no `src/` |
| Would you like to use App Router? | **Yes** | modern Next.js, supports static export |
| Would you like to use Turbopack for `next dev`? | **Yes** | faster dev server |
| Would you like to use React Compiler? | **No** | auto-memoization; not needed for a small static site, can enable later in `next.config.ts` |
| Would you like to include `AGENTS.md` to guide coding agents? | **Yes** | standardized context file read by Cursor / Claude / Codex etc., maintained with current Next.js best practices |
| Would you like to customize the import alias? | **No** | default `@/*` works with shadcn |

---

## Verify

After the installer finishes:

1. Check the generated files:
```bash
ls -la
```

   You should see `app/`, `public/`, `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts` (or inline in `postcss.config.mjs` for Tailwind v4), `.gitignore`, etc.

2. Start the dev server:
```bash
pnpm dev
```

3. Open <http://localhost:3000> — you should see the default Next.js welcome page.

4. Stop the dev server with `Ctrl+C` when done.

---

## Done?

Report back with:

- Any errors during install
- Output of `ls -la` after install
- Whether the dev page loaded at `http://localhost:3000`

Then we'll move on to **Step 2: Install and initialize shadcn/ui**.
