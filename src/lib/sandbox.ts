/** Runs JavaScript inside a sandboxed iframe (no same-origin access) and collects console output. */
export function runJavaScript(code: string, timeoutMs = 4000): Promise<string[]> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.display = "none";
    const lines: string[] = [];
    const finish = () => {
      window.removeEventListener("message", onMsg);
      iframe.remove();
      resolve(lines);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const d = e.data as { kind: string; text?: string };
      if (d.kind === "log" && d.text !== undefined) lines.push(d.text);
      if (d.kind === "done") finish();
    };
    window.addEventListener("message", onMsg);
    const src = JSON.stringify(code).replace(/<\/script/gi, "<\\/script");
    iframe.srcdoc = `<script>
const send=(t)=>parent.postMessage({kind:'log',text:t},'*');
const fmt=(a)=>a.map(x=>{try{return typeof x==='string'?x:JSON.stringify(x,null,2)}catch{return String(x)}}).join(' ');
['log','info','warn','debug'].forEach(k=>console[k]=(...a)=>send(fmt(a)));
console.error=(...a)=>send('Error: '+fmt(a));
window.onerror=(m)=>{send('Error: '+m);};
(async()=>{try{const r=await (new (Object.getPrototypeOf(async function(){}).constructor)(${src}))();if(r!==undefined)send('→ '+fmt([r]));}catch(e){send('Error: '+(e&&e.message||e));}finally{setTimeout(()=>parent.postMessage({kind:'done'},'*'),50);}})();
<\/script>`;
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        lines.push("(stopped after timeout)");
        finish();
      }
    }, timeoutMs);
  });
}
