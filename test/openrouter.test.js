const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DECISION_MODEL_CANDIDATES,
  DECISION_MODEL_IDS,
  createOpenRouterClient,
  getPrices,
  parseCategory,
  recommendModel,
} = require("../src/openrouter");

test("parses a category case-insensitively and strips surrounding quotes", () => {
  assert.equal(parseCategory('"pricing inquiry"', ["Pricing inquiry", "Support"]), "Pricing inquiry");
});

test("rejects output that is not one of the expected labels", () => {
  assert.throws(() => parseCategory("It is probably spam", ["Spam and scams"]), /valid category/);
});

test("recommends the lowest-cost model with at least 16k context", () => {
  const models = [
    { id: "short-free", context_length: 8000, pricing: { prompt: "0", completion: "0" } },
    { id: "large-costly", context_length: 32000, pricing: { prompt: "0.00001", completion: "0.00002" } },
    { id: "large-value", context_length: 16000, pricing: { prompt: "0.000001", completion: "0.000003" } },
  ];
  assert.equal(recommendModel(models), "large-value");
});

test("parses OpenRouter token prices", () => {
  assert.deepEqual(getPrices({ pricing: { prompt: "0.000001", completion: "0.000002" } }), {
    prompt: 0.000001,
    completion: 0.000002,
  });
  assert.equal(getPrices({ pricing: { prompt: "unknown", completion: "0.000002" } }), null);
});

test("uses the selected live-catalog model and keeps the API key server-side", async () => {
  const calls = [];
  const client = createOpenRouterClient({
    apiKey: "test-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({
          data: [{
            id: "inception/mercury-decide:free",
            context_length: 32000,
            pricing: { prompt: "0.000001", completion: "0.000002" },
            architecture: { input_modalities: ["text"] },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Pricing inquiry" } }],
        usage: { prompt_tokens: 20, completion_tokens: 2 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const result = await client.classify({ message: "How much?", model: "inception/mercury-decide:free" });
  assert.equal(result.category, "Pricing inquiry");
  assert.equal(result.model, "inception/mercury-decide:free");
  assert.ok(Math.abs(result.usage.estimatedCost - 0.000024) < 1e-12);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-secret");
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-secret");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
  assert.equal(JSON.parse(calls[1].options.body).model, "inception/mercury-decide:free");
});

test("fetches only report-listed decision models from the authenticated catalog", async () => {
  let requestedAuthorization;
  const client = createOpenRouterClient({
    apiKey: "test-secret",
    fetchImpl: async (_url, options) => {
      requestedAuthorization = options.headers.Authorization;
      return new Response(JSON.stringify({
        data: [
          { id: "inception/mercury-decide:free", architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
          { id: "general-purpose/model", architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
          { id: "cloudflare/clef", architecture: { input_modalities: ["image"], output_modalities: ["text"] } },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const models = await client.listModels();
  assert.deepEqual(models.map((model) => model.id), ["inception/mercury-decide:free"]);
  assert.equal(requestedAuthorization, "Bearer test-secret");
  assert.ok(DECISION_MODEL_IDS.has("cloudflare/clef-flash"));
  const candidates = await client.listDecisionModels();
  assert.equal(candidates.length, DECISION_MODEL_CANDIDATES.length);
  assert.equal(candidates.filter((candidate) => candidate.available).length, 1);
  assert.equal(candidates.find((candidate) => candidate.tier === "Free").available, true);
  assert.equal(candidates.find((candidate) => candidate.id === "inception/mercury-decide").available, false);
});

test("manual model test checks the expected category and reports latency", async () => {
  const client = createOpenRouterClient({
    apiKey: "test-secret",
    fetchImpl: async (url) => {
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({
          data: [{
            id: "inception/mercury-decide:free",
            context_length: 32000,
            pricing: { prompt: "0", completion: "0" },
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Pricing inquiry" } }],
        usage: { prompt_tokens: 20, completion_tokens: 2, cost: 0 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  const result = await client.testModel({ model: "inception/mercury-decide:free" });
  assert.equal(result.passed, true);
  assert.equal(result.expectedCategory, "Pricing inquiry");
  assert.equal(result.category, result.expectedCategory);
  assert.equal(result.usage.estimatedCost, 0);
  assert.ok(result.latencyMs >= 0);
});

test("marks an unexpected test classification as failed", async () => {
  const client = createOpenRouterClient({
    apiKey: "test-secret",
    fetchImpl: async (url) => {
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({
          data: [{
            id: "inception/mercury-decide:free",
            context_length: 32000,
            pricing: { prompt: "0", completion: "0" },
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "General question" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  const result = await client.testModel({ model: "inception/mercury-decide:free" });
  assert.equal(result.passed, false);
  assert.equal(result.category, "General question");
  assert.equal(result.expectedCategory, "Pricing inquiry");
});

test("requires a server-side API key before making a classification request", async () => {
  let fetchCalled = false;
  const client = createOpenRouterClient({
    apiKey: "",
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("The network should not be called without a key.");
    },
  });
  await assert.rejects(
    client.classify({ message: "A message", model: "provider/model" }),
    (error) => error.status === 503 && /OPENROUTER_API_KEY/.test(error.message),
  );
  assert.equal(fetchCalled, false);
  await assert.rejects(
    client.listModels(),
    (error) => error.status === 503 && /OPENROUTER_API_KEY/.test(error.message),
  );
  assert.equal(fetchCalled, false);
  await assert.rejects(
    client.testModel({ model: "inception/mercury-decide:free" }),
    (error) => error.status === 503 && /OPENROUTER_API_KEY/.test(error.message),
  );
});
