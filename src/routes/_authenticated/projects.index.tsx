import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useProjects } from "@/hooks/use-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [{ title: "Projects — Millie AI" }] }),
  component: function Projects() {
    const p = useProjects();
    const inv = useInvalidate();
    const [name, setName] = useState("");
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto p-8">
        <h1 className="font-read text-3xl">Projects</h1>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await supabase.from("projects").insert({ name }); setName(""); inv("projects"); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New project name" /><Button>Create</Button>
        </form>
        {(p.data ?? []).map((x) => (
          <Link key={x.id} to="/projects/$id" params={{ id: x.id }} className="block rounded-lg border border-border p-4 hover:border-primary">{x.name}<p className="text-sm text-muted-foreground">{x.description}</p></Link>
        ))}
      </div>
    );
  },
});
