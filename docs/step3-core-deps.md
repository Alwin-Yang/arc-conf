# Step 3: Add core dependencies

Four small libraries that the rest of the roadmap leans on. We install them all in one go, then write a tiny smoke test per lib so we know the wiring is right before we build real features on top.

| Package | Role | Used in step |
|---|---|---|
| `date-fns` + `date-fns-tz` | Lightweight, tree-shakable date math + time-zone conversion (AoE ↔ Munich ↔ local) | 7, 10, 11 |
| `js-yaml` | Parse the upstream `paperswithcode/ai-deadlines` YAML | 6 |
| `zod` | Runtime schema validation for the merged `Conference` JSON | 5, 6 |
| `next-themes` | Dark-mode toggle that survives SSR / static export | 10 |

---

## 1. Install

Production deps + type definitions for the only non-typed lib (`js-yaml`):

```bash
pnpm add date-fns date-fns-tz js-yaml zod next-themes
pnpm add -D @types/js-yaml
```

> Why split: `date-fns`, `zod`, `next-themes` ship their own `.d.ts`. `js-yaml` is plain JS — types live in `@types/js-yaml` (DefinitelyTyped), which we only need at compile time, hence `-D`.

Verify they landed in `package.json`:

```bash
grep -E 'date-fns|js-yaml|zod|next-themes' package.json
```

Expected new lines:

```jsonc
"dependencies": {
  "date-fns": "^4.x",
  "date-fns-tz": "^3.x",
  "js-yaml": "^4.x",
  "next-themes": "^0.4.x",
  "zod": "^4.x",
  ...
},
"devDependencies": {
  "@types/js-yaml": "^4.x",
  ...
}
```

> Exact `^x` ranges depend on what npm serves the day you install — don't pin manually.

---

## 2. Why each pick (and what we rejected)

### `date-fns` + `date-fns-tz` vs `dayjs`, `luxon`, `Temporal`

| Option | Why not |
|---|---|
| `moment` | Deprecated, huge bundle. Hard pass. |
| `dayjs` | Smaller, but TZ plugin's DST handling has long-standing edge cases that hurt AoE → Munich conversions. |
| `luxon` | Excellent, but ~70 kB min+gz vs date-fns' ~10 kB tree-shaken. Overkill for a static site. |
| native `Intl` / `Temporal` | `Temporal` not yet baseline-stable in 2026 browsers. Re-evaluate at Step 14. |
| **`date-fns` + `date-fns-tz`** ← pick | Per-function imports → smallest bundle. IANA TZ via `Intl` under the hood. Pure functions = trivial to unit-test deadline math. |

### `js-yaml` vs `yaml`

Both are fine. `js-yaml` has 10× the weekly downloads, simpler API for our read-only use, and pairs naturally with `@types/js-yaml`. We only parse YAML at **build time** (Step 6) — it never ships to the browser.

### `zod` v4 vs `valibot` / `arktype`

`valibot` is smaller but has a smaller ecosystem; `arktype` is fast but still pre-1.0. **Zod 4** (released 2025) gives us:

- Bundle-friendly per-schema imports
- `z.discriminatedUnion` for cleanly modeling `Conference` variants (single-deadline vs RA-L-style multi-cycle)
- Native `z.infer<>` → no duplicate TS types

### `next-themes` vs hand-rolled

A 2 kB lib that solves three real problems: FOUC on first paint, SSR/SSG-safe class injection, and `localStorage` persistence. Re-implementing it would be 50 lines of fragile script-tag-in-`<head>` code.

---

## 3. Wire up `next-themes`

This is the only lib that needs setup beyond `import { ... }`. Two files.

### 3.1 Create `components/theme-provider.tsx`

Create the empty file first, then open it in your editor and paste the snippet below:

```bash
touch components/theme-provider.tsx
```

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

> Wrapped (instead of importing `NextThemesProvider` directly) so we have one place to add app-wide defaults later (e.g. forced themes per route).

### 3.2 Use it in `app/layout.tsx`

**Do not rewrite the whole file** — `create-next-app` already put the font setup (`Geist`, `Geist_Mono`), `globals.css` import, and `metadata` in there, and we keep all of it. Make only these **four small changes** to the existing file:

1. **Add** one import near the top:

   ```tsx
   import { ThemeProvider } from "@/components/theme-provider";
   ```

2. **Add** `suppressHydrationWarning` to the `<html>` tag — `next-themes` mutates the class on first paint, and without this React will log a hydration mismatch:

   ```tsx
   <html lang="en" suppressHydrationWarning ...>
   ```

3. **Wrap** `{children}` inside `<body>` with the provider:

   ```tsx
   <body ...>
     <ThemeProvider
       attribute="class"
       defaultTheme="system"
       enableSystem
       disableTransitionOnChange
     >
       {children}
     </ThemeProvider>
   </body>
   ```

