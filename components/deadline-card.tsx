import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Countdown } from "@/components/countdown";
import {
  AREA_LABELS,
  DEADLINE_LABELS,
  type Conference,
  type Deadline,
} from "@/lib/conference-utils";
import { cn } from "@/lib/utils";

function daysUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 86_400_000;
}

export function DeadlineCard({
  conference,
  next,
}: {
  conference: Conference;
  next: Deadline | null;
}) {
  const urgent = next ? daysUntil(next.date) < 7 : false;

  return (
    <Card className="gap-3">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <a
              href={conference.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading text-base leading-snug font-semibold hover:underline"
            >
              {conference.title} {conference.year}
            </a>
            {conference.fullName && (
              <span className="text-xs text-muted-foreground">
                {conference.fullName}
              </span>
            )}
          </div>
          {conference.rank && (
            <Badge variant="secondary" className="shrink-0">
              {conference.rank}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {conference.areas.map((area) => (
            <Badge key={area} variant="outline">
              {AREA_LABELS[area]}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex items-end justify-between gap-2">
        {next ? (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                {DEADLINE_LABELS[next.type]}
                {next.label ? ` · ${next.label}` : ""}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {next.localTime} {next.timezone}
              </span>
            </div>
            <Countdown
              iso={next.date}
              className={cn(
                "font-heading text-lg font-semibold tabular-nums",
                urgent ? "text-destructive" : "text-foreground",
              )}
            />
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              Next deadline not announced
            </span>
            <span className="font-heading text-lg font-semibold text-muted-foreground">
              TBA
            </span>
          </>
        )}
      </CardContent>

      {(conference.place || conference.dateText) && (
        <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {[conference.place, conference.dateText].filter(Boolean).join(" · ")}
          </span>
          <a
            href={conference.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 hover:text-foreground"
            aria-label="Conference website"
          >
            <ExternalLink className="size-3" />
          </a>
        </CardFooter>
      )}
    </Card>
  );
}
