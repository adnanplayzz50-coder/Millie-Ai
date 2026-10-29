import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileText,
  FolderKanban,
  Moon,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings as SettingsIcon,
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
import { useHideExChats } from "@/hooks/use-hide-ex-chats";
import { useExtensionLink } from "@/hooks/use-extension-link";
import { SettingsSheet } from "./SettingsSheet";
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

export function Sidebar() {
  const { profile, user, settings, updateSettings, setSidebarOpen } = useApp();
  const [tabState, setTabState] = useState<Tab>("chats");
  const [q, setQ] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hideEx] = useHideExChats();
  const [collapsed, setCollapsedState] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("millie-history-collapsed") === "true",
  );
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    localStorage.setItem("millie-history-collapsed", String(v));
  };
  useExtensionLink();
  const convs = useConversations();
  const projects = useProjects();
  const navigate = useNavigate();

  // Chats: chats made on the website (pinned first).
  // Ex-Chats: chats you had with the Millie extension.
  const { recent, older } = useMemo(() => {
    const list = (convs.data ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
    const isExt = (c: ConversationRow) => (c as ConversationRow & { source?: string }).source === "extension";
    const sorted = (xs: ConversationRow[]) => [...xs.filter((c) => c.pinned), ...xs.filter((c) => !c.pinned)];
    return {
      recent: sorted(list.filter((c) => !isExt(c))),
      older: sorted(list.filter((c) => isExt(c))),
    };
  }, [convs.data, q]);
  // With Ex-Chats hidden, the Ex-Chats tab disappears.
  const tabs: { key: Tab; label: string }[] = [
    { key: "chats", label: "Chats" },
    ...(hideEx ? [] : [{ key: "older" as const, label: "Ex-Chats" }]),
    { key: "projects", label: "Projects" },
  ];
  const tab = hideEx && tabState === "older" ? "chats" : tabState;
  const setTab = setTabState;
  const visible = tab === "older" ? older : recent;

  const dark = isDark(settings.theme);
  const close = () => setSidebarOpen(false);

  return (
    <aside className={cn("glass flex h-full flex-col border-r border-border transition-[width] duration-200", collapsed ? "w-16" : "w-72")}>
      <div className={cn("flex items-center gap-2 px-4 pt-4 pb-3", collapsed && "flex-col gap-3 px-0")}>
        <Link to="/chat" search={{}} onClick={close} className="flex items-center gap-2">
          <Logo className="size-14" />
          {!collapsed && <span className="font-read text-2xl tracking-tight">Millie</span>}
        </Link>
        {!collapsed && <WakeIndicator />}
        <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={close} aria-label="Close sidebar">
          <X className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Show chat history" : "Hide chat history"}
          title={collapsed ? "Show chat history" : "Hide chat history"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </Button>
      </div>

      {collapsed && (
        <div className="flex flex-col items-center gap-2 px-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigate({ to: "/chat", search: {} });
              close();
            }}
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} aria-label="Show chat history" title="Show chat history">
            <Search className="size-4" />
          </Button>
        </div>
      )}

      {!collapsed && (
        <>
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
        {tabs.map((t) => (
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
                {tab === "older" ? "No extension chats yet" : "No chats yet"}
              </p>
            )}
          </nav>
        </>
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

        </>
      )}

      <div className="border-t border-border p-3">
        <div className={cn("flex items-center justify-center gap-8", collapsed && "flex-col gap-3")}>
          <Link
            to="/files"
            onClick={close}
            title="Files"
            aria-label="Files"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <FileText className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle light and dark"
            title="Toggle light and dark"
            onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
        <div className={cn("mt-2 flex items-center gap-1 rounded-md pr-1 hover:bg-accent", collapsed && "flex-col items-center justify-center gap-3 rounded-md pr-0")}>
          <Link to="/account" onClick={close} className={cn("flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm", collapsed && "flex-none justify-center px-0")}>
            <Avatar className="size-7">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent text-xs">
                {(profile?.display_name || user.email || "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && <span className="truncate">{profile?.display_name || user.email}</span>}
          </Link>
          <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="size-4" />
          </Button>
        </div>
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
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

  const update = async (patch: { title?: string; pinned?: boolean; project_id?: string | null }) => {
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
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          clearHold();
          holdTimer.current = setTimeout(() => setMenuOpen(true), 550);
        }}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onContextMenu={(e) => { e.preventDefault(); clearHold(); setMenuOpen(true); }}
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
          <DropdownMenuItem onSelect={() => { setTitle(c.title); setEditing(true); }}>
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderKanban className="size-4" /> Add to project
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => update({ project_id: null })}>
                No project
              </DropdownMenuItem>
              {(projects.data ?? []).map((project) => (
                <DropdownMenuItem key={project.id} onSelect={() => update({ project_id: project.id })}>
                  <FolderKanban className="size-4" /> {project.name}
                </DropdownMenuItem>
              ))}
              {!(projects.data ?? []).length && (
                <DropdownMenuItem onSelect={() => navigate({ to: "/projects" })}>
                  Create a project…
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
