import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({ meta: [{ title: "Files — Millie AI" }] }),
  component: FilesPage,
});

type FileRow = { id: string; name: string; when: string; chatId: string; chatTitle: string };

/** Every file you attached or made in a chat, newest first, with a link back to the chat. */
function FilesPage() {
  const [rows, setRows] = useState<FileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("id, created_at, sources, conversation_id")
        .not("sources", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        if (!cancelled) setError(`Couldn't load files: ${error.message}`);
        return;
      }

      const messages = data ?? [];
      const chatIds = [...new Set(messages.map((m: any) => m.conversation_id).filter(Boolean))];
      const titleById = new Map<string, string>();
      if (chatIds.length) {
        const { data: chats, error: chatError } = await supabase
          .from("conversations")
          .select("id, title")
          .in("id", chatIds);
        if (chatError) {
          if (!cancelled) setError(`Files loaded, but chat names couldn't be loaded: ${chatError.message}`);
          return;
        }
        for (const chat of chats ?? []) titleById.set(chat.id, chat.title ?? "Chat");
      }

      const out: FileRow[] = [];
      for (const m of messages) {
        const files: string[] = Array.isArray(m.sources?.files) ? m.sources.files : [];
        files.forEach((name, i) =>
          out.push({
            id: `${m.id}-${i}`,
            name,
            when: m.created_at,
            chatId: m.conversation_id,
            chatTitle: titleById.get(m.conversation_id) ?? "Chat",
          }),
        );
      }
      if (!cancelled) setRows(out);
    })().catch((e) => {
      if (!cancelled) setError(`Couldn't load files: ${(e as Error).message}`);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <header className="space-y-1">
          <h1 className="font-read text-3xl tracking-tight">Files</h1>
          <p className="text-sm text-muted-foreground">Files you attached in your chats. Select one to open its chat.</p>
        </header>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {rows === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows && !rows.length && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No files yet. Files you attach in a chat will show up here.
          </p>
        )}

        <ul className="space-y-2">
          {rows?.map((r) => (
            <li key={r.id}>
              <Link
                to="/c/$id"
                params={{ id: r.chatId }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <FileText className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.chatTitle} · {new Date(r.when).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
