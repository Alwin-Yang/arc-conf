/**
 * Build-time data sync (Step 6, dual-source).
 *
 *   pnpm sync
 *
 * Three sources, merged by a stable slug id with increasing priority:
 *
 *   1. ai-deadlines  (paperswithcode/ai-deadlines) — AUXILIARY. Its `sub`
 *      codes (RO, ML, CV, …) are the only place we learn whether a venue is
 *      robotics vs. ai, so it seeds a title→areas dictionary. It also fills in
 *      venue-years that ccf doesn't track. Lowest priority on data conflicts.
 *   2. ccf-deadlines (ccfddl/ccf-deadlines, conference/AI/*.yml) — PRIMARY
 *      data source. Authoritative for rankings, recent conference years,
 *      deadlines, and multi-round timelines. Its own `sub` is always "AI", so
 *      areas come from the ai-deadlines dictionary (+ a small manual map).
 *      Wins over ai-deadlines on every overlapping field, including deadlines.
 *   3. data/conferences.yml — hand-curated OVERRIDES (RA-L, control venues).
 *      Highest priority.
 *
 * Output: a sorted, schema-validated data/conferences.json.
 *
 * Runs only at build time under Node — never bundled to the client, so
 * `node:fs` and global `fetch` are fine here.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { fromZonedTime } from "date-fns-tz";
import {
  AREAS,
  ConferencesSchema,
  SUB_TO_AREA,
  DEADLINE_TYPES,
  type Area,
  type Conference,
  type Deadline,
  type DeadlineType,
} from "../types/conference";

const AI_DEADLINES_URL =
  "https://raw.githubusercontent.com/paperswithcode/ai-deadlines/gh-pages/_data/conferences.yml";
const CCF_AI_DIR_API =
  "https://api.github.com/repos/ccfddl/ccf-deadlines/contents/conference/AI";

/**
 * Robotics / control venues whose area can't be inferred from ai-deadlines
 * (either absent there, or only ever tagged a generic ai sub). Keyed by
 * UPPERCASE title. ai-deadlines is only the auxiliary area classifier; this
 * fills gaps for ccf-only years and control conferences from overrides.
 */
const TITLE_AREA: Record<string, Area[]> = {
  ICRA: ["robotics"],
  IROS: ["robotics"],
  RSS: ["robotics"],
  CORL: ["robotics"],
  "RA-L": ["robotics", "control"],
  "RO-MAN": ["robotics"],
  HRI: ["robotics"],
  WAFR: ["robotics"],
  HUMANOIDS: ["robotics"],
  CDC: ["control"],
  ACC: ["control"],
  ECC: ["control"],
  IFAC: ["control"],
  L4DC: ["control", "ai"],
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES_PATH = join(ROOT, "data", "conferences.yml");
const AREAS_PATH = join(ROOT, "data", "areas.yml");
const OUTPUT_PATH = join(ROOT, "data", "conferences.json");

/**
 * Hand-curated title→areas map (data/areas.yml). When a title is present here,
 * these areas fully REPLACE whatever ai-deadlines inferred from `sub` codes,
 * for every year and from both feeds. Keyed by UPPERCASE title. This is how you
 * correct ai-deadlines' classification without re-specifying a whole venue.
 */
function loadAreaOverrides(): Map<string, Area[]> {
  const map = new Map<string, Area[]>();
  if (!existsSync(AREAS_PATH)) return map;
  const raw = yaml.load(readFileSync(AREAS_PATH, "utf8"));
  if (!raw || typeof raw !== "object") return map;
  const valid = new Set<string>(AREAS);
  for (const [title, value] of Object.entries(raw as Record<string, unknown>)) {
    const areas = (Array.isArray(value) ? value : [value])
      .map(String)
      .filter((a) => valid.has(a)) as Area[];
    if (areas.length === 0) {
      throw new Error(
        `data/areas.yml: "${title}" has no valid area (use one of ${AREAS.join(", ")})`,
      );
    }
    map.set(title.toUpperCase(), [...new Set(areas)]);
  }
  return map;
}

const AREA_OVERRIDES = loadAreaOverrides();

// --- timezone normalization ------------------------------------------------

/** Map assorted upstream zone labels onto something date-fns-tz understands. */
function toIana(tz: string): string {
  const raw = (tz ?? "").trim();
  if (!raw) return "UTC";
  if (raw === "AoE") return "Etc/GMT+12";
  if (raw === "GMT" || raw === "UTC") return "Etc/GMT";
  if (raw === "CET") return "Europe/Paris";
  const offset = raw.match(/^UTC([+-])(\d{1,2})$/);
  if (offset) {
    // POSIX Etc/GMT zones invert the sign: UTC-12 (AoE) → Etc/GMT+12.
    const flipped = offset[1] === "+" ? "-" : "+";
    return `Etc/GMT${flipped}${Number(offset[2])}`;
  }
  return raw; // assume already-IANA, e.g. "America/Los_Angeles"
}

/** Convert a loose wall-clock string in `tz` to an absolute UTC ISO instant. */
function toUtcIso(localTime: string, tz: string): string {
  const m = localTime
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    throw new Error(`Unparseable deadline "${localTime}" (tz "${tz}")`);
  }
  const [, y, mo, d, hh = "23", mm = "59", ss = "59"] = m;
  const pad = (n: string) => n.padStart(2, "0");
  const iso = `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  const instant = fromZonedTime(iso, toIana(tz));
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Unparseable deadline "${localTime}" (tz "${tz}")`);
  }
  return instant.toISOString();
}

