import type { ThreadRegistryEntry } from "@/types/thread";

export const threadRegistry: ThreadRegistryEntry[] = [
];

export const threadRegistryMap = Object.fromEntries(
  threadRegistry.map((entry) => [entry.threadId, entry])
) as Record<string, ThreadRegistryEntry>;
