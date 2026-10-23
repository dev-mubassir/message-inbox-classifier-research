require("dotenv").config();

const express = require("express");
const path = require("node:path");
const { createOpenRouterClient } = require("./src/openrouter");
const { buildPdf } = require("./src/pdf");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const app = express();
const openRouter = createOpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));

app.get("/", (_request, response) => {
  response.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/config", (_request, response) => {
  response.json({
    apiKeyConfigured: openRouter.isConfigured(),
    categories: openRouter.categories,
    decisionModels: openRouter.decisionModelCandidates,
  });
});

app.get("/api/models", async (_request, response, next) => {
  try {
    const candidates = await openRouter.listDecisionModels();
    const models = candidates.filter((candidate) => candidate.available).map((candidate) => candidate.catalogModel);
    response.json({
      models,
      candidates,
      recommendedModelId: openRouter.recommendModel(models),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/models/test", async (request, response, next) => {
  try {
    const { model } = request.body || {};
    if (typeof model !== "string" || !model.trim() || model.length > 200) {
      return response.status(400).json({ error: "Select a valid decision model to test." });
    }
    const result = await openRouter.testModel({ model: model.trim() });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/classify", async (request, response, next) => {
  try {
    const { message, model } = request.body || {};
    if (typeof message !== "string" || !message.trim()) {
      return response.status(400).json({ error: "Enter a non-empty message." });
    }
    if (message.length > 20_000) {
      return response.status(400).json({ error: "Each message must be 20,000 characters or fewer." });
    }
    if (typeof model !== "string" || !model.trim() || model.length > 200) {
      return response.status(400).json({ error: "Select a valid model from the OpenRouter catalog." });
    }

    const result = await openRouter.classify({ message: message.trim(), model: model.trim() });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/export/pdf", async (request, response, next) => {
  try {
    const { messages } = request.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return response.status(400).json({ error: "There are no classified messages to export." });
    }
    if (messages.length > 20_000) {
      return response.status(400).json({ error: "PDF export is limited to 20,000 messages at a time." });
    }

    const records = messages.map((record) => {
      if (
        !record ||
        typeof record.text !== "string" ||
        typeof record.category !== "string" ||
        typeof record.model !== "string" ||
        !openRouter.categories.includes(record.category)
      ) {
        throw new HttpError(400, "The export contains an invalid message record.");
      }
      return {
        text: record.text,
        label: record.category,
        model: record.model,
        createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
      };
    });

    const pdf = await buildPdf(records, openRouter.categories);
    response
      .type("application/pdf")
      .set("Content-Disposition", 'attachment; filename="classified_messages.pdf"')
      .send(pdf);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (response.headersSent) {
    return;
  }
  const status = Number.isInteger(error.status) ? error.status : 502;
  if (status >= 500) {
    console.error("Request failed:", error.message);
  }
  response.status(status).json({ error: status >= 500 ? error.publicMessage || "The request failed. Check the server log and try again." : error.message });
});

function HttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

if (require.main === module) {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Message Inbox Classifier is running at http://127.0.0.1:${PORT}`);
    if (!openRouter.isConfigured()) {
      console.warn("OPENROUTER_API_KEY is not set. Add it to .env to enable classification.");
    }
  });
}

module.exports = { app, HttpError };
