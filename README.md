# Message Inbox Classifier Research

A lightweight, live-updating HTML/CSS/JavaScript inbox for experimenting with
message classification using models from the live
[OpenRouter model catalog](https://openrouter.ai/models). A small Node.js server
keeps your OpenRouter API key out of the browser, calls the selected model, and
generates PDF exports.

> **Research prototype:** model output is a suggestion, not verified truth or a
> calibrated probability. Review important classifications yourself. OpenRouter
> model usage may incur charges; check the selected model's current pricing.

## Features

- Fetch the live OpenRouter model catalog using your server-side API key, list
  every paid/free decision model from the comparison report, and mark whether
  each exact model ID is currently available.
- Manually test an available model with one short, known-answer request. The UI
  reports whether the response matches, latency, and estimated cost.
- Search available decision models by provider or name and inspect context
  size and published input/output prices before selecting one.
- Get a **recommended value pick** based on the catalog's listed token prices
  and context size. This price/context heuristic does not claim the model is
  the most accurate.
- Use a pure-black dark interface throughout the sidebar, model picker,
  message composer, and results.
- Classify messages one per line, with progress and results updated as each
  model response arrives.
- Browse classifications by category.
- Export the current browser session as organized PDF or compact JSONL.
- Keep the API key in a server-side `.env` file. The key is never sent to the
  browser or included in API responses.

Classified messages live in browser memory for that tab. Reloading or closing
the tab clears them. The app does not store a message database or send data
anywhere except OpenRouter when you explicitly classify it.

## Requirements

- Node.js 20.12 or later and npm
- An OpenRouter account and API key to classify messages
- Internet access for OpenRouter's live model catalog and classification API

## Quick start

1. Clone or download this repository, then open a terminal in its folder.
2. Install the dependencies:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env` and add your OpenRouter API key:

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   **macOS / Linux**

   ```sh
   cp .env.example .env
   ```

   Edit `.env`:

   ```dotenv
   OPENROUTER_API_KEY=your_actual_key_here
   PORT=3000
   ```

   Never commit `.env` or share its contents. `.gitignore` excludes it.
4. Start the app:

   ```sh
   npm start
   ```

5. Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The report's paid/free candidates are shown without a key, but checking which
models are currently available and classifying messages require a valid key.
After a successful catalog request, the sidebar confirms **API key verified**.
If the app reports that the key is missing or rejected, save a valid key in
`.env` and restart the server.

## Using the model selector

The app requests the current OpenRouter catalog with the configured API key,
then matches it to exact model IDs in the decision-model comparison report.
General-purpose models are not shown. The full paid/free report list stays
visible, including entries marked **Not in catalog**, so an empty current list
cannot look like a loading failure. Only available exact model IDs can be
selected for classification. **Refresh catalog** fetches the latest catalog.

The exact allowlist covers Clef Flash, Clef, Tev1 4B Experimental, Mercury
Decide (paid and free), Solar Decide, Span-01, Span-01 Lite, Kev 4B, and Jev
1.13. The duplicate free Span-01 Lite listing in the comparison report is
deduplicated. Only IDs present in both the report list and authenticated live
catalog are selectable.

When an exact model is available, its current catalog context and token prices
are displayed. Click **Test response** to send one short sample message and
check whether the model returns the expected `Pricing inquiry` category. Test
requests do not run automatically. Paid endpoints incur charges according to
the provider's current pricing.

The suggested value model is selected by comparing listed input and output
costs among models with at least a 16,000-token context window. Prices and
availability can change; the selector displays the data currently returned by
OpenRouter. This heuristic does not evaluate answer quality, latency, privacy
policies, or provider-specific behavior. Choose a model that fits your budget
and requirements. Every classified message is sent to OpenRouter using the
selected model, and provider charges may apply.

Changing the model applies to the next batch. A batch uses the selected model
from its start; the selector is disabled during classification.

## Input, results, and exports

Paste one message per line. Each non-empty line is sent as its own
classification request. Results appear progressively. If a request fails, the
error is shown and already completed results remain in the browser.

The classifier chooses exactly one category:

- Service question
- Pricing inquiry
- Potential buyer
- Brand deal
- Collaboration
- Customer
- Fan message
- General question
- Support
- Spam and scams

Downloads include all results in the current tab, regardless of the selected
category folder:

- **PDF** — grouped by category, with the selected model and classification
  time.
- **JSONL** — one compact JSON record per line with `text`, `category`, `model`,
  and `createdAt` fields.

## Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | Server-side OpenRouter API key | unset |
| `PORT` | Local web server port | `3000` |

The server binds to `127.0.0.1` so it is not exposed to the local network by
default. Do not change the bind address or deploy this research prototype on a
public server without adding authentication, request limits, abuse protection,
and a deployment-grade secrets manager.

## Development and tests

```sh
npm run dev
npm test
```

The test suite uses Node's built-in test runner. Tests do not call OpenRouter or
need an API key.

## Research protocol

See [`docs/research-protocol.md`](docs/research-protocol.md) for suggested
privacy-aware evaluation, quality metrics, and model comparison procedures.
This repository does not claim measured accuracy, latency, or cost results.

## Privacy and responsible use

- Do not commit API keys, real direct messages, personally identifying
  information, or private research data.
- Messages are sent to OpenRouter when classified. Review OpenRouter's current
  policies and the selected provider's terms before using sensitive content.
- Use consented, anonymized data for research. Remove names, handles, phone
  numbers, email addresses, and identifying links wherever practical.
- Do not rely on predictions alone for decisions that affect a person.
- The spam/scam category is a text label, not a link scanner or security
  guarantee.
- Model IDs, availability, prices, context limits, and provider policies can
  change. Verify them in OpenRouter before use.

## Project structure

```text
.
├── docs/
│   └── research-protocol.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── openrouter.js
│   └── pdf.js
├── test/
│   └── openrouter.test.js
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## License

No code license is included. Public visibility does not grant permission to
reuse the code. OpenRouter and model providers have their own terms, pricing,
and model licenses.
