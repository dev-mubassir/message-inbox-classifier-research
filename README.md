# Message Inbox Classifier Research

A local Streamlit prototype for organizing incoming messages into business and
community categories. It uses the
[BAAI/bge-reranker-v2-m3](https://huggingface.co/BAAI/bge-reranker-v2-m3)
cross-encoder to compare each message with short descriptions of the available
categories.

This repository is intended for experimentation and evaluation, not as a
production moderation, security, or business decision system. Predictions may
be wrong; review important or ambiguous messages yourself.

## Features

- Paste multiple messages, one message per line, and classify without a fixed
  application-level message-count limit.
- Browse results in category folders in the Streamlit inbox.
- Download all messages in the current app session as a category-organized PDF
  or compact JSONL.
- Use CUDA when PyTorch detects a compatible GPU; otherwise, run on CPU.
- On CPU, configure PyTorch to use the logical processors reported by the
  operating system and classify bounded chunks of messages to batch model work.

Messages and classifications are held in Streamlit session state. They are not
saved to a database by this app and are lost when that session ends. Keep
downloaded exports private: they may contain personal messages.

## Categories

The classifier compares each message with the descriptions in `model.py` and
selects the category with the highest reranker score:

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

These scores are ranking scores, **not calibrated probabilities**. A high score
does not guarantee a correct prediction.

## Requirements

- Python 3.10 or newer
- pip
- Internet access the first time the model is loaded, so the Hugging Face model
  files can be downloaded
- Sufficient memory for PyTorch and the model; CPU inference can be slow

## Install and run

### Windows PowerShell

From the repository directory:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m streamlit run model.py
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m streamlit run model.py
```

Streamlit prints a local URL after launch. Open that URL in a browser, paste one
message per line, and select **Classify messages**. The first classification
may take longer while the model downloads and initializes.

### CPU and GPU notes

The app chooses CUDA when `torch.cuda.is_available()` is true, otherwise CPU.
On CPU, the app sets PyTorch's intra-op thread count to the logical processor
count reported by Python's `os.cpu_count()`. Each classification chunk contains
up to 32 messages, and the cross-encoder prediction batch size is 32.

These settings are starting points, not a guarantee of full CPU utilization or
maximum throughput. Performance depends on the CPU, memory bandwidth,
operating-system scheduling, PyTorch build, message lengths, and competing
workloads. To experiment with settings, change `MODEL_BATCH_SIZE` and
`CLASSIFICATION_CHUNK_SIZE` near the top of `model.py`, then benchmark on the
same machine using the protocol in
[`docs/research-protocol.md`](docs/research-protocol.md). Larger batches can
increase memory use; tune cautiously.

## Input and exports

Enter one non-empty message per line. Multi-line messages are not represented
as a single input item by the current text-area interface.

After at least one classification, the export controls offer:

- `classified_messages.pdf`: readable report grouped by category.
- `classified_messages.jsonl`: one JSON object per line, with `text` and
  `label` fields, for example:

  ```json
  {"text":"How much do you charge?","label":"Pricing inquiry"}
  ```

Both exports cover all messages in the current Streamlit session, not only the
selected folder. Exported files are intentionally excluded from Git because
they may contain private message text.

## Research and evaluation

See [`docs/research-protocol.md`](docs/research-protocol.md) for a proposed
evaluation protocol, dataset guidance, metrics, and CPU benchmarking procedure.
No accuracy or throughput results are claimed by this repository. Report
measured results with the exact model revision, environment, data split, and
hardware configuration.

## Project structure

```text
.
├── docs/
│   └── research-protocol.md
├── model.py
├── requirements.txt
└── README.md
```

## Privacy and responsible use

- Do not commit real direct messages, personal data, credentials, or exported
  inbox files.
- Use consented, anonymized data for research. Remove names, handles, phone
  numbers, email addresses, links, and other identifying details where they
  are not essential.
- Do not rely on these predictions alone for decisions that affect a person.
- The spam/scam label is a text-classification category, not a security
  guarantee or a link scanner.
- Model weights are downloaded from Hugging Face at runtime; consult the model
  card and its license before redistributing or using the weights.

## License

No code license is included. Unless the repository owner adds a license, all
rights remain with the respective copyright holders; public visibility alone
does not grant permission to reuse the code.
