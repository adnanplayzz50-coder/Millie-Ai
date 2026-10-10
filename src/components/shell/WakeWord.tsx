import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApp } from "@/components/app/AppProvider";
import { chime, getRecognition, speechSupported } from "@/lib/speech";
import { createConversation, useInvalidate } from "@/hooks/use-data";
import { setPending } from "@/lib/pending";

type WakeState = "off" | "idle" | "listening";
const WakeCtx = createContext<WakeState>("off");
export const useWakeState = () => useContext(WakeCtx);

const WAKE = /\bhey,?\s*(millie|milly|mili|mily|mille|millie's|melly|miley|milli|meli|mollie)\b[,.!]?\s*/i;

/** "Hey Millie" wake word using continuous browser speech recognition. */
export function WakeWordProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useApp();
  const [state, setState] = useState<WakeState>("off");
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const stateRef = useRef<WakeState>("off");
  stateRef.current = state;

  useEffect(() => {
    if (!settings.wake_word) {
      setState("off");
      return;
    }
    if (!speechSupported()) {
      toast.error("Wake word needs Chrome or Edge speech recognition.");
      updateSettings({ wake_word: false });
      return;
    }
    let stopped = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rec: any = null;
    let captureTimer: ReturnType<typeof setTimeout> | undefined;

    const send = async (text: string) => {
      setState("idle");
      const id = await createConversation({ mode: "chat", title: text });
      setPending(id, { text, attachments: [], webSearch: false, speak: true });
      invalidate("conversations");
      navigate({ to: "/c/$id", params: { id } });
    };

    const start = () => {
      if (stopped || document.hidden) return;
      rec = getRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || "en-US";
      rec.onresult = (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) continue;
          const said = e.results[i][0].transcript.trim();
          if (stateRef.current === "listening") {
            clearTimeout(captureTimer);
            if (said) void send(said);
            continue;
          }
          const m = WAKE.exec(said);
          if (m) {
            chime();
            const rest = said.slice(m.index + m[0].length).trim();
            if (rest.split(" ").length >= 2) {
              void send(rest);
            } else {
              setState("listening");
              captureTimer = setTimeout(() => setState("idle"), 9000);
            }
          }
        }
      };
      rec.onerror = (e: { error: string }) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          stopped = true;
          toast.error("Microphone permission denied — wake word turned off.");
          updateSettings({ wake_word: false });
        }
      };
      rec.onend = () => {
        if (!stopped && !document.hidden) setTimeout(start, 300);
      };
      try {
        rec.start();
        setState((s) => (s === "listening" ? s : "idle"));
      } catch {
        /* already started */
      }
    };

    const onVis = () => {
      if (document.hidden) rec?.abort();
      else start();
    };

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        s.getTracks().forEach((t) => t.stop());
        start();
      })
      .catch(() => {
        toast.error("Microphone permission is needed for “Hey Millie”.");
        updateSettings({ wake_word: false });
      });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(captureTimer);
      document.removeEventListener("visibilitychange", onVis);
      rec?.abort();
      setState("off");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.wake_word]);

  return <WakeCtx.Provider value={state}>{children}</WakeCtx.Provider>;
}
