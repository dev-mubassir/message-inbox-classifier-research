const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { app } = require("../server");

test("serves the interface, exposes safe setup state, and validates requests", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Message inbox/);

    const configResponse = await fetch(`${baseUrl}/api/config`);
    const config = await configResponse.json();
    assert.equal(typeof config.apiKeyConfigured, "boolean");
    assert.equal(config.categories.length, 10);
    assert.deepEqual(Object.keys(config).sort(), ["apiKeyConfigured", "categories"]);

    const invalidMessage = await fetch(`${baseUrl}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "  ", model: "provider/model" }),
    });
    assert.equal(invalidMessage.status, 400);
    assert.match((await invalidMessage.json()).error, /non-empty/);

    const emptyExport = await fetch(`${baseUrl}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    assert.equal(emptyExport.status, 400);

    const pdfExport = await fetch(`${baseUrl}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          text: "A question from the test",
          category: "Service question",
          model: "provider/model",
          createdAt: "today",
        }],
      }),
    });
    assert.equal(pdfExport.status, 200);
    assert.match(pdfExport.headers.get("content-type"), /application\/pdf/);
    assert.ok((await pdfExport.arrayBuffer()).byteLength > 500);
  } finally {
    server.close();
    await once(server, "close");
  }
});
