import type { ComponentType } from "react";

export type ThreadMeta = {
  threadId: string;
  title: string;
  updatedAt: string;
};

export type ThreadPageModule = {
  default: ComponentType;
};

export type ThreadRegistryEntry = ThreadMeta & {
  importPage: () => Promise<ThreadPageModule>;
};
