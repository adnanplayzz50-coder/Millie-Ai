import { useState } from "react";
import { Download, FileText, Image as ImageIcon, Presentation, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFile, downloadBlob, type FileKind } from "@/lib/file-gen";

const KINDS: { kind: FileKind; label: string; Icon: typeof FileText }[] = [
  { kind: "docx", label: "Word (.docx)", Icon: FileText },
  { kind: "pptx", label: "PowerPoint (.pptx)", Icon: Presentation },
  { kind: "pdf", label: "PDF", Icon: FileType },
  { kind: "png", label: "Poster (PNG)", Icon: ImageIcon },
];

/** "Create file" card under a reply. Files are built in memory from the reply text. */
export function FileCard({ content }: { content: string }) {
  const [busy, setBusy] = useState<FileKind | null>(null);
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [err, setErr] = useState("");

  async function make(kind: FileKind) {
    setBusy(kind); setErr(""); setFile(null);
    try {
      setFile(await buildFile(kind, content));
    } catch (e) {
      setErr((e as Error).message || "Couldn't create the file.");
    }
    setBusy(null);
  }

  return (
    <div className="not-prose mt-4 rounded-xl border border-border bg-card p-3 font-sans">
      <p className="mb-2 text-sm font-medium">Create file</p>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(({ kind, label, Icon }) => (
          <Button key={kind} variant="outline" size="sm" disabled={!!busy} onClick={() => void make(kind)}>
            <Icon className="size-4" /> {label}
          </Button>
        ))}
      </div>
      {busy && <p className="shimmer-text mt-2 text-xs">Building your file…</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      {file && (
        <Button size="sm" className="mt-3" onClick={() => downloadBlob(file.blob, file.name)}>
          <Download className="size-4" /> Download {file.name}
        </Button>
      )}
    </div>
  );
}
