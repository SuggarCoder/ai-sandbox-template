import type { ThreadRegistryEntry } from "@/types/thread";

export const threadRegistry: ThreadRegistryEntry[] = [
  {
    threadId: "1772722183-532409",
    title: "M4 Pro / M5 Pro 价格监控系统",
    updatedAt: "2026-03-05T14:53:13.853Z",
    importPage: () => import("./threads/1772722183-532409/page")
  },
];

export const threadRegistryMap = Object.fromEntries(
  threadRegistry.map((entry) => [entry.threadId, entry])
) as Record<string, ThreadRegistryEntry>;
