const elements = {
  apiNotice: document.querySelector("#apiNotice"),
  allCount: document.querySelector("#allCount"),
  classifyButton: document.querySelector("#classifyButton"),
  classifyError: document.querySelector("#classifyError"),
  connectionDescription: document.querySelector("#connectionDescription"),
  connectionDot: document.querySelector("#connectionDot"),
  connectionTitle: document.querySelector("#connectionTitle"),
  emptyState: document.querySelector("#emptyState"),
  exportJsonl: document.querySelector("#exportJsonl"),
  exportPdf: document.querySelector("#exportPdf"),
  folderList: document.querySelector("#folderList"),
  inputCount: document.querySelector("#inputCount"),
  messageCount: document.querySelector("#messageCount"),
  messageInput: document.querySelector("#messageInput"),
  modelError: document.querySelector("#modelError"),
  modelTestButton: document.querySelector("#testModelButton"),
  modelTestResult: document.querySelector("#modelTestResult"),
  progressCaption: document.querySelector("#progressCaption"),
  progressFill: document.querySelector("#progressFill"),
  progressWrap: document.querySelector("#progressWrap"),
  resultsList: document.querySelector("#resultsList"),
  resultsTitle: document.querySelector("#resultsTitle"),
};

const state = {
  apiConfigured: false,
  categories: [],
  folder: "all",
  messages: [],
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

function setConnection(connected, title, description) {
  elements.connectionDot.className = `connection-dot ${connected ? "online" : "offline"}`;
  elements.connectionTitle.textContent = title;
  elements.connectionDescription.textContent = description;
}

async function loadSetup() {
  elements.modelError.hidden = true;
  try {
    const config = await fetchJson("/api/config");
    state.apiConfigured = config.apiConfigured;
    state.categories = config.categories;
    renderFolders();
    if (!state.apiConfigured) {
      setConnection(false, "Cloudflare setup needed", "Add Workers AI credentials in .env");
      elements.apiNotice.textContent = "Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to your local .env file, then restart the app. The credentials stay on the server.";
      elements.apiNotice.hidden = false;
      elements.modelError.hidden = true;
      return;
    }
    setConnection(true, "Cloudflare credentials set", "Workers AI · Clef Flash");
    elements.apiNotice.hidden = true;
    elements.modelError.hidden = true;
  } catch (error) {
    elements.modelError.textContent = error.message;
    elements.modelError.hidden = false;
    setConnection(false, "Setup unavailable", "Check the local server");
  }
}

async function testModelResponse() {
  elements.modelTestButton.disabled = true;
  elements.modelTestResult.hidden = false;
  elements.modelTestResult.textContent = "Testing Cloudflare Clef Flash…";
  try {
    const result = await fetchJson("/api/model/test", { method: "POST" });
    const confidence = Number.isFinite(result.confidence)
      ? ` · ${(result.confidence * 100).toFixed(1)}% confidence`
      : "";
    elements.modelTestResult.textContent = `${result.passed ? "Passed" : "Unexpected category"} · ${result.category}${confidence} · ${result.latencyMs} ms`;
  } catch (error) {
    elements.modelTestResult.textContent = `Test failed · ${error.message}`;
  } finally {
    elements.modelTestButton.disabled = false;
  }
}

function renderFolders() {
  elements.folderList.replaceChildren();
  const folders = [{ id: "all", name: "All messages" }, ...state.categories.map((name) => ({ id: name, name }))];
  for (const folder of folders) {
    const count = folder.id === "all"
      ? state.messages.length
      : state.messages.filter((item) => item.category === folder.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `folder${state.folder === folder.id ? " active" : ""}`;
    button.dataset.folder = folder.id;
    const name = document.createElement("span");
    name.textContent = folder.name;
    const badge = document.createElement("span");
    badge.className = "folder-count";
    badge.textContent = String(count);
    button.append(name, badge);
    elements.folderList.append(button);
  }
  elements.allCount.textContent = String(state.messages.length);
}

function renderMessages() {
  const visible = state.folder === "all"
    ? state.messages
    : state.messages.filter((item) => item.category === state.folder);
  elements.resultsTitle.textContent = state.folder === "all" ? "All messages" : state.folder;
  elements.resultsList.replaceChildren();
  for (const record of visible) {
    const card = document.createElement("article");
    card.className = "message-card";
    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = record.text;
    const footer = document.createElement("div");
    footer.className = "message-footer";
    const label = document.createElement("span");
    label.className = "tag";
    label.textContent = record.category;
    const model = document.createElement("span");
    model.className = "message-meta";
    model.textContent = record.model;
    const latency = document.createElement("span");
    latency.className = "message-meta";
    latency.textContent = `${record.latencyMs} ms`;
    const timestamp = document.createElement("span");
    timestamp.className = "message-meta";
    timestamp.textContent = record.createdAt;
    footer.append(label, model, latency, timestamp);
    if (Number.isFinite(record.confidence)) {
      const confidence = document.createElement("span");
      confidence.className = "message-meta";
      confidence.textContent = `${(record.confidence * 100).toFixed(1)}% confidence`;
      footer.append(confidence);
    }
    card.append(text, footer);
    elements.resultsList.append(card);
  }

  elements.messageCount.textContent = String(state.messages.length);
  elements.emptyState.hidden = visible.length > 0;
  elements.exportJsonl.disabled = state.messages.length === 0;
  elements.exportPdf.disabled = state.messages.length === 0;
  renderFolders();
}

function updateInputCount() {
  const count = elements.messageInput.value.split(/\r?\n/).filter((line) => line.trim()).length;
  elements.inputCount.textContent = `${count.toLocaleString()} message${count === 1 ? "" : "s"} ready`;
}

async function classifyBatch() {
  const messages = elements.messageInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  elements.classifyError.hidden = true;
  if (messages.length === 0) {
    elements.classifyError.textContent = "Paste at least one message, one per line.";
    elements.classifyError.hidden = false;
    return;
  }
  if (!state.apiConfigured) {
    elements.classifyError.textContent = "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env and restart the server before classifying.";
    elements.classifyError.hidden = false;
    return;
  }

  elements.classifyButton.disabled = true;
  elements.progressWrap.hidden = false;
  elements.progressFill.style.width = "0%";
  let completed = 0;
  try {
    for (const message of messages) {
      elements.progressCaption.textContent = `Classifying ${completed + 1} of ${messages.length} with Clef Flash…`;
      const result = await fetchJson("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      state.messages.unshift({
        text: message,
        category: result.category,
        model: result.model,
        confidence: result.confidence,
        latencyMs: result.latencyMs,
        createdAt: new Date().toLocaleString(),
      });
      completed += 1;
      elements.progressFill.style.width = `${(completed / messages.length) * 100}%`;
      elements.progressCaption.textContent = `Classified ${completed} of ${messages.length} messages`;
      renderMessages();
    }
    elements.messageInput.value = "";
    updateInputCount();
  } catch (error) {
    elements.classifyError.textContent = `${error.message} ${completed} message${completed === 1 ? "" : "s"} completed before the error.`;
    elements.classifyError.hidden = false;
  } finally {
    elements.classifyButton.disabled = false;
  }
}

function downloadJsonl() {
  const content = state.messages.map((record) => JSON.stringify({
    text: record.text,
    category: record.category,
    model: record.model,
    confidence: record.confidence,
    latencyMs: record.latencyMs,
    createdAt: record.createdAt,
  })).join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "application/x-ndjson" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "classified_messages.jsonl";
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf() {
  elements.exportPdf.disabled = true;
  try {
    const response = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: state.messages }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `PDF export failed (${response.status}).`);
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "classified_messages.pdf";
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    elements.classifyError.textContent = error.message;
    elements.classifyError.hidden = false;
  } finally {
    elements.exportPdf.disabled = state.messages.length === 0;
  }
}

elements.messageInput.addEventListener("input", updateInputCount);
elements.classifyButton.addEventListener("click", classifyBatch);
elements.modelTestButton.addEventListener("click", testModelResponse);
elements.exportJsonl.addEventListener("click", downloadJsonl);
elements.exportPdf.addEventListener("click", downloadPdf);
elements.folderList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-folder]");
  if (!button) return;
  state.folder = button.dataset.folder;
  renderMessages();
});

updateInputCount();
loadSetup();
