const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPdf, toPdfText } = require("../src/pdf");
const { CATEGORY_DEFINITIONS } = require("../src/cloudflare");

test("builds a grouped PDF and safely represents characters outside Helvetica", async () => {
  const pdf = await buildPdf(
    [{ text: "Question & answer नमस्ते", label: "Service question", model: "provider/model", createdAt: "today" }],
    CATEGORY_DEFINITIONS.map(([category]) => category),
  );
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.ok(pdf.includes(Buffer.from("/Type /Page")));
  assert.equal(toPdfText("नमस्ते"), "\\u{928}\\u{92e}\\u{938}\\u{94d}\\u{924}\\u{947}");
});
