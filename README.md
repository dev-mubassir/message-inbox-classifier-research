# Message Inbox Classifier Research

A lightweight, live-updating HTML/CSS/JavaScript inbox for message
classification using Cloudflare Workers AI's
[Clef Flash decision model](https://developers.cloudflare.com/workers-ai/models/clef-flash/).
A small Node.js server keeps your Cloudflare credentials out of the browser,
calls the model directly through the Workers AI REST API, and generates PDF
exports.

> **Research prototype:** model output is a suggestion, not verified truth or a
> calibrated probability. Review important classifications yourself. Workers AI
> has a daily free allocation and may incur charges above that allocation.

## Features

- Classify directly with Cloudflare Workers AI model `@cf/cloudflare/clef-flash`.
- Return the category, model confidence, token usage, and request
  latency for each message.
- Keep the Cloudflare account ID and API token on the server, never in the
  browser.
- Use a pure-black dark interface throughout the sidebar, model panel,
  message composer, and results.
- Classify messages one per line, with progress and results updated as each
  model response arrives.
- Browse classifications by category.
- Export the current browser session as organized PDF or compact JSONL.
- Keep the API key in a server-side `.env` file. The key is never sent to the
  browser or included in API responses.

Classified messages live in browser memory for that tab. Reloading or closing
the tab clears them. The app does not store a message database or send data
anywhere except Cloudflare when you explicitly classify it.

## Requirements

- Node.js 20.12 or later and npm
- A Cloudflare account with Workers AI enabled
- A Workers AI API token and Cloudflare account ID
- Internet access for the Cloudflare Workers AI API

## Quick start

1. Clone or download this repository, then open a terminal in its folder.
2. Install the dependencies:

   ```sh
   npm install
   ```

3. Create a Workers AI token and get your account ID:

   - Open the [Workers AI dashboard](https://dash.cloudflare.com/?to=/:account/ai/workers-ai).
   - Select **Use REST API**, then **Create a Workers AI API Token** and copy
     the token and the displayed **Account ID**.
   - If you create a token manually, grant **Workers AI - Read** and
     **Workers AI - Edit**.

4. Copy `.env.example` to `.env` and add those Cloudflare credentials:

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
   CLOUDFLARE_ACCOUNT_ID=your_actual_account_id_here
   CLOUDFLARE_API_TOKEN=your_actual_workers_ai_token_here
   PORT=3000
   ```

   Never commit `.env` or share its contents. `.gitignore` excludes it.
5. Start the app:

   ```sh
   npm start
   ```

6. Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The **Test response** button sends a known pricing question and reports the
model's returned category, confidence, and latency. The tester calls the
Cloudflare account REST endpoint for 
`@cf/cloudflare/clef-flash`, passing the message as decision state and the
inbox categories as the model's choice schema. No model catalog or third-party
model router is used. The UI shows the returned label and the
model's confidence. Cloudflare's Workers AI REST API requires a token with
Workers AI permissions and your account ID.

`cloudflared` is the Cloudflare Tunnel command-line client. It is not needed
for this local app to call Workers AI. Use a tunnel only if you intentionally
need remote access to the local web UI; secure the app before exposing it.

If you want temporary remote browser access, start the app locally and run
`cloudflared tunnel --url http://127.0.0.1:3000` in another terminal. Keep the
generated tunnel URL private and stop the tunnel when you finish. A tunnel
exposes the web UI; it does not provide the model API credentials or run the
model.

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

- **PDF** — grouped by category, with the model and classification
  time.
- **JSONL** — one compact JSON record per line with `text`, `category`, `model`,
  `confidence`, `latencyMs`, and `createdAt` fields.

## Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for Workers AI | unset |
| `CLOUDFLARE_API_TOKEN` | Server-side Workers AI API token | unset |
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

The test suite uses Node's built-in test runner. Tests do not call Cloudflare or
need credentials.

## Research protocol

See [`docs/research-protocol.md`](docs/research-protocol.md) for suggested
privacy-aware evaluation, quality metrics, and model comparison procedures.
This repository does not claim measured accuracy, latency, or cost results.

## About the author

Created and maintained by [@dev-mubassir](https://github.com/dev-mubassir).
This independent research project explores practical message classification
with decision models, transparent evaluation, and privacy-conscious handling
of inbox data.

## Privacy and responsible use

- Do not commit API keys, real direct messages, personally identifying
  information, or private research data.
- Messages are sent to Cloudflare Workers AI when classified. Review
  Cloudflare's current data-handling policies before using sensitive content.
- Use consented, anonymized data for research. Remove names, handles, phone
  numbers, email addresses, and identifying links wherever practical.
- Do not rely on predictions alone for decisions that affect a person.
- The spam/scam category is a text label, not a link scanner or security
  guarantee.
- Model behavior, availability, pricing, context limits, and provider policies
  can change. Verify them in Cloudflare's documentation before use.

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
│   ├── cloudflare.js
│   └── pdf.js
├── test/
│   └── cloudflare.test.js
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## License

No code license is included. Public visibility does not grant permission to
reuse the code. Cloudflare and model providers have their own terms, pricing,
and model licenses.
