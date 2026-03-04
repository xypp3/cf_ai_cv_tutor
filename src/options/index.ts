// Options page: handle DOCX upload and worker credentials (placeholder wiring).
import { uploadCv } from "../lib/ai";
import { loadSecrets, saveSecrets, saveCvPlainCache } from "../lib/storage";
import { extractDocxText, hashArrayBuffer } from "../lib/docx";

async function init() {
  const workerBaseInput = document.getElementById("worker-base") as HTMLInputElement | null;
  const workerTokenInput = document.getElementById("worker-token") as HTMLInputElement | null;
  const saveBtn = document.getElementById("save-creds") as HTMLButtonElement | null;
  const uploadInput = document.getElementById("cv-upload") as HTMLInputElement | null;
  const status = document.getElementById("status");

  let secrets = await loadSecrets();
  if (workerBaseInput && secrets.workerBase) workerBaseInput.value = secrets.workerBase;
  if (workerTokenInput && secrets.workerToken) workerTokenInput.value = secrets.workerToken;

  saveBtn?.addEventListener("click", async () => {
    secrets = {
      workerBase: workerBaseInput?.value,
      workerToken: workerTokenInput?.value
    };
    await saveSecrets(secrets);
    if (status) status.textContent = "Saved worker settings.";
  });

  uploadInput?.addEventListener("change", async () => {
    if (!uploadInput.files || uploadInput.files.length === 0) return;
    const file = uploadInput.files[0];
    try {
      const buf = await file.arrayBuffer();
      const hash = await hashArrayBuffer(buf);
      const full_text = await extractDocxText(file);
      await saveCvPlainCache({
        full_text,
        hash,
        updated_at: new Date().toISOString(),
        source: "manual_upload"
      });
      // Optionally mirror to Worker if configured.
      if (secrets.workerBase && secrets.workerToken) {
        try {
          const result = await uploadCv(secrets.workerBase, secrets.workerToken, file);
          if (status) status.textContent = `Stored locally; uploaded CV (hash ${result.hash.slice(0, 8)}...).`;
          return;
        } catch (err) {
          if (status) status.textContent = `Stored locally; upload failed: ${String(err)}`;
          return;
        }
      }
      if (status) status.textContent = `Stored CV locally (hash ${hash.slice(0, 8)}...).`;
    } catch (e) {
      if (status) status.textContent = `Upload failed: ${String(e)}`;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void init();
});
