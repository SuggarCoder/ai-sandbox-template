import type { ThreadRegistryEntry } from "@/types/thread";

export const threadRegistry: ThreadRegistryEntry[] = [
  {
    threadId: "1772722183-532409",
    title: "MacBook Pro 历史价格 Dashboard",
    updatedAt: "2026-03-07T14:56:30.000Z",
    importPage: () => import("./threads/1772722183-532409/page")
  },
];

export const threadRegistryMap = Object.fromEntries(
  threadRegistry.map((entry) => [entry.threadId, entry])
) as Record<string, ThreadRegistryEntry>;
