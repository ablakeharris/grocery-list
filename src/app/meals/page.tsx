import type { Metadata } from "next";
import { Suspense } from "react";
import { io } from "next/cache";
import { CardSkeleton } from "@/components/card-skeleton";
import { MealsView } from "@/components/meals-view";
import { SectionTabs } from "@/components/section-tabs";
import { getMealSummaries } from "@/lib/repo";

export const metadata: Metadata = { title: "Meals" };

export default function MealsPage() {
  return (
    <>
      <SectionTabs active="/meals" />
      <Suspense fallback={<CardSkeleton />}>
        <Meals />
      </Suspense>
    </>
  );
}

async function Meals() {
  await io(); // SQLite is synchronous; keep it out of the build-time prerender.
  return <MealsView initialMeals={getMealSummaries()} />;
}
