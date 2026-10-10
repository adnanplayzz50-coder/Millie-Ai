import { supabase } from "@/integrations/supabase/client";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "chat";

export async function exportConversation(id: string, title: string) {
  const { data } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at");
  const md =
    `# ${title}\n\n_Exported from Millie AI on ${new Date().toLocaleString()}_\n\n` +
    (data ?? []).map((m) => `## ${m.role === "user" ? "You" : "Millie"}\n\n${m.content}\n`).join("\n");
  downloadBlob(new Blob([md], { type: "text/markdown" }), `${slug(title)}.md`);
}
