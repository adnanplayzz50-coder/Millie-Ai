export interface Update {
  title: string;
  text: string;
}

export interface UpdateGroup {
  date: string;
  updates: Update[];
}

/** Recent updates shown in "What's new", grouped by date. Newest group first. */
export const UPDATE_GROUPS: UpdateGroup[] = [
  {
    date: "October 11, 2026",
    updates: [
      {
        title: "Side panel page",
        text: "A compact /sidebar page for the Chrome side panel, with the chat, screenshots and video calls.",
      },
      {
        title: "What's new button",
        text: "A button that lists recent updates to Millie AI.",
      },
    ],
  },
  {
    date: "October 10, 2026",
    updates: [
      {
        title: "Video call with Millie",
        text: "Share your screen or camera and talk to Millie about it, with a pen to mark the exact spot.",
      },
      {
        title: "Select part of an image",
        text: "Crop just the part you want Millie to focus on.",
      },
    ],
  },
  {
    date: "October 9, 2026",
    updates: [
      {
        title: "C0DE builds whole projects",
        text: "Copy buttons on code, full projects shown file by file, download as a ZIP.",
      },
    ],
  },
  {
    date: "October 8, 2026",
    updates: [
      {
        title: "Image generation",
        text: "Ask Millie to draw or create a picture.",
      },
    ],
  },
  {
    date: "October 7, 2026",
    updates: [
      {
        title: "Google search with sources",
        text: "Globe button, with sources listed.",
      },
    ],
  },
  {
    date: "October 6, 2026",
    updates: [
      {
        title: "Sign in with Google, Apple or Microsoft",
        text: "Buttons show each provider's logo.",
      },
    ],
  },
  {
    date: "October 5, 2026",
    updates: [
      {
        title: "Hey Millie",
        text: "Wake word in Settings, say \"Hey Millie\" in Chrome or Edge.",
      },
    ],
  },
];
