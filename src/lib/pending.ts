import type { Attachment } from "./types";

export interface PendingSend {
  text: string;
  attachments: Attachment[];
  webSearch: boolean;
  speak?: boolean;
}

/** Hand-off for the first message of a freshly created conversation. */
const pending = new Map<string, PendingSend>();
export const setPending = (id: string, p: PendingSend) => pending.set(id, p);
export const takePending = (id: string) => {
  const p = pending.get(id);
  pending.delete(id);
  return p;
};
