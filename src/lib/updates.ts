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
    date: "October 13, 2026",
    updates: [
      {
        title: "Chrome extension, version 9",
        text: "Opens only in Chrome's side panel. Sign in on the website and the extension uses that session.",
      },
      {
        title: "One chat for everything",
        text: "The extension has a single chat box with voice and typing, and no narrator.",
      },
      {
        title: "Chat history in the extension",
        text: "The extension shows your saved chats from the website, split into Recent and Ex-chats. New extension chats are saved to your account.",
      },
      {
        title: "Act on page",
        text: "Millie can click, type, scroll and move between pages in your browser, and asks you to approve each step.",
      },
      {
        title: "Pop-out window",
        text: "Open Millie in a small window for a phone-like view.",
      },
      {
        title: "Clearer sign-in and New chat",
        text: "A clearer sign-in message in the extension, and a labeled New chat button.",
      },
      {
        title: "Settings and sidebar",
        text: "The Hide Ex-Chats switch turns itself on when the Millie extension is installed and signed in.",
      },
    ],
  },
  {
    date: "October 12, 2026",
    updates: [
      {
        title: "Chrome extension setup guide",
        text: "After downloading the extension, a step-by-step page shows how to unzip it and load it in Chrome, with screenshots you can click to zoom.",
      },
      {
        title: "Settings page",
        text: "Edit account, Memory and Customize, plus an Our Apps section with the Chrome extension download. Windows app and Android and iOS are marked \"Coming soon\".",
      },
      {
        title: "Smoother search and screen answers",
        text: "Google search only runs when you turn on the globe button, and if Gemini's free daily limit is reached, Millie still answers with text.",
      },
      {
        title: "Globe button hover text",
        text: "Hovering the globe button now explains what it does.",
      },
      {
        title: "Side panel for the extension",
        text: "Select any area of the page you're viewing, share your screen, and use voice or typing.",
      },
    ],
  },
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
