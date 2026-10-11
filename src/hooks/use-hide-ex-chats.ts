import { useSyncExternalStore } from "react";

const KEY = "millie-hide-ex-chats";
const listeners = new Set<() => void>();

function read() {
  return typeof window !== "undefined" && localStorage.getItem(KEY) === "true";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function setHideExChats(hide: boolean) {
  localStorage.setItem(KEY, String(hide));
  listeners.forEach((l) => l());
}

/** Whether the Ex-Chats category is hidden. Saved on this device. Defaults to shown. */
export function useHideExChats() {
  const hide = useSyncExternalStore(subscribe, read, () => false);
  return [hide, setHideExChats] as const;
}
