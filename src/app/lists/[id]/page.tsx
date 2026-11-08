import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import { ListView } from "@/components/list-view";
import { CardSkeleton } from "@/components/card-skeleton";
import { getItems, getList } from "@/lib/repo";

export async function generateMetadata({
  params,
}: PageProps<"/lists/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getList(id)?.name ?? "Grocery Lists" };
}

export default function ListPage({ params }: PageProps<"/lists/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <ListLoader params={params} />
    </Suspense>
  );
}

async function ListLoader({ params }: Pick<PageProps<"/lists/[id]">, "params">) {
  const { id } = await params;
  await io();
  const list = getList(id);
  if (!list) notFound();
  return <ListView key={list.id} initialList={list} initialItems={getItems(id)} />;
}
