import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { CardSkeleton } from "@/components/card-skeleton";
import { MealView } from "@/components/meal-view";
import { getIngredients, getMeal } from "@/lib/repo";

export async function generateMetadata({
  params,
}: PageProps<"/meals/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getMeal(id)?.name ?? "Meals" };
}

export default function MealPage({ params }: PageProps<"/meals/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <MealLoader params={params} />
    </Suspense>
  );
}

async function MealLoader({ params }: Pick<PageProps<"/meals/[id]">, "params">) {
  const { id } = await params;
  await io();
  const meal = getMeal(id);
  if (!meal) notFound();
  return <MealView key={meal.id} initialMeal={meal} initialIngredients={getIngredients(id)} />;
}
