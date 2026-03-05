import { notFound } from "next/navigation";

import { PageTransition } from "@/components/motion/page-transition";
import { threadRegistryMap } from "@/generated/thread-registry";
import { isValidThreadId } from "@/lib/thread-id";

type ThreadRoutePageProps = {
  params: Promise<{
    threadId: string;
  }>;
};

export default async function ThreadRoutePage({ params }: ThreadRoutePageProps) {
  const { threadId } = await params;
  if (!isValidThreadId(threadId)) {
    notFound();
  }

  const entry = threadRegistryMap[threadId];
  if (!entry) {
    notFound();
  }

  const pageModule = await entry.importPage();
  const ThreadPage = pageModule.default;

  return (
    <PageTransition>
      <ThreadPage />
    </PageTransition>
  );
}

