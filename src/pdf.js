const PDFDocument = require("pdfkit");

function toPdfText(value) {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);
    return (codePoint >= 32 && codePoint <= 255) || codePoint === 10
      ? character
      : `\\u{${codePoint.toString(16)}}`;
  }).join("");
}

function toPdfText(value) {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 255 ? character : `\\u{${codePoint.toString(16)}}`;
  }).join("");
}

function buildPdf(records, categories) {
  const document = new PDFDocument({ margin: 54, info: { Title: "Classified Message Inbox" } });
  const chunks = [];

  document.on("data", (chunk) => chunks.push(chunk));
  return new Promise((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    for (const category of categories) {
      const categoryRecords = records.filter((record) => record.label === category);
      if (categoryRecords.length === 0) {
        continue;
      }
      if (document.y > 680) {
        document.addPage();
      }
      document.font("Helvetica-Bold").fontSize(15).text(`${category} (${categoryRecords.length})`, { paragraphGap: 8 });
      document.font("Helvetica").fontSize(10);
      for (const record of categoryRecords) {
        document.font("Helvetica").text(toPdfText(record.text), { paragraphGap: 2 });
        document.font("Helvetica-Oblique").fontSize(8)
          .text(`${record.createdAt || ""} | Model: ${record.model}`, { paragraphGap: 8 });
        document.font("Helvetica").fontSize(10);
      }
      document.moveDown(0.5);
    }
    document.end();
  });
}

module.exports = { buildPdf, toPdfText };
