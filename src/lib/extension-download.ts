import { getExtensionFile } from "@/lib/admin.functions";

/** Downloads the Millie extension zip that the admin uploaded. Works without any link. */
export async function downloadExtension(): Promise<boolean> {
  const file = await getExtensionFile();
  if (!file) {
    alert("The Millie extension hasn't been uploaded yet. Please check back soon.");
    return false;
  }
  const bytes = Uint8Array.from(atob(file.content_base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
