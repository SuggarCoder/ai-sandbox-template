import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const threadsDir = path.join(rootDir, "generated", "threads");
const registryFile = path.join(rootDir, "generated", "thread-registry.ts");
const THREAD_ID_PATTERN = /^\d{8,16}-\d{1,9}$/;

function isValidThreadId(threadId) {
  return THREAD_ID_PATTERN.test(threadId);
}

async function readThreadEntries() {
  const dirs = await readdir(threadsDir, { withFileTypes: true });
  const threadIds = dirs.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  const entries = [];

  for (const threadId of threadIds) {
    if (!isValidThreadId(threadId)) {
      continue;
    }

    const metaPath = path.join(threadsDir, threadId, "meta.json");
    try {
      const metaContent = await readFile(metaPath, "utf8");
      const meta = JSON.parse(metaContent);
      entries.push({
        threadId,
        title: meta.title ?? threadId,
        updatedAt: meta.updatedAt ?? new Date(0).toISOString()
      });
    } catch {
      // Skip malformed or missing metadata.
    }
  }

  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function renderRegistry(entries) {
  const lines = [
    'import type { ThreadRegistryEntry } from "@/types/thread";',
    "",
    "export const threadRegistry: ThreadRegistryEntry[] = ["
  ];

  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    threadId: "${entry.threadId}",`);
    lines.push(`    title: ${JSON.stringify(entry.title)},`);
    lines.push(`    updatedAt: "${entry.updatedAt}",`);
    lines.push(`    importPage: () => import("./threads/${entry.threadId}/page")`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  lines.push("export const threadRegistryMap = Object.fromEntries(");
  lines.push('  threadRegistry.map((entry) => [entry.threadId, entry])');
  lines.push(") as Record<string, ThreadRegistryEntry>;");
  lines.push("");

  return lines.join("\n");
}

export async function rebuildRegistry() {
  const entries = await readThreadEntries();
  const nextContent = renderRegistry(entries);
  await writeFile(registryFile, nextContent, "utf8");
  return entries.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const count = await rebuildRegistry();
  process.stdout.write(`Rebuilt generated/thread-registry.ts with ${count} thread entries.\n`);
}
