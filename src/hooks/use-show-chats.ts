import { useSyncExternalStore } from "react";

const KEY = "millie-show-chats";
const listeners = new Set<() => void>();

function read() {
  return typeof window === "undefined" ? true : localStorage.getItem(KEY) !== "false";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function setShowChats(show: boolean) {
  localStorage.setItem(KEY, String(show));
  listeners.forEach((l) => l());
}

/** Whether the chat list is shown in the sidebar. Saved on this device. Defaults to shown. */
export function useShowChats() {
  const show = useSyncExternalStore(subscribe, read, () => true);
  return [show, setShowChats] as const;
}
