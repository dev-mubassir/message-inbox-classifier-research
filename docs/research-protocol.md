# Research and Evaluation Protocol

This document describes a reproducible way to evaluate the message inbox
classifier. It is a proposed protocol, not a report of completed experiments.
Do not describe unmeasured performance as a research result.

## Research questions

1. How well does the fixed category-description setup classify messages from
   the intended use case?
2. Which categories are most frequently confused?
3. How do CPU thread count and inference batch size affect throughput and
   memory use on documented hardware?
4. Do performance results change across languages, message lengths, or
   informal spelling styles?

## Dataset and privacy

Create a labeled evaluation set with permission to use every message. Prefer
consented and anonymized data. Do not collect private messages without
authorization, or publish raw messages or identifiers.

For each example, keep only what the study needs, such as:

```text
message_id, text, gold_label, language, source_split
```

Use stable random IDs instead of account identifiers. Keep the raw dataset
private unless all contributors explicitly consent to publication. Publish
label definitions, dataset size, collection method, anonymization steps, and
known limitations even when the actual text cannot be shared.

Have at least two people independently label a subset using written category
definitions. Resolve disagreements with a documented adjudication process and
report inter-annotator agreement (for example, Cohen's kappa for two annotators).
Do not put near-duplicate messages or messages from the same conversation in
both training/development data and the final test set.

## Classification quality

Freeze the category descriptions and model revision before evaluating. On a
held-out test set, report:

- Number of examples overall and per category.
- Accuracy and macro-averaged precision, recall, and F1.
- Per-category precision, recall, and F1.
- Confusion matrix with the category order stated.
- Results by language and message-length group when each group has enough
  examples to be meaningful.
- Confidence intervals or repeated-split variation where feasible.

The score returned by the reranker is not a probability. Do not interpret it
as calibrated confidence unless calibration has been separately measured on
held-out data.

## CPU performance benchmark

Record the exact CPU model, logical and physical core counts if known, RAM,
operating system, Python version, PyTorch version/build, Sentence Transformers
version, model revision, and whether the machine was otherwise busy.

For each configuration:

1. Use the same fixed, non-sensitive input set and category descriptions.
2. Run a warm-up before timing.
3. Measure at least three repetitions and report median messages per second
   along with the range or standard deviation.
4. Measure end-to-end inference time separately from model download and load
   time.
5. Record peak process memory and CPU utilization using a consistent
   measurement tool.
6. Change one setting at a time, such as `MODEL_BATCH_SIZE`,
   `CLASSIFICATION_CHUNK_SIZE`, or PyTorch thread count.
7. Verify predictions remain identical for the same model and inputs when
   changing only batch/thread settings.

Do not assume that a larger batch or all logical threads will always be faster:
measure for the target machine and workload. Include failed or memory-limited
configurations in the notes rather than hiding them.

## Suggested results table

| Run | Model revision | CPU / RAM | Threads | Model batch | Chunk size | Messages | Median msg/s | Peak RAM | Notes |
|-----|----------------|-----------|---------|-------------|------------|----------|--------------|----------|-------|
|     |                |           |         |             |            |          |              |          |       |

## Reproducibility checklist

- [ ] Record the Git commit and dependency versions.
- [ ] Record the exact model revision, not just its display name.
- [ ] Document label definitions and annotation instructions.
- [ ] Keep train, development, and test partitions separate.
- [ ] Document preprocessing, exclusions, and missing data.
- [ ] State whether the CPU or GPU path was used.
- [ ] Report all relevant hardware, thread, and batch settings.
- [ ] Keep private data and identifiable messages out of public artifacts.
- [ ] Separate observed results from hypotheses and recommendations.
