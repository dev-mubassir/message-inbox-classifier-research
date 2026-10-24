const test = require("node:test");
const assert = require("node:assert/strict");
const { MODEL_ID, createCloudflareClient, parseCategory } = require("../src/cloudflare");

test("parses a category case-insensitively and strips surrounding quotes", () => {
  assert.equal(parseCategory('"pricing inquiry"', ["Pricing inquiry", "Support"]), "Pricing inquiry");
});

test("rejects a missing or invalid model category", () => {
  assert.throws(() => parseCategory(undefined, ["Support"]), /no category/);
  assert.throws(() => parseCategory("Probably spam", ["Spam and scams"]), /invalid category/);
});

test("classifies with direct Workers AI Clef Flash and keeps credentials server-side", async () => {
  let requestedUrl;
  let requestedOptions;
  const client = createCloudflareClient({
    accountId: "account-id",
    apiToken: "test-secret",
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return new Response(JSON.stringify({
        success: true,
        result: {
          model: "clef-flash",
          answers: {
            category: {
              type: "choice",
              choice: "Pricing inquiry",
              confidence: 0.98,
              probabilities: { "Pricing inquiry": 0.98 },
            },
          },
          usage: { input_tokens: 30, output_tokens: 2 },
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const result = await client.classify({ message: "How much?" });
  assert.equal(requestedUrl, `https://api.cloudflare.com/client/v4/accounts/account-id/ai/run/${MODEL_ID}`);
  assert.equal(requestedOptions.headers.Authorization, "Bearer test-secret");
  assert.equal(JSON.parse(requestedOptions.body).model, "clef-flash");
  assert.equal(JSON.parse(requestedOptions.body).state.message, "How much?");
  assert.equal(JSON.parse(requestedOptions.body).questions.category.type, "choice");
  assert.equal(result.category, "Pricing inquiry");
  assert.equal(result.model, MODEL_ID);
  assert.equal(result.confidence, 0.98);
  assert.deepEqual(result.usage, { promptTokens: 30, completionTokens: 2, estimatedCost: null });
  assert.ok(result.latencyMs >= 0);
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("reports Cloudflare API errors without hiding provider messages", async () => {
  const client = createCloudflareClient({
    accountId: "account-id",
    apiToken: "test-secret",
    fetchImpl: async () => new Response(JSON.stringify({
      success: false,
      errors: [{ message: "Invalid account token" }],
    }), { status: 403, headers: { "Content-Type": "application/json" } }),
  });
  await assert.rejects(
    client.classify({ message: "A message" }),
    (error) => error.status === 400 && /Invalid account token/.test(error.message),
  );
});

test("requires both Cloudflare credentials before making a request", async () => {
  let fetchCalled = false;
  const client = createCloudflareClient({
    accountId: "account-id",
    apiToken: "",
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("The network should not be called without credentials.");
    },
  });
  assert.equal(client.isConfigured(), false);
  await assert.rejects(
    client.classify({ message: "A message" }),
    (error) => error.status === 503 && /CLOUDFLARE_ACCOUNT_ID/.test(error.message),
  );
  assert.equal(fetchCalled, false);
});

test("manual model test checks the expected category and reports latency", async () => {
  const client = createCloudflareClient({
    accountId: "account-id",
    apiToken: "test-secret",
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      result: {
        answers: { category: { choice: "Pricing inquiry", confidence: 0.99 } },
        usage: { input_tokens: 25, output_tokens: 2 },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  const result = await client.testModel();
  assert.equal(result.passed, true);
  assert.equal(result.expectedCategory, "Pricing inquiry");
  assert.equal(result.model, MODEL_ID);
  assert.ok(result.latencyMs >= 0);
});
