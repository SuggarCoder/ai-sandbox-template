import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rebuildRegistry } from "./rebuild-thread-registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const threadsDir = path.join(rootDir, "generated", "threads");
const THREAD_ID_PATTERN = /^\d{8,16}-\d{1,9}$/;

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = value;
      i += 1;
    }
  }

  return args;
}

function toComponentName(threadId) {
  const safe = threadId.replace(/-/g, "_");
  return `ThreadPage_${safe}`;
}

function buildPageTemplate({ threadId, title }) {
  const componentName = toComponentName(threadId);
  return `"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const config = {
  title: ${JSON.stringify(title)},
  description: "Generated from Slack thread ${threadId}."
};

export default function ${componentName}() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Badge>Thread ${threadId}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{config.title}</h1>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>New Thread Page</CardTitle>
          <CardDescription>Replace this generated page with your implementation.</CardDescription>
        </CardHeader>
        <CardContent>This page is controlled by your Slack bot workflow.</CardContent>
      </Card>
    </div>
  );
}
`;
}

async function upsertMetaFile(metaPath, payload) {
  let existing = {};
  try {
    const current = await readFile(metaPath, "utf8");
    existing = JSON.parse(current);
  } catch {
    // Ignore missing or malformed file.
  }

  const merged = {
    ...existing,
    threadId: payload.threadId,
    title: payload.title,
    updatedAt: new Date().toISOString()
  };

  await writeFile(metaPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const threadId = args.threadId;
  const title = args.title ?? `Thread ${threadId}`;

  if (!threadId || !THREAD_ID_PATTERN.test(threadId)) {
    throw new Error("Invalid --threadId. Expected format like 1719999999-123456.");
  }

  const targetDir = path.join(threadsDir, threadId);
  const pagePath = path.join(targetDir, "page.tsx");
  const metaPath = path.join(targetDir, "meta.json");

  await mkdir(targetDir, { recursive: true });
  await writeFile(pagePath, buildPageTemplate({ threadId, title }), "utf8");
  await upsertMetaFile(metaPath, { threadId, title });

  const count = await rebuildRegistry();
  process.stdout.write(`Thread page updated: ${threadId} (registry size: ${count}).\n`);
}

await run();
