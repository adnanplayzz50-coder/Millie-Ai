export type Mode = "chat" | "code";

export interface Attachment {
  id: string;
  kind: "image" | "text";
  name: string;
  dataUrl?: string;
  text?: string;
}

export interface Source {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** User: names of attached files + hidden context. Assistant: sources. */
  meta?: { files?: string[]; context?: string; sources?: Source[]; error?: boolean } | null;
  images?: string[];
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
