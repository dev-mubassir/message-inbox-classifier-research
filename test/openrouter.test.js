const test = require("node:test");
const assert = require("node:assert/strict");
const { createOpenRouterClient, getPrices, parseCategory, recommendModel } = require("../src/openrouter");

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
            id: "provider/model",
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

  const result = await client.classify({ message: "How much?", model: "provider/model" });
  assert.equal(result.category, "Pricing inquiry");
  assert.equal(result.model, "provider/model");
  assert.ok(Math.abs(result.usage.estimatedCost - 0.000024) < 1e-12);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-secret");
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-secret");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
  assert.equal(JSON.parse(calls[1].options.body).model, "provider/model");
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
});
