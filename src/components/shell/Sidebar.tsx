import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Brain,
  Download,
  Eye,
  EyeOff,
  FolderKanban,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { useApp } from "@/components/app/AppProvider";
import { useConversations, useInvalidate, useProjects, type ConversationRow } from "@/hooks/use-data";
import { exportConversation } from "@/lib/export";
import { isDark } from "@/lib/theme";
import { useShowChats } from "@/hooks/use-show-chats";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WakeIndicator } from "./WakeIndicator";

type Tab = "chats" | "older" | "projects";
const TABS: { key: Tab; label: string }[] = [
  { key: "chats", label: "Chats" },
  { key: "older", label: "Ex-Chats" },
  { key: "projects", label: "Projects" },
];

export function Sidebar() {
  const { profile, user, settings, updateSettings, setCustomizeOpen, setSidebarOpen } = useApp();
  const [tab, setTab] = useState<Tab>("chats");
  const [q, setQ] = useState("");
  const [showChats, setShowChats] = useShowChats();
  const convs = useConversations();
  const projects = useProjects();
  const navigate = useNavigate();

  // Chats: pinned first, then anything used in the last 7 days.
  // Ex-Chats: everything older than that, unless pinned.
  const { recent, older } = useMemo(() => {
    const list = (convs.data ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const isRecent = (c: ConversationRow) => new Date(c.updated_at).getTime() >= cutoff;
    const sorted = (xs: ConversationRow[]) => [...xs.filter((c) => c.pinned), ...xs.filter((c) => !c.pinned)];
    return {
      recent: sorted(list.filter((c) => c.pinned || isRecent(c))),
      older: sorted(list.filter((c) => !c.pinned && !isRecent(c))),
    };
  }, [convs.data, q]);
  const visible = tab === "older" ? older : recent;

  const dark = isDark(settings.theme);
  const close = () => setSidebarOpen(false);

  return (
    <aside className="glass flex h-full w-72 flex-col border-r border-border">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link to="/chat" search={{}} onClick={close} className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="font-read text-xl tracking-tight">Millie</span>
        </Link>
        <WakeIndicator />
        <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={close} aria-label="Close sidebar">
          <X className="size-4" />
        </Button>
      </div>

      <div className="px-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 bg-transparent"
          onClick={() => {
            navigate({ to: "/chat", search: {} });
            close();
          }}
        >
          <Plus className="size-4" /> New chat
          <kbd className="ml-auto text-[10px] text-muted-foreground">Ctrl K</kbd>
        </Button>
      </div>

      <div className="mt-3 flex gap-1 px-3 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 transition-colors",
              tab === t.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "projects" ? (
        !showChats ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            <p>Your chat list is hidden.</p>
            <button onClick={() => setShowChats(true)} className="mt-2 text-primary underline">
              Show chats
            </button>
          </div>
        ) : (
          <>
            <div className="relative mx-3 mt-3">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search chats"
                className="h-8 border-border/60 bg-transparent pl-8 text-sm"
              />
            </div>
            <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
              {visible.map((c) => (
                <ConversationItem key={c.id} c={c} onNavigate={close} />
              ))}
              {!convs.isLoading && !visible.length && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {tab === "older" ? "No older chats" : "No chats yet"}
                </p>
              )}
            </nav>
          </>
        )
      ) : (
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          <Link
            to="/projects"
            onClick={close}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-primary hover:bg-accent"
          >
            <Plus className="size-4" /> Manage projects
          </Link>
          {(projects.data ?? []).map((p) => (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              onClick={close}
              className="flex items-center gap-2 truncate rounded-md px-3 py-2 text-sm hover:bg-accent [&.active]:bg-accent"
            >
              <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="space-y-1 border-t border-border p-2">
        <button
          onClick={() => setShowChats(!showChats)}
          aria-pressed={showChats}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {showChats ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          <span className="flex-1 text-left">{showChats ? "Chats shown" : "Chats hidden"}</span>
          <span
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              showChats ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-background transition-transform",
                showChats ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
        <Link
          to="/memory"
          onClick={close}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Brain className="size-4" /> Memory
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCustomizeOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Palette className="size-4" /> Customize
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle light and dark"
            onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
        <Link
          to="/account"
          onClick={close}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
        >
          <Avatar className="size-7">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-accent text-xs">
              {(profile?.display_name || user.email || "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{profile?.display_name || user.email}</span>
        </Link>
      </div>
    </aside>
  );
}

function ConversationItem({ c, onNavigate }: { c: ConversationRow; onNavigate: () => void }) {
  const params = useParams({ strict: false }) as { id?: string };
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(c.title);
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const active = params.id === c.id;

  const update = async (patch: { title?: string; pinned?: boolean }) => {
    await supabase.from("conversations").update(patch).eq("id", c.id);
    invalidate("conversations");
  };

  const remove = async () => {
    if (!confirm(`Delete "${c.title}"?`)) return;
    await supabase.from("conversations").delete().eq("id", c.id);
    invalidate("conversations");
    if (active) navigate({ to: "/chat", search: {} });
    toast.success("Chat deleted");
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setEditing(false);
          update({ title: title.trim() || c.title });
        }}
        className="px-1"
      >
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setEditing(false);
            update({ title: title.trim() || c.title });
          }}
          className="h-8 text-sm"
        />
      </form>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center rounded-md text-sm transition-colors hover:bg-accent/70",
        active && "bg-accent",
      )}
    >
      <Link
        to="/c/$id"
        params={{ id: c.id }}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
      >
        {c.pinned && <Pin className="size-3 shrink-0 text-primary" />}
        {c.mode === "code" && <span className="font-mono text-[10px] text-primary">C0DE</span>}
        <span className="truncate">{c.title}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="mr-1 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
          aria-label="Chat options"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => update({ pinned: !c.pinned })}>
            {c.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {c.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportConversation(c.id, c.title)}>
            <Download className="size-4" /> Export Markdown
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
