"use client";

import { use } from "react";
import AnswerScreen from "@/components/screens/AnswerScreen";

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * /item/[id]?m=otherId,otherId — the optional matches carousel.
 * A client page, so params arrive as a promise and `use` unwraps it.
 */
export default function Page({
  params,
  searchParams,
}: PageProps<"/item/[id]">) {
  const { id } = use(params);
  const query = use(searchParams);
  const matches = first(query.m)
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);

  return <AnswerScreen itemId={id} matches={matches} />;
}
