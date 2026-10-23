const elements = {
  apiNotice: document.querySelector("#apiNotice"),
  allCount: document.querySelector("#allCount"),
  classifyButton: document.querySelector("#classifyButton"),
  classifyError: document.querySelector("#classifyError"),
  connectionDescription: document.querySelector("#connectionDescription"),
  connectionDot: document.querySelector("#connectionDot"),
  connectionTitle: document.querySelector("#connectionTitle"),
  decisionModelList: document.querySelector("#decisionModelList"),
  emptyState: document.querySelector("#emptyState"),
  exportJsonl: document.querySelector("#exportJsonl"),
  exportPdf: document.querySelector("#exportPdf"),
  folderList: document.querySelector("#folderList"),
  inputCount: document.querySelector("#inputCount"),
  messageCount: document.querySelector("#messageCount"),
  messageInput: document.querySelector("#messageInput"),
  modelDetails: document.querySelector("#modelDetails"),
  modelError: document.querySelector("#modelError"),
  modelSearch: document.querySelector("#modelSearch"),
  modelSelect: document.querySelector("#modelSelect"),
  progressCaption: document.querySelector("#progressCaption"),
  progressFill: document.querySelector("#progressFill"),
  progressWrap: document.querySelector("#progressWrap"),
  recommendationNote: document.querySelector("#recommendationNote"),
  refreshModels: document.querySelector("#refreshModels"),
  resultsList: document.querySelector("#resultsList"),
  resultsTitle: document.querySelector("#resultsTitle"),
};

const state = {
  apiKeyConfigured: false,
  categories: [],
  candidates: [],
  folder: "all",
  messages: [],
  models: [],
  recommendedModelId: "",
};

function formatUsdPerMillion(perTokenPrice) {
  const price = Number.parseFloat(perTokenPrice);
  if (!Number.isFinite(price)) return "not listed";
  if (price === 0) return "free";
  const perMillion = price * 1_000_000;
  return `$${perMillion < 0.01 ? perMillion.toFixed(4) : perMillion.toFixed(2)} / 1M tokens`;
}

function formatContext(contextLength) {
  const value = Number(contextLength);
  if (!Number.isFinite(value) || value <= 0) return "context n/a";
  return `${new Intl.NumberFormat().format(value)} context`;
}

function formatCost(cost) {
  if (!Number.isFinite(cost)) return "Cost unavailable";
  return cost === 0 ? "Free" : `~$${cost.toFixed(cost < 0.001 ? 6 : 4)}`;
}

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

function renderModelDetails() {
  const model = state.models.find((item) => item.id === elements.modelSelect.value);
  elements.modelDetails.replaceChildren();
  if (!model) return;
  const prices = model.pricing || {};
  const details = [
    formatContext(model.context_length),
    `Input ${formatUsdPerMillion(prices.prompt)}`,
    `Output ${formatUsdPerMillion(prices.completion)}`,
  ];
  for (const detail of details) {
    const chip = document.createElement("span");
    chip.className = "detail-chip";
    chip.textContent = detail;
    elements.modelDetails.append(chip);
  }
  const recommended = model.id === state.recommendedModelId;
  elements.recommendationNote.textContent = recommended
    ? "★ Recommended value pick: lowest listed token cost among models with a 16k+ context window. This is a price/context heuristic, not a quality ranking."
    : "Choose any listed model. Cost and context details come from the live OpenRouter catalog; verify current pricing before use.";
}

function renderModelOptions() {
  const selected = elements.modelSelect.value;
  const query = elements.modelSearch.value.trim().toLowerCase();
  const filtered = state.models.filter((model) => {
    const searchable = `${model.name || ""} ${model.id || ""}`.toLowerCase();
    return searchable.includes(query);
  });
  elements.modelSelect.replaceChildren();
  if (filtered.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = !state.apiKeyConfigured
      ? "OpenRouter API key required"
      : state.models.length === 0
        ? "No report-listed decision models are available"
        : "No matching models";
    elements.modelSelect.append(option);
    renderModelDetails();
    elements.recommendationNote.textContent = !state.apiKeyConfigured
      ? "Add your OpenRouter API key to fetch the report-listed decision models."
      : state.models.length === 0
        ? "No exact models from the comparison report are currently available in this OpenRouter catalog. General models are intentionally hidden."
        : "No models matched your search. Try a provider name or model ID.";
    return;
  }

  for (const model of filtered) {
    const option = document.createElement("option");
    option.value = model.id;
    const suffix = model.id === state.recommendedModelId ? " · recommended value" : "";
    option.textContent = `${model.name || model.id}${suffix}`;
    elements.modelSelect.append(option);
  }
  const selectedStillVisible = filtered.some((model) => model.id === selected);
  const preferred = selectedStillVisible
    ? selected
    : filtered.some((model) => model.id === state.recommendedModelId)
      ? state.recommendedModelId
      : filtered[0].id;
  elements.modelSelect.value = preferred;
  renderModelDetails();
}

