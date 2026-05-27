# Step 2: Install and initialize shadcn/ui

## What is shadcn/ui (and why we're using it)

`shadcn/ui` is **not** a component library you `import` from `node_modules`. It's a **CLI that copies source files into your repo**. You own the code — tweak colors, restructure props, delete what you don't need.

| | Traditional lib (MUI / Chakra) | shadcn/ui |
|---|---|---|
| Install | `pnpm add @mui/material` | `pnpm dlx shadcn@latest add button` |
| Lives in | `node_modules/` | `components/ui/` (your repo) |
| Customize | override via theme API | edit the file directly |
| Bundle | full lib, tree-shaken | only what you copied |
| Styling | runtime CSS-in-JS | Tailwind classes (compiled) |

For arc-conf this means: conference cards, filter dropdowns, theme toggles, etc. live as plain `.tsx` files we can shape exactly to our deadline-tracking use case.

---

## Prerequisites

- Step 1 complete (Next.js 16 app runs at `localhost:3000`).
- Tailwind v4 already configured (it was set up by `create-next-app`).
- `pnpm -v` works.

---

## 1. Run the initializer

From the project root:

```bash
cd ~/Alwin-Yang/arc-conf
pnpm dlx shadcn@latest init
```

> `pnpm dlx` = "download + execute, don't keep it around" (same as `npx`). The CLI is a one-shot tool, no need to install it as a dependency.

### 1.0 Why no `-t next` flag?

The official shadcn docs show three install paths — pick the one that matches your situation:

| Scenario | Command | What it does |
|---|---|---|
| Use a visual preset from shadcn/create | `pnpm dlx shadcn@latest init --preset [CODE] --template next` | scaffolds a **new** Next.js project from a preset |
| Scaffold a fresh project from the CLI | `pnpm dlx shadcn@latest init -t next` | creates a **new** Next.js project and wires shadcn into it |
| **Add shadcn to an existing project** ← us | `pnpm dlx shadcn@latest init` | only writes `components.json` / `lib/utils.ts` / updates `globals.css` in the current directory |

We completed `create-next-app` in Step 1, so we're in the third row — **no `-t` flag**. Adding `-t next` here would try to scaffold a second project on top of ours.

### 1.1 Peer-dependency warning (React 19 / Next 16)

shadcn pulls in Radix UI primitives. Some Radix packages still declare `react@^18` as a peer dep, so you may see:

```
WARN  Issues with peer dependencies found
└─┬ @radix-ui/react-slot
  └── ✕ unmet peer react@^18: found 19.2.4
```

**Ignore it.** Radix works fine with React 19 (the new JSX runtime is backward-compatible); the maintainers just haven't bumped the `peerDependencies` range in every sub-package. If pnpm refuses to install, re-run with:

```bash
pnpm dlx shadcn@latest init --force
```

---

## 2. Answer the interactive prompts

| Prompt | Answer | Reason |
|---|---|---|
| Which style would you like to use? | **New York** | tighter spacing, better for dense data tables (deadline lists) |
| Which color would you like to use as base color? | **Neutral** | clean grayscale base; we'll add accents per-area (CV / NLP / Robotics) later |
| Would you like to use CSS variables for theming? | **Yes** | required for dark-mode toggle in Step 10 |

> If the CLI asks about a `src/` directory or import alias, accept defaults — they match what we picked in Step 1 (no `src/`, `@/*` alias).

---

## 3. What the CLI changed

After it finishes, inspect the diff:

```bash
git status
```

You should see:

| File | Purpose |
|---|---|
| `components.json` | shadcn config — style, base color, alias paths. Used by `shadcn add` later. |
| `lib/utils.ts` | exports `cn()` — a `clsx` + `tailwind-merge` helper used by every shadcn component |
| `app/globals.css` | **rewritten** — replaces the old `:root` / `@theme inline` block with the full shadcn CSS-variable token system (light + dark) |
| `package.json` | adds `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css` |

### 3.1 Sanity-check `globals.css`

Open `app/globals.css` — it should now start with something like:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ...lots of design tokens... */
}

.dark {
  --background: oklch(0.145 0 0);
  /* ... */
}
```

The `oklch()` color space and `@custom-variant` directive are Tailwind v4 / shadcn-2026 conventions — don't be alarmed.

### 3.2 Sanity-check `components.json`

```bash
cat components.json
```

Should contain:

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

The empty `"config": ""` is correct for Tailwind v4 (no `tailwind.config.ts` file — config lives in `globals.css` via `@theme`).

---

## 4. Add a test component

Add a `Button` to confirm the pipeline works end-to-end:

```bash
pnpm dlx shadcn@latest add button
```

This creates `components/ui/button.tsx`. Wire it into the landing page so you can see it:

Edit `app/page.tsx` and replace its contents with a minimal smoke test:

```tsx
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">arc-conf</h1>
      <p className="text-muted-foreground">shadcn/ui is wired up.</p>
      <div className="flex gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </main>
  );
}
```

> We can revert this file in Step 7 when we build the real deadline list — for now it's just a "does the theme work?" probe.

---

## 5. Verify

```bash
pnpm dev
```

Open <http://localhost:3000>. You should see:

- The "arc-conf" heading in the **theme foreground color** (near-black on light, near-white on dark)
- Four buttons with **distinct variant styling** (filled / muted / bordered / red)
- Hovering a button produces a subtle color transition (proves `tw-animate-css` loaded)
- Toggling your OS to dark mode flips the page colors (proves CSS variables work)

Stop the dev server with `Ctrl+C`.

### Type-check

```bash
pnpm exec tsc --noEmit
```

Should exit with no errors. If you see `Cannot find module '@/components/ui/button'`, the alias didn't resolve — check `tsconfig.json` still has `"paths": { "@/*": ["./*"] }`.

---

## 6. Commit the baseline

```bash
git add components.json lib/ components/ app/globals.css app/page.tsx package.json pnpm-lock.yaml
git commit -m "step 2: init shadcn/ui (new-york, neutral) + button smoke test"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find Tailwind config` during `init` | CLI looking for v3 `tailwind.config.ts` | We're on v4 — answer prompts as above, the CLI handles v4 natively in recent versions. Update with `pnpm dlx shadcn@latest init` if you get an old version cached. |
| Buttons render unstyled (plain `<button>` look) | `globals.css` not imported by `app/layout.tsx` | Confirm `import "./globals.css";` is the first line of `app/layout.tsx` |
| `oklch is not a function` in browser console | Browser too old (pre-2023) | Use Chrome ≥ 111, Firefox ≥ 113, Safari ≥ 15.4 |
| Peer-dep errors block install | strict pnpm config | Re-run with `--force`, or add `"strict-peer-dependencies=false"` to `.npmrc` |

---

## Done?

Report back with:

- Output of `git status` after step 3
- Screenshot (or description) of the four buttons on `localhost:3000`
- Any peer-dep warnings you ignored

Then we'll move on to **Step 3: Add core dependencies** (`date-fns-tz`, `js-yaml`, `zod`, `next-themes`).
