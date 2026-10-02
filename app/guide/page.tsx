"use client";

import { use } from "react";
import GuideScreen from "@/components/screens/GuideScreen";

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * /guide?item=id — one step per screen from wherever you are standing.
 * A client page, so params arrive as a promise and `use` unwraps it.
 */
export default function Page({ searchParams }: PageProps<"/guide">) {
  const query = use(searchParams);
  return <GuideScreen itemId={first(query.item)} />;
}
