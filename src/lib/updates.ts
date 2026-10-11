export interface Update {
  date: string;
  title: string;
  text: string;
}

/** Recent updates shown in "What's new". Newest first. Add new entries at the top. */
export const UPDATES: Update[] = [
  {
    date: "2026-10-11",
    title: "Side panel page",
    text: "A compact /sidebar page for the Chrome side panel, with the chat, screenshots and video calls.",
  },
  {
    date: "2026-10-11",
    title: "What's new",
    text: "A button that lists recent updates to Millie AI.",
  },
  {
    date: "2026-10-10",
    title: "Video call with Millie",
    text: "Share your screen or camera and talk to Millie about what it sees, with a pen to mark the exact spot.",
  },
  {
    date: "2026-10-10",
    title: "Select part of an image",
    text: "Click an attached picture or screenshot to crop just the part you want Millie to focus on.",
  },
  {
    date: "2026-10-09",
    title: "C0DE builds whole projects",
    text: "Code blocks have copy buttons. Full projects show each file, and you can download them as a ZIP.",
  },
  {
    date: "2026-10-08",
    title: "Image generation",
    text: "Ask Millie to draw or create a picture and it will make one for you.",
  },
  {
    date: "2026-10-07",
    title: "Google search with sources",
    text: "Turn on the globe button to search the web, and Millie lists where its answer came from.",
  },
  {
    date: "2026-10-06",
    title: "Sign in with Google, Apple or Microsoft",
    text: "Sign in with the account you already use. The buttons show each provider's logo.",
  },
  {
    date: "2026-10-05",
    title: "Hey Millie",
    text: "Turn on the wake word in Settings, then say \"Hey Millie\" to talk hands-free while Millie is open in Chrome or Edge.",
  },
];
