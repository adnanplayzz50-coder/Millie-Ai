import { useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Brain, Code2, FolderKanban, MessageSquare, Palette, Plus, User, Video } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { useConversations, useInvalidate } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setCustomizeOpen } = useApp();
  const navigate = useNavigate();
  const convs = useConversations();
  const params = useParams({ strict: false }) as { id?: string };
  const invalidate = useInvalidate();
  const current = convs.data?.find((c) => c.id === params.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen]);

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Search chats or type a command…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => navigate({ to: "/chat", search: {} }))}>
            <Plus /> New chat
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/chat", search: { mode: "code" } }))}>
            <Code2 /> New C0DE chat
          </CommandItem>
          {current && (
            <CommandItem
              onSelect={() =>
                run(async () => {
                  await supabase
                    .from("conversations")
                    .update({ mode: current.mode === "code" ? "chat" : "code" })
                    .eq("id", current.id);
                  invalidate("conversations");
                  invalidate("conversation");
                })
              }
            >
              <Code2 /> Switch mode to {current.mode === "code" ? "Chat" : "C0DE"}
            </CommandItem>
          )}
          <CommandItem onSelect={() => run(() => setCustomizeOpen(true))}>
            <Palette /> Open settings & customize
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/call" }))}>
            <Video /> Start a video call with Millie
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/projects" }))}>
            <FolderKanban /> Projects
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/memory" }))}>
            <Brain /> Memory
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/account" }))}>
            <User /> Account
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Chats">
          {(convs.data ?? []).slice(0, 50).map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.title} ${c.id}`}
              onSelect={() => run(() => navigate({ to: "/c/$id", params: { id: c.id } }))}
            >
              <MessageSquare /> {c.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
