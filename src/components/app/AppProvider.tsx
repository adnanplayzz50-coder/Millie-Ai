import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { applySettings, cachedSettings, DEFAULT_SETTINGS, type Settings } from "@/lib/theme";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  hobbies: string | null;
  interests: string | null;
  ai_use: string | null;
  onboarded: boolean;
}

interface AppCtx {
  user: User;
  profile: Profile | null;
  refreshProfile: () => void;
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  customizeOpen: boolean;
  setCustomizeOpen: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<Settings>(() => cachedSettings());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const profileQ = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) return data as Profile;
      const fresh = { id: user.id, display_name: user.email?.split("@")[0] ?? null };
      await supabase.from("profiles").upsert(fresh);
      return { ...fresh, avatar_url: null, hobbies: null, interests: null, ai_use: null, onboarded: false } as Profile;
    },
  });

  useEffect(() => {
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const s = { ...DEFAULT_SETTINGS, ...data } as Settings;
          setSettings(s);
          applySettings(s);
        } else {
          supabase.from("user_settings").upsert({ user_id: user.id });
        }
      });
  }, [user.id]);

  useEffect(() => {
    applySettings(settings);
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applySettings(settings);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [settings]);

  const updateSettings = useCallback(
    (p: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...p };
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          supabase.from("user_settings").upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
        }, 400);
        return next;
      });
    },
    [user.id],
  );

  return (
    <Ctx.Provider
      value={{
        user,
        profile: profileQ.data ?? null,
        refreshProfile: () => qc.invalidateQueries({ queryKey: ["profile", user.id] }),
        settings,
        updateSettings,
        customizeOpen,
        setCustomizeOpen,
        paletteOpen,
        setPaletteOpen,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
