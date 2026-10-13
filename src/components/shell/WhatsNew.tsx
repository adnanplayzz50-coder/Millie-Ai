import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; log_date: string; title: string; body: string; sort_order: number };

/** "What's new": reads the update log that the admin edits, grouped by date. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    (supabase as any)
      .from("update_log")
      .select("id, log_date, title, body, sort_order")
      .order("log_date", { ascending: false })
      .order("sort_order", { ascending: true })
      .then((res: { data: Row[] | null }) => setRows(res.data ?? []));
  }, [open]);

  const groups = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.log_date] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="fixed right-3 top-3 z-30 gap-1.5 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" /> What's new
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>What's new</DialogTitle>
          <DialogDescription>Recent updates to Millie AI, newest first.</DialogDescription>
          <div className="mt-4 space-y-6">
            {Object.entries(groups).map(([date, items]) => (
              <section key={date} className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">
                  {new Date(date + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </h3>
                <ul className="space-y-3">
                  {items.map((u) => (
                    <li key={u.id} className="border-b border-border pb-3 last:border-0">
                      <p className="font-medium">{u.title}</p>
                      <p className="text-sm text-muted-foreground">{u.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {open && !rows.length && <p className="text-sm text-muted-foreground">No updates yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
