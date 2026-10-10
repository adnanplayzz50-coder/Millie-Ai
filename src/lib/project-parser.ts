export interface ParsedFile {
  path: string;
  content: string;
  complete: boolean;
}
export interface ParsedProject {
  name: string;
  steps: string[];
  files: ParsedFile[];
  done: boolean;
}

function clean(content: string) {
  let c = content.replace(/^\r?\n/, "");
  const fence = /^```[\w-]*\n([\s\S]*?)\n?```\s*$/.exec(c);
  if (fence) c = fence[1];
  return c.replace(/\s+$/, "") + "\n";
}

/** Splits a (possibly partial, still streaming) reply into text + project parts. */
export function parseReply(text: string): { before: string; project: ParsedProject | null; after: string } {
  const start = text.indexOf("<project");
  if (start < 0) {
    // hide a dangling partial tag while streaming
    const partial = text.lastIndexOf("<");
    if (partial >= 0 && "<project".startsWith(text.slice(partial))) return { before: text.slice(0, partial), project: null, after: "" };
    return { before: text, project: null, after: "" };
  }
  const end = text.indexOf("</project>", start);
  const body = text.slice(start, end < 0 ? undefined : end);
  const name = /<project\s+name="([^"]*)"/.exec(body)?.[1] || "millie-project";
  const steps = [...body.matchAll(/<step>([\s\S]*?)(?:<\/step>|$)/g)].map((m) => m[1].trim()).filter(Boolean);
  const files = [...body.matchAll(/<file\s+path="([^"]+)"\s*>([\s\S]*?)(<\/file>|$)/g)].map((m) => ({
    path: m[1].replace(/^\.?\//, ""),
    content: clean(m[2]),
    complete: m[3] === "</file>",
  }));
  return {
    before: text.slice(0, start),
    project: { name, steps, files, done: end >= 0 },
    after: end >= 0 ? text.slice(end + "</project>".length) : "",
  };
}
