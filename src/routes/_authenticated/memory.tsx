import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({ meta: [{ title: "Memory — Millie AI" }] }),
  component: function Memory() {
    const q = useQuery({ queryKey: ["facts"], queryFn: async () => (await supabase.from("memory_facts").select("*").order("created_at", { ascending: false })).data ?? [] });
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto p-8">
        <h1 className="font-read text-3xl">Memory</h1>
        <p className="text-sm text-muted-foreground">Things Millie remembers about you. Edit or delete anytime.</p>
        {(q.data ?? []).map((f) => (
          <div key={f.id} className="flex gap-2">
            <Input defaultValue={f.fact} onBlur={(e) => supabase.from("memory_facts").update({ fact: e.target.value }).eq("id", f.id)} />
            <Button variant="ghost" size="icon" aria-label="Delete" onClick={async () => { await supabase.from("memory_facts").delete().eq("id", f.id); q.refetch(); }}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        {!q.data?.length && <p className="text-sm text-muted-foreground">Nothing saved yet.</p>}
      </div>
    );
  },
});
