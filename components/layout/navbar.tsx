import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/70 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Thread UI Template
          </Link>
          <Badge variant="outline">Next.js App Router</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Threads</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

