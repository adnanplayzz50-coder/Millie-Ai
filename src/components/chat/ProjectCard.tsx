import { useState } from "react";
import JSZip from "jszip";
import { CheckCircle2, ChevronRight, Circle, Download, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParsedProject } from "@/lib/project-parser";
import { cn } from "@/lib/utils";
import { CopyBox } from "./Markdown";

export function ProjectCard({ project }: { project: ParsedProject }) {
  const [open, setOpen] = useState<string | null>(null);

  async function download() {
    const zip = new JSZip();
    for (const f of project.files) zip.file(`${project.name}/${f.path}`, f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="not-prose my-3 rounded-2xl border border-border bg-card p-4 font-sans">
      <p className="text-sm">
        <span className="text-muted-foreground">{project.done ? "Built" : "Building"}</span>{" "}
        <span className="font-mono font-medium">{project.name}</span>{" "}
        <span className="text-muted-foreground">· {project.files.length} file{project.files.length === 1 ? "" : "s"}</span>
      </p>
      {!!project.steps.length && (
        <ul className="mt-3 space-y-1 text-sm">
          {project.steps.map((s, i) => {
            const done = project.done || i < project.steps.length - 1;
            return (
              <li key={i} className="flex items-center gap-2">
                {done ? <CheckCircle2 className="size-4 text-primary" /> : <Circle className="size-4 animate-pulse text-muted-foreground" />}
                <span className={cn(!done && "text-muted-foreground")}>{s}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 divide-y divide-border rounded-xl border border-border">
        {project.files.map((f) => (
          <div key={f.path}>
            <button onClick={() => setOpen(open === f.path ? null : f.path)} className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-sm hover:bg-muted">
              <ChevronRight className={cn("size-4 transition-transform", open === f.path && "rotate-90")} />
              <FileCode className="size-4 text-muted-foreground" />
              {f.path}
              {!f.complete && <span className="ml-auto text-xs text-muted-foreground">writing…</span>}
            </button>
            {open === f.path && (
              <div className="px-3 pb-3">
                <CopyBox code={f.content} />
              </div>
            )}
          </div>
        ))}
      </div>
      {project.done && (
        <div className="mt-3">
          <Button onClick={() => void download()}>
            <Download className="size-4" /> Download full project
          </Button>
          <p className="mt-1 text-xs text-muted-foreground opacity-70">Project may have errors</p>
        </div>
      )}
    </div>
  );
}
