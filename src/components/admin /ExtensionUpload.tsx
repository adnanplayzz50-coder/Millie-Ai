import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminUploadExtension, getExtensionFile } from "@/lib/admin.functions";

/** Drag the extension .zip from your laptop onto this box to replace the one people download. */
export function ExtensionUpload() {
  const [current, setCurrent] = useState<{ filename: string; version: string } | null>(null);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getExtensionFile().then((f) => f && setCurrent({ filename: f.filename, version: f.version }));
  }, []);

  async function upload(file: File) {
    setMsg(null);
    if (!file.name.toLowerCase().endsWith(".zip")) return setMsg("Please drop a .zip file.");
    if (file.size > 2_000_000) return setMsg("That zip is too big (max 2 MB).");
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      await adminUploadExtension({ data: { filename: file.name, version: version.trim(), base64 } });
      setCurrent({ filename: file.name, version: version.trim() });
      setMsg("Uploaded. People can download it now.");
    } catch (e: any) {
      setMsg(e.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-lg font-semibold">Chrome extension file</h2>
      <p className="text-sm text-muted-foreground">
        {current ? `Current file: ${current.filename}${current.version ? ` (v${current.version})` : ""}` : "No file uploaded yet."}
      </p>
      <input
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
        placeholder="Version, e.g. 9.1.0"
        value={version}
        onChange={(e) => setVersion(e.target.value)}
      />
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm ${dragging ? "border-primary bg-primary/10" : "border-border"}`}
      >
        <span className="font-medium">{busy ? "Uploading…" : "Drop the .zip from your laptop here"}</span>
        <span className="text-muted-foreground">or click to choose a file</span>
        <input
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
