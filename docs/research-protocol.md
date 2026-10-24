# Research and Model Comparison Protocol

This is a suggested protocol for evaluating classification quality and model
trade-offs. It contains no completed experiments or performance claims.

## Research questions

1. How well does Cloudflare Clef Flash map messages to the fixed category set?
2. Which categories are most often confused?
3. How do latency and Workers AI usage vary by message length?
4. Do results differ across languages, informal spelling, and domains?

## Data and privacy

Use only data you have permission to evaluate. Prefer consented and anonymized
messages. Keep raw messages private unless all relevant people explicitly
consent to publication. Document data provenance, collection period,
anonymization, exclusions, and known limitations.

Use stable random IDs rather than account identifiers. Remove names, handles,
phone numbers, email addresses, and other identifying content wherever
possible. Never commit `.env`, provider credentials, raw inbox exports, or
private datasets.

Have at least two annotators independently label a subset using written
definitions for the ten categories. Record the agreement measure and resolve
disagreements using a documented process. Keep messages from the same
conversation and near-duplicates in the same data partition to avoid leakage.

## Model comparison

For each model, record:

- Exact Cloudflare model ID and test date.
- Category definitions and prompt version.
- Dataset version, sample size, and per-category counts.
- Input language and length distribution.
- Cloudflare-reported input/output tokens and applicable Workers AI pricing.
- Median and range of end-to-end response latency.
- Provider errors, invalid category responses, and retries.
- Any model settings changed from the app defaults.

Use the same held-out examples and prompt across models. Randomize or
interleave model run order where possible to reduce time-of-day or service-load
bias. Do not send sensitive data without the necessary consent and policy
review. Model outputs may be retained or processed according to Cloudflare's
applicable terms.

## Quality metrics

Report overall accuracy, macro-averaged precision/recall/F1, per-category
precision/recall/F1, and a confusion matrix with a declared label order. Report
uncertainty or repeated-split variation where practical. Include the number of
examples per category and do not hide unsupported languages or failed
responses.

The app uses a single category response, not a calibrated probability. Do not
present the model's answer as certainty. If measuring calibration or
abstention, design and evaluate that behavior separately.

## Suggested results table

| Model ID | Test date | Examples | Accuracy | Macro F1 | Median latency | Workers AI usage | Errors |
|----------|-----------|----------|----------|----------|----------------|-----------------------|--------|
|          |           |          |          |          |                |                       |        |

## Reproducibility checklist

- [ ] Record the Git commit, Node version, and dependency lockfile.
- [ ] Record exact model IDs, date, prompt, and model settings.
- [ ] Document annotation instructions and annotator agreement.
- [ ] Keep conversation groups and duplicates within one data split.
- [ ] Document consent, anonymization, and dataset exclusions.
- [ ] Record Workers AI usage and latency observations.
- [ ] Report errors, unsupported categories, and all material limitations.
- [ ] Keep API keys, private messages, and raw personal data out of public
  artifacts.
