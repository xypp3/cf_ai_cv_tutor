import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { loadCvPlainCache } from "../lib/storage";

function textToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.trim().startsWith("•")) {
        return `<p>• ${line.trim().replace(/^•\s*/, "")}</p>`;
      }
      return `<p>${line.trim()}</p>`;
    })
    .join("");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPdf(text: string) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const { width, height } = page.getSize();
  const margin = 50;
  const maxWidth = width - margin * 2;

  const lines = text.split("\n");
  let y = height - margin;
  for (const line of lines) {
    if (y < margin) {
      page.drawText("...truncated...", { x: margin, y, size: fontSize, font });
      break;
    }
    page.drawText(line, { x: margin, y, size: fontSize, font, maxWidth });
    y -= fontSize + 4;
  }

  const pdfBytes = await pdfDoc.save();
  downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "tailored-cv.pdf");
}

async function initEditor() {
  const container = document.getElementById("editor-container");
  const status = document.getElementById("editor-status");
  const exportBtn = document.getElementById("export-pdf");
  if (!container || !status || !exportBtn) return;

  const cached = await loadCvPlainCache();
  const content = cached?.full_text
    ? textToHtml(cached.full_text)
    : "<p>No CV cached. Upload your DOCX in options first.</p>";

  const editor = new Editor({
    element: container,
    extensions: [StarterKit],
    content
  });

  const updateStatus = () => {
    const chars = editor.getText().length;
    status.textContent = `Characters: ${chars}`;
  };
  editor.on("update", updateStatus);
  updateStatus();

  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    status.textContent = "Exporting PDF...";
    try {
      await exportPdf(editor.getText());
      status.textContent = "PDF exported.";
    } catch (err) {
      status.textContent = `Export failed: ${String(err)}`;
    } finally {
      exportBtn.disabled = false;
      updateStatus();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void initEditor();
});