// --- generic helpers -------------------------------------------------------

function normalizeLink(link: string): string {
  const raw = (link ?? "").trim();
  if (!raw) return raw;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function slugify(id: string, title: string, year: number): string {
  const base = (id ?? "").toString().trim();
  if (base) {
    const m = base.match(/^(.*?)(\d{2,4})$/);
    if (m && m[1]) return `${m[1].toLowerCase()}-${year}`;
    return base.toLowerCase();
  }
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${year}`;
}

function isMissing(v: string): boolean {
  return !v || /^(tba|tbd|none)$/i.test(v.trim());
}

/** Infer a deadline type from a free-text comment; null = drop (not a deadline). */
function typeFromComment(comment: string): DeadlineType | null {
  const c = comment.toLowerCase();
  if (/\bopen(s|ing)?\b/.test(c) && !/deadline|due|close/.test(c)) return null;
  if (/abstract/.test(c)) return "abstract";
  if (/rebuttal|response/.test(c)) return "rebuttal";
  if (/camera|final version/.test(c)) return "camera-ready";
  if (/supplement/.test(c)) return "supplementary";
  return "paper";
}

function makeDeadline(
  type: DeadlineType,
  localTime: string,
  tz: string,
  label?: string,
): Deadline {
  return {
    type,
    date: toUtcIso(localTime, tz),
    localTime: localTime.trim(),
    timezone: tz,
    ...(label ? { label } : {}),
  };
}

function subsToAreas(sub: unknown): { areas: Area[]; tags: string[] } {
  const tags = (Array.isArray(sub) ? sub : sub ? [sub] : []).map(String);
  const areas = [...new Set(tags.map((t) => SUB_TO_AREA[t]).filter(Boolean))];
  return { areas: areas as Area[], tags };
}

// --- source 1: ai-deadlines ------------------------------------------------

type RawAi = Record<string, unknown>;

function normalizeAi(raw: RawAi): Conference | null {
  const title = String(raw.title ?? "").trim();
  const link = String(raw.link ?? "").trim();
  const year = Number(raw.year);
  if (!title || !link || !Number.isInteger(year)) return null;

  const { areas: subAreas, tags } = subsToAreas(raw.sub);
  // Hand-curated map wins over ai-deadlines' own sub classification.
  const areas = AREA_OVERRIDES.get(title.toUpperCase()) ?? subAreas;
  if (areas.length === 0) return null; // out of scope (e.g. HCI-only)

  const tz = String(raw.timezone ?? "UTC");
  const deadlines: Deadline[] = [];
  const abstract = String(raw.abstract_deadline ?? "");
  if (!isMissing(abstract)) deadlines.push(makeDeadline("abstract", abstract, tz));
  const paper = String(raw.deadline ?? "");
  if (!isMissing(paper)) deadlines.push(makeDeadline("paper", paper, tz));
  if (deadlines.length === 0) return null;

  return {
    id: slugify(String(raw.id ?? ""), title, year),
    title,
    year,
    ...(raw.full_name ? { fullName: String(raw.full_name) } : {}),
    link: normalizeLink(link),
    areas: areas as [Area, ...Area[]],
    tags,
    ...(raw.hindex != null ? { hindex: Number(raw.hindex) } : {}),
    ...(raw.place ? { place: String(raw.place) } : {}),
    ...(raw.date ? { dateText: String(raw.date) } : {}),
    ...(raw.start ? { start: String(raw.start) } : {}),
    ...(raw.end ? { end: String(raw.end) } : {}),
    deadlines,
    ...(raw.note ? { note: String(raw.note) } : {}),
    source: "ai-deadlines",
  };
}

async function fetchAiDeadlines(): Promise<Conference[]> {
  const res = await fetch(AI_DEADLINES_URL);
  if (!res.ok) {
    throw new Error(`ai-deadlines fetch failed: ${res.status} ${res.statusText}`);
  }
  const raw = yaml.load(await res.text());
  if (!Array.isArray(raw)) throw new Error("ai-deadlines YAML is not a list");
  return (raw as RawAi[])
    .map(normalizeAi)
    .filter((c): c is Conference => c !== null);
}

// --- source 2: ccf-deadlines -----------------------------------------------

type CcfTimelineItem = {
  deadline?: string;
  abstract_deadline?: string;
  comment?: string;
};
type CcfConf = {
  year?: number;
  id?: string;
  link?: string;
  timezone?: string;
  date?: string;
  place?: string;
  timeline?: CcfTimelineItem[];
};
type CcfEntry = {
  title?: string;
  description?: string;
  rank?: { ccf?: string; core?: string; thcpl?: string };
  confs?: CcfConf[];
};

function ccfRank(rank: CcfEntry["rank"]): string | undefined {
  if (!rank) return undefined;
  // "N" means "not ranked" in CCF/CORE — treat as absent rather than noise.
  const ranked = (v?: string) => (v && v.toUpperCase() !== "N" ? v : "");
  const core = ranked(rank.core) ? `CORE ${rank.core}` : "";
  const ccf = ranked(rank.ccf) ? `CCF ${rank.ccf}` : "";
  return [core, ccf].filter(Boolean).join(" · ") || undefined;
}

/** Resolve areas for a ccf venue: hand-curated override > title dict ∪ manual. */
function ccfAreas(title: string, titleAreas: Map<string, Area[]>): Area[] {
  const key = title.toUpperCase();
  // Hand-curated map fully replaces the inferred classification.
  const override = AREA_OVERRIDES.get(key);
  if (override) return override;
  const fromAi = titleAreas.get(key) ?? [];
  const manual = TITLE_AREA[key] ?? [];
  const merged = [...new Set([...fromAi, ...manual])];
  return merged.length ? merged : ["ai"]; // ccf "AI" bucket default
}

function normalizeCcfConf(
  entry: CcfEntry,
  conf: CcfConf,
  titleAreas: Map<string, Area[]>,
): Conference | null {
  const title = String(entry.title ?? "").trim();
  const year = Number(conf.year);
  if (!title || !Number.isInteger(year)) return null;

  const tz = String(conf.timezone ?? "UTC");
  const deadlines: Deadline[] = [];
  for (const item of conf.timeline ?? []) {
    const comment = item.comment ? String(item.comment) : undefined;
    const abs = String(item.abstract_deadline ?? "");
    if (!isMissing(abs)) deadlines.push(makeDeadline("abstract", abs, tz, comment));
    const dl = String(item.deadline ?? "");
    if (!isMissing(dl)) {
      const type = typeFromComment(comment ?? "");
      if (type) deadlines.push(makeDeadline(type, dl, tz, comment));
    }
  }
  if (deadlines.length === 0) return null;

  const areas = ccfAreas(title, titleAreas);
  return {
    id: slugify(String(conf.id ?? ""), title, year),
    title,
    year,
    ...(entry.description ? { fullName: String(entry.description) } : {}),
    link: normalizeLink(String(conf.link ?? "")),
    areas: areas as [Area, ...Area[]],
    tags: [],
    ...(ccfRank(entry.rank) ? { rank: ccfRank(entry.rank) } : {}),
    ...(conf.place ? { place: String(conf.place) } : {}),
    ...(conf.date ? { dateText: String(conf.date) } : {}),
    deadlines,
    source: "ccf-deadlines",
  };
}

async function fetchCcfDeadlines(
  titleAreas: Map<string, Area[]>,
): Promise<Conference[]> {
  const dir = await fetch(CCF_AI_DIR_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!dir.ok) {
    throw new Error(`ccf dir listing failed: ${dir.status} ${dir.statusText}`);
  }
  const files = (await dir.json()) as { name: string; download_url: string }[];
  const ymls = files.filter(
    (f) => f.name.endsWith(".yml") && f.name !== "types.yml",
  );

  const out: Conference[] = [];
  // download_url points at raw.githubusercontent (no API rate limit).
  await Promise.all(
    ymls.map(async (f) => {
      const res = await fetch(f.download_url);
      if (!res.ok) return;
      const parsed = yaml.load(await res.text());
      const entries = Array.isArray(parsed) ? (parsed as CcfEntry[]) : [];
      for (const entry of entries) {
        for (const conf of entry.confs ?? []) {
          const c = normalizeCcfConf(entry, conf, titleAreas);
          if (c) out.push(c);
        }
      }
    }),
  );
  return out;
}

// --- source 3: overrides ---------------------------------------------------

type RawOverride = Record<string, unknown>;

function normalizeOverride(raw: RawOverride): Conference {
  const title = String(raw.title ?? "").trim();
  const year = Number(raw.year);
  const tz = String(raw.timezone ?? "UTC");
  const areas = [...new Set((Array.isArray(raw.areas) ? raw.areas : []).map(String))] as Area[];

  const deadlines: Deadline[] = [];
  for (const d of Array.isArray(raw.deadlines) ? (raw.deadlines as Record<string, unknown>[]) : []) {
    const localTime = String(d.time ?? d.date ?? "");
    if (isMissing(localTime)) continue;
    const dTz = String(d.timezone ?? tz);
    const type = (DEADLINE_TYPES as readonly string[]).includes(String(d.type))
      ? (String(d.type) as DeadlineType)
      : "paper";
    deadlines.push(makeDeadline(type, localTime, dTz, d.label ? String(d.label) : undefined));
  }

  return {
    id: String(raw.id ?? slugify("", title, year)),
    title,
    year,
    ...(raw.full_name ? { fullName: String(raw.full_name) } : {}),
    link: normalizeLink(String(raw.link ?? "")),
    areas: areas as [Area, ...Area[]],
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]).map(String) : [],
    ...(raw.rank ? { rank: String(raw.rank) } : {}),
    ...(raw.hindex != null ? { hindex: Number(raw.hindex) } : {}),
    ...(raw.place ? { place: String(raw.place) } : {}),
    ...(raw.date ? { dateText: String(raw.date) } : {}),
    ...(raw.start ? { start: String(raw.start) } : {}),
    ...(raw.end ? { end: String(raw.end) } : {}),
    deadlines,
    ...(raw.note ? { note: String(raw.note) } : {}),
    source: "override",
  };
}

function loadOverrides(): Conference[] {
  if (!existsSync(OVERRIDES_PATH)) return [];
  const raw = yaml.load(readFileSync(OVERRIDES_PATH, "utf8"));
  return Array.isArray(raw) ? (raw as RawOverride[]).map(normalizeOverride) : [];
}

// --- merge -----------------------------------------------------------------

/**
 * Prefer the higher-priority source's deadlines (ccf over ai, override over
 * both). The lower-priority `base` set is only kept when the higher-priority
 * `incoming` source carries no deadlines at all.
 */
function preferredDeadlines(base: Deadline[], incoming: Deadline[]): Deadline[] {
  return incoming.length > 0 ? incoming : base;
}

/** Merge `incoming` (higher priority) onto `base`. */
function mergeConf(base: Conference, incoming: Conference): Conference {
  const areas = [...new Set([...base.areas, ...incoming.areas])] as [Area, ...Area[]];
  return {
    ...base,
    ...incoming,
    areas,
    tags: [...new Set([...base.tags, ...incoming.tags])],
    rank: incoming.rank ?? base.rank,
    hindex: incoming.hindex ?? base.hindex,
    fullName: incoming.fullName ?? base.fullName,
    place: incoming.place ?? base.place,
    dateText: incoming.dateText ?? base.dateText,
    start: incoming.start ?? base.start,
    end: incoming.end ?? base.end,
    note: incoming.note ?? base.note,
    link: incoming.link || base.link,
    deadlines: preferredDeadlines(base.deadlines, incoming.deadlines),
    source: incoming.source, // higher-priority origin
  };
}

/** Primary instant for sorting: earliest paper deadline, else earliest of any. */
function primaryDate(c: Conference): string {
  const papers = c.deadlines.filter((d) => d.type === "paper").map((d) => d.date);
  const all = c.deadlines.map((d) => d.date);
  return (papers.length ? papers : all).sort()[0] ?? "";
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log("→ fetching ai-deadlines…");
  const ai = await fetchAiDeadlines();
  console.log(`  ${ai.length} venues (auxiliary: areas + gap-fill)`);

  // Build the title→areas dictionary that teaches ccf which venues are robotics.
  const titleAreas = new Map<string, Area[]>();
  for (const c of ai) {
    const key = c.title.toUpperCase();
    titleAreas.set(key, [...new Set([...(titleAreas.get(key) ?? []), ...c.areas])]);
  }

  console.log("→ fetching ccf-deadlines (conference/AI)…");
  const ccf = await fetchCcfDeadlines(titleAreas);
  console.log(`  ${ccf.length} venue-years`);

  const overrides = loadOverrides();
  console.log(`→ ${overrides.length} override(s)`);

  // Merge by id, ascending priority: ai (auxiliary) < ccf (primary) < override.
  const byId = new Map<string, Conference>();
  const upsert = (c: Conference) => {
    const prev = byId.get(c.id);
    byId.set(c.id, prev ? mergeConf(prev, c) : c);
  };
  ai.forEach(upsert);
  ccf.forEach(upsert);
  overrides.forEach(upsert);

  const merged = [...byId.values()].sort((a, b) => {
    const da = primaryDate(a);
    const db = primaryDate(b);
    return da < db ? -1 : da > db ? 1 : a.title.localeCompare(b.title);
  });

  const conferences = ConferencesSchema.parse(merged);
  writeFileSync(OUTPUT_PATH, JSON.stringify(conferences, null, 2) + "\n");

  const counts = { "ai-deadlines": 0, "ccf-deadlines": 0, override: 0 } as Record<string, number>;
  for (const c of conferences) counts[c.source]++;
  console.log(
    `✓ wrote ${conferences.length} conferences → data/conferences.json`,
  );
  console.log(`  by source: ${JSON.stringify(counts)}`);
}

main().catch((err) => {
  console.error("✗ sync failed:", err);
  process.exit(1);
});
