import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useInvalidate } from "@/hooks/use-data";
import { filesToAttachments } from "@/lib/attachments";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [{ title: "Project — Millie AI" }] }),
  component: function Project() {
    const { id } = Route.useParams();
    const nav = useNavigate();
    const inv = useInvalidate();
    const proj = useQuery({ queryKey: ["project", id], queryFn: async () => (await supabase.from("projects").select("*").eq("id", id).maybeSingle()).data });
    const files = useQuery({ queryKey: ["pfiles", id], queryFn: async () => (await supabase.from("project_files").select("id, path").eq("project_id", id)).data ?? [] });
    const chats = (useConversations().data ?? []).filter((c) => c.project_id === id);
    const p = proj.data;
    if (!p) return null;
    const save = (patch: { name?: string; description?: string; instructions?: string }) => supabase.from("projects").update(patch).eq("id", id).then(() => inv("projects"));
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto p-8">
        <Input defaultValue={p.name} onBlur={(e) => save({ name: e.target.value })} className="font-read text-2xl" />
        <Textarea defaultValue={p.description} placeholder="Description" onBlur={(e) => save({ description: e.target.value })} />
        <Textarea defaultValue={p.instructions} rows={5} placeholder="Custom instructions" onBlur={(e) => save({ instructions: e.target.value })} />
        <h2 className="font-medium">Knowledge files</h2>
        <input type="file" multiple onChange={async (e) => {
          if (!e.target.files) return;
          const atts = await filesToAttachments(e.target.files);
          await supabase.from("project_files").insert(atts.filter((a) => a.text).map((a) => ({ project_id: id, path: a.name, content: a.text! })));
          files.refetch();
        }} />
        {(files.data ?? []).map((f) => <p key={f.id} className="text-sm">{f.path} <button className="text-destructive" onClick={async () => { await supabase.from("project_files").delete().eq("id", f.id); files.refetch(); }}>remove</button></p>)}
        <div className="flex gap-2">
          <Button onClick={() => nav({ to: "/chat", search: { project: id } })}>New chat in project</Button>
          <Button variant="destructive" onClick={async () => { if (!confirm("Delete project?")) return; await supabase.from("projects").delete().eq("id", id); inv("projects"); nav({ to: "/projects" }); }}>Delete</Button>
        </div>
        <h2 className="font-medium">Chats</h2>
        {chats.map((c) => <Link key={c.id} to="/c/$id" params={{ id: c.id }} className="block text-sm hover:text-primary">{c.title}</Link>)}
      </div>
    );
  },
});
