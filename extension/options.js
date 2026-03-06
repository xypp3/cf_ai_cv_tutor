const cvTextEl = document.getElementById("cvText");
const mockModeEl = document.getElementById("mockMode");
const endpointEl = document.getElementById("endpoint");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

init();

function init() {
  chrome.storage.local.get(["cvText", "mockMode", "analyzeEndpoint"], (data) => {
    if (data.cvText) cvTextEl.value = data.cvText;
    if (typeof data.mockMode === "boolean") mockModeEl.checked = data.mockMode;
    if (data.analyzeEndpoint) endpointEl.value = data.analyzeEndpoint;
  });

  saveBtn.addEventListener("click", () => {
    const cvText = cvTextEl.value || "";
    const mockMode = mockModeEl.checked;
    const analyzeEndpoint = endpointEl.value || "";
    chrome.storage.local.set(
      { cvText, mockMode, analyzeEndpoint },
      () => showStatus("Saved")
    );
  });
}

function showStatus(msg) {
  statusEl.textContent = msg;
  setTimeout(() => {
    statusEl.textContent = "";
  }, 1500);
}
