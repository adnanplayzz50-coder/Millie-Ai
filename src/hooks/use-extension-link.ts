import { useEffect } from "react";
import { setHideExChats } from "./use-hide-ex-chats";

const LINKED_KEY = "millie-extension-linked";

/**
 * When the Millie Chrome extension reports in (installed and signed in), turn on
 * "Hide Ex-Chats" automatically. This happens once, so turning it back off sticks.
 */
export function useExtensionLink() {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.source !== "millie-extension" || e.data?.type !== "ready") return;
      if (localStorage.getItem(LINKED_KEY)) return;
      localStorage.setItem(LINKED_KEY, String(e.data.version ?? "1"));
      setHideExChats(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
