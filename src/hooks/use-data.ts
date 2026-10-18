import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Mode } from "@/lib/types";

export interface ConversationRow {
  id: string;
  title: string;
  mode: string;
  pinned: boolean;
  project_id: string | null;
  updated_at: string;
  /** "web" for website chats, "extension" for chats made in the Chrome extension. */
  source?: string | null;
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, mode, pinned, project_id, updated_at, source")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ConversationRow[];
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (key: string) => qc.invalidateQueries({ queryKey: [key] });
}

export async function createConversation(opts: { mode: Mode; projectId?: string | null; title: string }) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ mode: opts.mode, project_id: opts.projectId ?? null, title: opts.title.slice(0, 60) || "New chat" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
