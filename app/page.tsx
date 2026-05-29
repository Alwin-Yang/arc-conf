import { ConferenceExplorer } from "@/components/conference-explorer";
import { ThemeToggle } from "@/components/theme-toggle";
import { allVenues } from "@/lib/conferences";

export default function Home() {
  const items = allVenues();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
          AI · Robotics · Control Conference Deadlines
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <ConferenceExplorer items={items} />
    </main>
  );
}
