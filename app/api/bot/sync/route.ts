import { NextResponse } from "next/server";

import { threadRegistry } from "@/generated/thread-registry";

type SyncBody = {
  event?: string;
  threadId?: string;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    threads: threadRegistry.map((entry) => ({
      threadId: entry.threadId,
      title: entry.title,
      updatedAt: entry.updatedAt
    }))
  });
}

export async function POST(request: Request) {
  const expectedToken = process.env.BOT_SYNC_TOKEN;
  const token = request.headers.get("x-bot-token");
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: SyncBody | null = null;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_json"
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    event: body?.event ?? "unknown",
    threadId: body?.threadId ?? null,
    message:
      "Use the bot runtime to write generated files and run `npm run rebuild:threads` before deployment."
  });
}