4. **(Optional)** Replace the default `metadata` with our project's name/description:

   ```tsx
   export const metadata: Metadata = {
     title: "arc-conf",
     description: "AI / Robotics / Control conference deadline tracker",
   };
   ```

The fonts, `className`, and everything else stay exactly as `create-next-app` wrote them.

| Prop | Why |
|---|---|
| `attribute="class"` | Adds `.dark` to `<html>` — matches the `@custom-variant dark (&:is(.dark *))` rule shadcn put in `globals.css` |
| `defaultTheme="system"` | Respects OS preference on first visit |
| `enableSystem` | Lets users pick "System" as an explicit option later |
| `disableTransitionOnChange` | Kills the half-second CSS transition flash when toggling — required UX nicety |

---

## 4. Smoke test all four libs in one page

Replace `app/page.tsx` with a small test harness that exercises every new dependency:

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import yaml from "js-yaml";
import { z } from "zod";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const ConferenceSchema = z.object({
  name: z.string(),
  deadline: z.iso.datetime(),
});

const SAMPLE_YAML = `
name: NeurIPS 2026
deadline: "2026-05-15T23:59:00Z"
`;

export default function Home() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [now, setNow] = useState<string>("");
  // `mounted` gate: useTheme() returns undefined on the server but a real value on
  // the client. Without this, the button label differs between SSR and the first
  // client render → React 19 throws a hydration mismatch. Render a stable
  // placeholder until after mount, then swap in the real theme.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        [
          ["AoE (UTC-12)", "Etc/GMT+12"],
          ["Munich",       "Europe/Berlin"],
          ["Local",        Intl.DateTimeFormat().resolvedOptions().timeZone],
        ]
          .map(([label, tz]) => `${label}: ${formatInTimeZone(d, tz, "yyyy-MM-dd HH:mm:ss zzz")}`)
          .join("\n"),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const parsed = ConferenceSchema.parse(yaml.load(SAMPLE_YAML));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">arc-conf · deps smoke test</h1>
        <Button
          variant="outline"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          Theme: {mounted ? theme : "…"} → click to flip
        </Button>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">date-fns-tz (live clock, 3 zones)</h2>
        <pre className="text-sm whitespace-pre-wrap">{now}</pre>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">js-yaml + zod (parse &amp; validate)</h2>
        <pre className="text-sm">{JSON.stringify(parsed, null, 2)}</pre>
      </section>
    </main>
  );
}
```

What this probes:

- **`date-fns-tz`**: live clock in AoE / Munich / local — DST and offset signs are easy to eyeball
- **`js-yaml`**: parses an inline YAML string into an object
- **`zod`**: validates it against a schema (throws loudly if the shape is wrong — useful tripwire)
- **`next-themes`**: button label updates immediately and `<html>` toggles `.dark`

---

## 5. Verify

```bash
pnpm exec tsc --noEmit       # no type errors
pnpm dev                     # http://localhost:3000
```

Open the page and check:

1. The clock section shows three rows, all the **same instant** rendered in three zones (e.g. AoE will be ~12 h behind Munich).
2. Seconds tick every second.
3. The JSON block shows `{ "name": "NeurIPS 2026", "deadline": "2026-05-15T23:59:00.000Z" }`.
4. Clicking the theme button flips light ↔ dark **without a flash**, button label updates, no console errors.
5. DevTools → Elements: `<html>` gains/loses `class="dark"` on toggle.

Stop the dev server with `Ctrl+C`.

---

## 6. Commit

```bash
git add app/page.tsx app/layout.tsx components/theme-provider.tsx \
        package.json pnpm-lock.yaml
git commit -m "step 3: add date-fns-tz, js-yaml, zod, next-themes + smoke test"

git add docs/ROADMAP.md docs/step3-core-deps.md
git commit -m "docs: add step3 walkthrough"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Hydration failed because the server rendered HTML didn't match…` on first load | Forgot `suppressHydrationWarning` on `<html>` | Add it — `next-themes` mutates the class before React hydrates, by design |
| Theme button label is empty for a tick on first paint | `useTheme()` returns `undefined` until mounted | Render `theme ?? "system"` or gate on a `mounted` flag (we'll formalize in Step 10) |
| `formatInTimeZone is not a function` | Imported from `date-fns` instead of `date-fns-tz` | Check the import path — both packages export `format*`, only `date-fns-tz` is TZ-aware |
| `z.iso.datetime is not a function` | You're on Zod **v3** — `z.iso` namespace is v4 | `pnpm add zod@latest` to get v4. If you must stay on v3, use `z.string().datetime()` instead |
| `Cannot find module 'js-yaml'` types | Missed the `-D @types/js-yaml` install | `pnpm add -D @types/js-yaml` |

---

## Done?

Report back with:

- Output of `pnpm exec tsc --noEmit` (should be silent)
- Whether the three clocks tick and the theme toggle flips classes
- Any unexpected console errors

Next: **Step 4** — configure static export (`output: "export"`) and lock in the project structure (`data/`, `lib/`, `components/`) before we start writing the data layer.
