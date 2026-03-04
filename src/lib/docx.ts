import JSZip from "jszip";

// Compute SHA-256 hash for change detection.
export async function hashArrayBuffer(buf: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Parse DOCX -> plaintext preserving paragraph and bullet spacing.
export async function extractDocxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file("word/document.xml")?.async("text");
  if (!docXml) throw new Error("DOCX missing word/document.xml");

  const parser = new DOMParser();
  const xml = parser.parseFromString(docXml, "application/xml");
  const paras = Array.from(xml.getElementsByTagName("w:p"));
  const lines: string[] = [];

  for (const p of paras) {
    const texts = Array.from(p.getElementsByTagName("w:t")).map((t) => t.textContent || "");
    const line = texts.join("");
    // Detect basic bullets by presence of numPr; prefix with bullet if so.
    const isBullet = p.getElementsByTagName("w:numPr").length > 0;
    lines.push(isBullet ? `• ${line}` : line);
  }

  return lines.join("\n").trim();
}