function renderDecisionModels() {
  elements.decisionModelList.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "candidate-heading";
  const title = document.createElement("strong");
  title.textContent = `Decision models from report (${state.candidates.length})`;
  const note = document.createElement("span");
  note.textContent = "Paid/free tier is from the report. Test calls use one message; paid models incur provider charges.";
  heading.append(title, note);
  elements.decisionModelList.append(heading);

  for (const candidate of state.candidates) {
    const row = document.createElement("div");
    row.className = "candidate-row";
    const identity = document.createElement("div");
    identity.className = "candidate-identity";
    const name = document.createElement("strong");
    name.textContent = candidate.name;
    const metadata = document.createElement("span");
    const pricing = candidate.catalogModel?.pricing;
    const liveDetails = candidate.catalogModel
      ? ` · ${formatContext(candidate.catalogModel.context_length)} · Input ${formatUsdPerMillion(pricing?.prompt)} · Output ${formatUsdPerMillion(pricing?.completion)}`
      : "";
    metadata.textContent = `Report tier: ${candidate.tier} · ${candidate.task} · ${candidate.id}${liveDetails}`;
    identity.append(name, metadata);

    const status = document.createElement("span");
    status.className = `candidate-status ${candidate.available ? "available" : "unavailable"}`;
    status.textContent = candidate.testResult || (
      candidate.available
        ? "Available"
        : !state.apiKeyConfigured
          ? "API key required"
          : candidate.checkFailed
            ? "Check failed"
            : candidate.checked
              ? "Not in catalog"
              : "Not checked"
    );
    row.append(identity, status);

    if (candidate.available && state.apiKeyConfigured) {
      const testButton = document.createElement("button");
      testButton.className = "button button-subtle candidate-test";
      testButton.type = "button";
      testButton.textContent = candidate.testing ? "Testing…" : "Test response";
      testButton.disabled = Boolean(candidate.testing);
      testButton.addEventListener("click", () => testDecisionModel(candidate.id));
      row.append(testButton);
    }
    elements.decisionModelList.append(row);
  }
}

async function testDecisionModel(modelId) {
  const candidate = state.candidates.find((item) => item.id === modelId);
  if (!candidate || candidate.testing) return;
  candidate.testing = true;
  candidate.testResult = "";
  renderDecisionModels();
  elements.modelError.hidden = true;
  try {
    const result = await fetchJson("/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId }),
    });
    candidate.testResult = result.passed
      ? `Passed · ${result.latencyMs} ms · ${formatCost(result.usage.estimatedCost)}`
      : `Responded ${result.category}; expected ${result.expectedCategory}`;
  } catch (error) {
    candidate.testResult = `Failed · ${error.message}`;
  } finally {
    candidate.testing = false;
    renderDecisionModels();
  }
}

async function loadSetup() {
  elements.modelError.hidden = true;
  elements.refreshModels.disabled = true;
  elements.modelSelect.disabled = true;
  try {
    const config = await fetchJson("/api/config");
    state.apiKeyConfigured = config.apiKeyConfigured;
    state.categories = config.categories;
    state.candidates = config.decisionModels.map((candidate) => ({ ...candidate, checked: false }));
    renderFolders();
    if (!state.apiKeyConfigured) {
      state.models = [];
      state.recommendedModelId = "";
      renderModelOptions();
      renderDecisionModels();
      setConnection(false, "API key needed", "Add a key in your local .env file");
      elements.apiNotice.textContent = "To fetch decision models and classify messages, create a local .env file from .env.example, add your OpenRouter API key, then restart the app. The key stays on the server.";
      elements.apiNotice.hidden = false;
      elements.modelError.hidden = true;
      return;
    }

    const catalog = await fetchJson("/api/models");
    state.models = catalog.models;
    state.candidates = catalog.candidates.map((candidate) => ({ ...candidate, checked: true }));
    state.recommendedModelId = catalog.recommendedModelId;
    renderFolders();
    renderModelOptions();
    renderDecisionModels();
    setConnection(true, "API key verified", "OpenRouter catalog access works");
    elements.apiNotice.hidden = true;
    elements.modelError.hidden = true;
  } catch (error) {
    elements.modelError.textContent = error.message;
    elements.modelError.hidden = false;
    state.candidates = state.candidates.map((candidate) => ({ ...candidate, checkFailed: true }));
    renderDecisionModels();
    const rejectedKey = /unauthorized|invalid api key|authentication|forbidden|http 401|http 403/i.test(error.message);
    setConnection(false, rejectedKey ? "API key rejected" : "Catalog unavailable", rejectedKey ? "Check your local .env key" : "Check your connection and refresh");
  } finally {
    elements.refreshModels.disabled = false;
    elements.modelSelect.disabled = !state.apiKeyConfigured || state.models.length === 0;
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
    const timestamp = document.createElement("span");
    timestamp.className = "message-meta";
    timestamp.textContent = record.createdAt;
    footer.append(label, model, timestamp);
    if (Number.isFinite(record.cost)) {
      const cost = document.createElement("span");
      cost.className = "message-cost";
      cost.textContent = formatCost(record.cost);
      footer.append(cost);
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
  if (!state.apiKeyConfigured) {
    elements.classifyError.textContent = "Set OPENROUTER_API_KEY in .env and restart the server before classifying.";
    elements.classifyError.hidden = false;
    return;
  }
  const model = elements.modelSelect.value;
  if (!model) {
    elements.classifyError.textContent = "Choose a model before classifying.";
    elements.classifyError.hidden = false;
    return;
  }

  elements.classifyButton.disabled = true;
  elements.modelSelect.disabled = true;
  elements.progressWrap.hidden = false;
  elements.progressFill.style.width = "0%";
  let completed = 0;
  try {
    for (const message of messages) {
      elements.progressCaption.textContent = `Classifying ${completed + 1} of ${messages.length} with ${model}…`;
      const result = await fetchJson("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model }),
      });
      state.messages.unshift({
        text: message,
        category: result.category,
        model: result.model,
        cost: result.usage?.estimatedCost,
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
    elements.modelSelect.disabled = false;
  }
}

function downloadJsonl() {
  const content = state.messages.map((record) => JSON.stringify({
    text: record.text,
    category: record.category,
    model: record.model,
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
elements.refreshModels.addEventListener("click", loadSetup);
elements.modelSearch.addEventListener("input", renderModelOptions);
elements.modelSelect.addEventListener("change", renderModelDetails);
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
