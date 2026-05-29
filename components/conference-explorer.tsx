"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DeadlineCard } from "@/components/deadline-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AREA_LABELS,
  RANK_TIERS,
  coreTier,
  type Area,
  type Conference,
  type Deadline,
} from "@/lib/conference-utils";

type Item = { conference: Conference; next: Deadline | null };

const ALL = "all";
const AREA_OPTIONS = Object.keys(AREA_LABELS) as Area[];

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM" (UTC)
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ConferenceExplorer({ items }: { items: Item[] }) {
  // Filter state lives in component state (not useSearchParams) so the full
  // list prerenders into static HTML — useSearchParams would force a CSR
  // bailout and ship an empty page. We sync to the URL ourselves after mount.
  const [area, setArea] = useState(ALL);
  const [rank, setRank] = useState(ALL);
  const [month, setMonth] = useState(ALL);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("area")) setArea(p.get("area")!);
    if (p.get("rank")) setRank(p.get("rank")!);
    if (p.get("month")) setMonth(p.get("month")!);
  }, []);

  const writeUrl = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(window.location.search);
    if (value === ALL) p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, []);

  const setters: Record<string, (v: string) => void> = {
    area: setArea,
    rank: setRank,
    month: setMonth,
  };
  const setParam = useCallback(
    (key: string, value: string) => {
      setters[key]?.(value);
      writeUrl(key, value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [writeUrl],
  );

  const clearAll = useCallback(() => {
    setArea(ALL);
    setRank(ALL);
    setMonth(ALL);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const monthOptions = useMemo(() => {
    const keys = [
      ...new Set(items.filter((i) => i.next).map((i) => monthKey(i.next!.date))),
    ].sort();
    return keys.map((k) => ({ value: k, label: monthLabel(k) }));
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(({ conference, next }) => {
        if (area !== ALL && !conference.areas.includes(area as Area)) return false;
        if (rank !== ALL && coreTier(conference) !== rank) return false;
        // A specific month implies a known deadline, so TBA venues drop out.
        if (month !== ALL && (!next || monthKey(next.date) !== month)) return false;
        return true;
      }),
    [items, area, rank, month],
  );

  const hasFilters = area !== ALL || rank !== ALL || month !== ALL;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={area} onValueChange={(v) => setParam("area", v)}>
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All areas</SelectItem>
            {AREA_OPTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {AREA_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={rank} onValueChange={(v) => setParam("rank", v)}>
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="Rank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All ranks</SelectItem>
            {RANK_TIERS.map((r) => (
              <SelectItem key={r} value={r}>
                CORE {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={(v) => setParam("month", v)}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All months</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {filtered.length} {filtered.length === 1 ? "venue" : "venues"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No venues match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ conference, next }) => (
            <DeadlineCard key={conference.id} conference={conference} next={next} />
          ))}
        </div>
      )}
    </div>
  );
}
