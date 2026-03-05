import type { ThreadRegistryEntry } from "@/types/thread";

export const threadRegistry: ThreadRegistryEntry[] = [
  {
    threadId: "1772713785-006519",
    title: "M4 Pro / M5 Pro 价格自动化监控系统",
    updatedAt: "2026-03-05T12:31:14.518Z",
    importPage: () => import("./threads/1772713785-006519/page")
  },
  {
    threadId: "1719999999-123456",
    title: "Sample Control Panel",
    updatedAt: "2026-03-05T00:00:00.000Z",
    importPage: () => import("./threads/1719999999-123456/page")
  },
];

export const threadRegistryMap = Object.fromEntries(
  threadRegistry.map((entry) => [entry.threadId, entry])
) as Record<string, ThreadRegistryEntry>;
