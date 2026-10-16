import { createServerFn } from "@tanstack/react-start";

export const SUPPORT_TOPICS = ["General", "Account", "Chat", "Extension", "Billing", "Bug", "Other"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export type SupportInput = {
  name?: string;
  email: string;
  topic: SupportTopic;
  message: string;
};

/**
 * Support form submission from the /welcome page.
 * TODO: deliver to a real inbox (e.g. an email service) once a sender
 * domain is configured; for now the message is validated and logged
 * server-side so nothing is trusted from the browser.
 */
export const submitSupport = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as SupportInput)
  .handler(async ({ data }) => {
    const email = (data?.email ?? "").trim();
    const message = (data?.message ?? "").trim();
    const topic = SUPPORT_TOPICS.includes(data?.topic) ? data.topic : "General";
    const name = (data?.name ?? "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (message.length < 5) {
      throw new Error("Please write a little more so we can help.");
    }

    console.log("[support]", JSON.stringify({ topic, name, email, message }));
    return { ok: true as const };
  });
