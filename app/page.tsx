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
