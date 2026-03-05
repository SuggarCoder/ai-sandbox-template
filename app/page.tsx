import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { threadRegistry } from "@/generated/thread-registry";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short"
});

export default function HomePage() {
  const threads = [...threadRegistry].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary">Template Runtime</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Slack Thread Pages</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each thread implementation is generated into <code>generated/threads/&lt;threadId&gt;</code>. This
          index renders from the registry so bot-generated routes become available without touching app
          routing files.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {threads.map((thread) => (
          <Link href={`/thread/${thread.threadId}`} key={thread.threadId}>
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="line-clamp-1">{thread.title}</span>
                  <Badge variant="outline">{thread.threadId}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Updated {dateFormatter.format(new Date(thread.updatedAt))}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

