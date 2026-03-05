const THREAD_ID_PATTERN = /^\d{8,16}-\d{1,9}$/;

export function normalizeThreadTs(threadTs: string): string {
  return threadTs.trim().replace(".", "-");
}

export function denormalizeThreadId(threadId: string): string {
  return threadId.trim().replace("-", ".");
}

export function isValidThreadId(threadId: string): boolean {
  return THREAD_ID_PATTERN.test(threadId.trim());
}

