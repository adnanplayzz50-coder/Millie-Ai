import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/components/app/AppProvider";
import { deleteMyAccount } from "@/lib/account.functions";
import { resizeImage } from "@/lib/attachments";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account — Millie AI" }] }),
  component: function Account() {
    const { profile, user, refreshProfile } = useApp();
    const [name, setName] = useState(profile?.display_name ?? "");
    const [email, setEmail] = useState(user.email ?? "");
    const [pw, setPw] = useState("");
    const [msg, setMsg] = useState("");
    const del = useServerFn(deleteMyAccount);
    const navigate = useNavigate();
    return (
      <div className="mx-auto w-full max-w-lg space-y-6 overflow-y-auto p-8">
        <h1 className="font-read text-3xl">Account</h1>
        {profile?.avatar_url && <img src={profile.avatar_url} alt="avatar" className="size-20 rounded-full" />}
        <input type="file" accept="image/*" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const url = await resizeImage(URL.createObjectURL(f), 256);
          await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id); refreshProfile();
        }} />
        <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" /><Button onClick={async () => { await supabase.from("profiles").update({ display_name: name }).eq("id", user.id); refreshProfile(); setMsg("Saved"); }}>Save</Button></div>
        <div className="flex gap-2"><Input value={email} onChange={(e) => setEmail(e.target.value)} /><Button onClick={async () => { const { error } = await supabase.auth.updateUser({ email }); setMsg(error?.message ?? "Check your inbox to confirm."); }}>Change email</Button></div>
        <div className="flex gap-2"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" /><Button onClick={async () => { const { error } = await supabase.auth.updateUser({ password: pw }); setMsg(error?.message ?? "Password updated."); }}>Update</Button></div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut({ scope: "local" }); navigate({ to: "/auth" }); }}>Sign out</Button>
          <Button variant="destructive" onClick={async () => { if (prompt('Type DELETE to permanently delete your account') !== "DELETE") return; await del(); await supabase.auth.signOut({ scope: "local" }); navigate({ to: "/auth" }); }}>Delete account</Button>
        </div>
      </div>
    );
  },
});
