// Names that README examples use without declaring them.
import type { LanguageModel } from "ai";
import type { Klaracase } from "@klaracase/sdk";

declare global {
  const draftText: string;
  const controller: AbortController;
  const yourModel: LanguageModel;
  const client: Klaracase;
  // A `File` from a form field or from `new File([bytes], "name.pdf")`.
  const file: File;
}

export {};
