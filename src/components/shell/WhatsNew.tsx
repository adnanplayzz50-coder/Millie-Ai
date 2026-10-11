import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { UPDATES } from "@/lib/updates";

/** A "What's new" button in the top-right corner that lists recent updates. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);
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
          <ul className="mt-4 space-y-4">
            {UPDATES.map((u) => (
              <li key={u.date + u.title} className="border-b border-border pb-3 last:border-0">
                <p className="text-xs text-muted-foreground">{u.date}</p>
                <p className="font-medium">{u.title}</p>
                <p className="text-sm text-muted-foreground">{u.text}</p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
