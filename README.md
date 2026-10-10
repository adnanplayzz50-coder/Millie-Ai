# Millie's Insight

Build "Millie AI" (two L's: M-i-l-l-i-e). A sleek, purple AI chat web app that is installable as an app. Everything runs on free tiers. Keep all API keys on the server only, never in frontend code.

REFERENCE: a working prototype exists at https://id-preview--1fdbfa53-cecd-48f2-aafd-b6c3e8813485.lovable.app . Use it for layout and style inspiration only. Build the full version described below, and fix anything in the prototype that is broken or missing.

BRAND AND LOOK
- Minimal, refined, purple. Thin borders, generous spacing, subtle transitions, soft glass-style sidebar.
- LOGO: a hollow, outline-only circle (no fill, transparent inside) with three concentric curved sound-wave arcs to its left, drawn as clean purple strokes. Keep the circle a bit smaller relative to the arcs. Use it in the header, sidebar, login screen, favicon, and the PWA manifest icons.
- EMPTY CHAT SCREEN: only the logo, centered, with the text "Hello how may I help ?" under it. No suggestion cards.
- THEMES: three purple accent palettes: Deep violet (dark and rich), Soft lavender (light and calm), Bright electric purple. Each works in light, dark, and system mode.
- FONTS: default is a close free match to Claude's interface typography: Newsreader (serif) for chat replies and headings, Inter for the UI. Five font choices in total: this default, Space Grotesk, JetBrains Mono, Lora, Outfit (Google Fonts).
- THINKING INDICATOR: while waiting for a reply, show "Thinking" with a shimmer, then cycle through words such as Pondering, Ruminating, Cogitating, Synthesizing, Percolating, Conjuring, Deliberating, Contemplating, Simmering, Brewing.
- Responsive for phone and desktop, and installable as a PWA (manifest and service worker) for Windows and Android.

CUSTOMIZE
- A Customize button in the sidebar footer opens a panel to change: font (5 options), accent palette (3 presets plus a custom color picker), theme (light, dark, system). Live preview. Save per user in the database.

ACCOUNTS
- Sign-in is required on first visit. Offer: email and password, plus "Continue with Google", "Continue with Apple", and "Continue with Microsoft". Use Lovable Cloud's built-in social sign-in. Google, Apple, and Microsoft are already configured in the Cloud panel, so wire them up and do not ask for new credentials.
- First-time users see an OPTIONAL onboarding that asks about their hobbies, their interests, and what they'll use AI for. A Skip button is always visible. Save the answers to their profile and use them for light personalization.
- Account page: edit display name, upload avatar, change email and password, sign out, delete account with a confirmation step.

CHAT
- Streaming replies. Sidebar with conversations: search, pin, rename, delete. Export any conversation as a Markdown file.
- Two modes with a switcher: "Chat" and "C0DE" (written with a zero). Each has its own starter-free empty screen and its own system prompt.
- C0DE is a coding assistant (Codex/Copilot style): monospace accents, syntax-highlighted code blocks with a Copy button, and a Run button on JavaScript blocks that runs the code in a sandboxed iframe and shows the output below the block.
- C0DE BUILDS WHOLE PROJECTS: when asked to build something (app, website, plugin, script, bot, game), the model replies with a full project in this format: <project name="kebab-name"> containing <step>short present-tense step</step> lines and <file path="relative/path">complete file contents</file> blocks. Parse it while streaming. Show a live activity log of the steps, a file tree where each file expands to show its code, and a "Download full project" button that bundles all files into a ZIP in the browser (JSZip). Under the download button, very small faded text reads "Project may have errors".
- Command palette on Ctrl+K: search chats, new chat, switch mode, open settings.

AI BACKEND (server functions, keys read from secrets)
- Text chat: Groq API, chat completions, model llama-3.3-70b-versatile, secret name GROQ_API_KEY.
- Vision (images, screenshots, video call frames): Gemini API, secret name GEMINI_API_KEY.
- Web search: a globe "Search the web" toggle beside the message box, using the Gemini API's Google Search grounding tool (google_search) with GEMINI_API_KEY. Show the answer with a Sources list (title and link) from the grounding metadata. Search automatically when the message clearly asks for current information (news, prices, scores, "latest", "today").
- If a key is missing or a request fails, show a clear message that says which key to add in the project's secrets. Never ask for keys inside the chat UI.

MEMORY
- Store durable facts about each user (preferences, ongoing projects, routines). After a conversation, a small Groq call extracts facts worth remembering and saves them. Before replies, quietly add only the relevant facts to the system prompt.
- Memory manager page to see, edit, and delete saved facts.

PROJECTS (like Claude Projects)
- Projects tab in the sidebar: create, rename, delete. Each project has a name, description, custom instructions, and attached files and folders as project knowledge. Chats started in a project inherit its instructions and files. The project page lists its chats.

ATTACHMENTS AND SCREENSHOTS
- Paperclip menu beside the message box: Add image, Add file, Add folder (folder picker; include text and code files; skip node_modules, .git, and very large or binary files). Also drag-and-drop and paste images. Show removable chips above the input. Text and code contents go into the message as context; images go to Gemini vision.
- Camera button opens a menu with two options: "Take a screenshot" and "Start a video call with Millie".
- Screenshot: getDisplayMedia lets the user pick a screen, window, or tab; grab one frame, stop capture, attach it. Shortcut Ctrl+Shift+S while the tab is focused. Note that the web version only captures when the user clicks.
- Clicking an attached image or screenshot opens a modal where the user drags a resizable selection rectangle, with two buttons: "Use selected area" (crop with canvas and replace the attachment) and "Use full image".

VIDEO CALL WITH MILLIE (split screen)
- Start the call by choosing "Share my screen" or "Use my camera".
- Left side: live preview of what is shared. Right side: the conversation panel with a message box.
- A "Sharing is on" indicator and an End button. Capture only while the call is active.
- Each message sends the current frame to Gemini vision so Millie answers about what it sees.
- Dictation and read-aloud work during the call.
- A pen icon freezes the frame. The user circles or draws on the exact thing; the marked area is sent with their next message (full frame with the marking, plus a close-up of the marked area). Millie answers about exactly that.

VOICE
- Mic button to dictate messages. Option to read replies aloud (browser speech recognition and speech synthesis).
- "Hey Millie" wake word: a Settings toggle, OFF by default. When on, ask for microphone permission, show a small listening indicator near the logo, and use continuous recognition. On "Hey Millie" (or variants such as "hey mili"), play a soft chime, show "Listening...", capture the next spoken sentence, send it to chat, and read the reply aloud. Auto-restart when recognition stops, pause when the tab is hidden, and note that it works only while the tab is open in Chrome or Edge and that audio may be sent to the browser's speech service. Provide a visible way to turn it off.

SEARCH AND EXTRAS
- Export conversations as Markdown, pin and rename chats.
- Light and dark toggle in the sidebar and in Customize.

DATA AND SECURITY
- Tables for profiles, user settings, conversations, messages, memory facts, projects, and project files. Row-level security so each user only sees their own data.
- Use only free-tier services. Keep the code tidy and split into small components.

NOT IN THIS BUILD (do not build): Windows app, Android app, Google Home control, screen control where Millie clicks for you, the secret browser, image generation, video generation, document file generation (pptx, docx, pdf), and paid-model debate mode. Leave a clear note in the README listing these as future work.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/57707539-3fd5-4623-a74d-5f908fe26681).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
