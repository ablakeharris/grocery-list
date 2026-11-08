import { Suspense } from "react";
import { io } from "next/cache";
import { ListsView } from "@/components/lists-view";
import { CardSkeleton } from "@/components/card-skeleton";
import { SectionTabs } from "@/components/section-tabs";
import { getListSummaries } from "@/lib/repo";

export default function HomePage() {
  return (
    <>
      <SectionTabs active="/" />
      <Suspense fallback={<CardSkeleton />}>
        <Lists />
      </Suspense>
    </>
  );
}

async function Lists() {
  await io(); // SQLite is synchronous; keep it out of the build-time prerender.
  return <ListsView initialLists={getListSummaries()} />;
}
