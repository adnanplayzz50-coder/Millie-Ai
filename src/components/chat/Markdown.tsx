import { useState, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

export function CopyBox({ code, children }: { code: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="not-prose relative my-3 overflow-hidden rounded-xl border border-border bg-muted/40">
      <button
        onClick={() => {
          void navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-sans text-xs text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {children ?? (
        <pre className="overflow-x-auto p-4 pt-10 font-mono text-sm">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => (url.startsWith("data:image/") ? url : defaultUrlTransform(url))}
      components={{
        pre: ({ children }) => (
          <CopyBox code={textOf(children).replace(/\n$/, "")}>
            <pre className="m-0 overflow-x-auto bg-transparent p-4 pt-10 font-mono text-sm">{children}</pre>
          </CopyBox>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
