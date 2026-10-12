import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { UPDATE_GROUPS } from "@/lib/updates";
import { cn } from "@/lib/utils";

/** A "What's new" button in the top-right corner that lists recent updates, grouped by date. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);
  // Newest date open by default; each date heading toggles its group.
  const [openDates, setOpenDates] = useState<string[]>(UPDATE_GROUPS[0] ? [UPDATE_GROUPS[0].date] : []);

  const toggleDate = (date: string) =>
    setOpenDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));

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
          <DialogDescription>Recent updates to Millie AI, newest first. Tap a date to see that day's updates.</DialogDescription>
          <div className="mt-4 space-y-2">
            {UPDATE_GROUPS.map((g) => {
              const isOpen = openDates.includes(g.date);
              return (
                <div key={g.date} className="overflow-hidden rounded-lg border border-border">
                  <button
                    onClick={() => toggleDate(g.date)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
                    <span className="text-sm font-medium">{g.date}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{g.updates.length}</span>
                  </button>
                  {isOpen && (
                    <ul className="space-y-3 border-t border-border px-3 py-3">
                      {g.updates.map((u) => (
                        <li key={u.title} className="last:pb-0">
                          <p className="font-medium">{u.title}</p>
                          <p className="text-sm text-muted-foreground">{u.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
