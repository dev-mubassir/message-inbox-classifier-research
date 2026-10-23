import html
import io
import json
import os
from datetime import datetime
from xml.sax.saxutils import escape

import streamlit as st
import torch
from sentence_transformers import CrossEncoder
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


MODEL_NAME = "BAAI/bge-reranker-v2-m3"
CPU_THREAD_COUNT = os.cpu_count() or 1
MODEL_BATCH_SIZE = 32
CLASSIFICATION_CHUNK_SIZE = 32

# Each label is compared with the incoming message. The best relevance match wins.
# These are message labels only; the UI deliberately does not show names or avatars.
CATEGORIES = {
    "Service question": (
        "The sender asks whether a service is offered, what services are available, "
        "or whether the creator can do a particular kind of work. They are asking "
        "about capability or service details, not the price."
    ),
    "Pricing inquiry": (
        "The sender asks the price, rate, fee, package cost, or requests a rate card "
        "for a service, video, promotion, or collaboration. The main question is how much it costs."
    ),
    "Potential buyer": (
        "The sender shows intent to book, purchase, order, hire, or pay for a service. "
        "They appear to be a prospective customer rather than only asking what is available."
    ),
    "Brand deal": (
        "A company or brand proposes a paid sponsorship, sponsored post, brand promotion, "
        "or commercial partnership with the creator."
    ),
    "Collaboration": (
        "The sender proposes a collaboration, collab, joint content, editing exchange, "
        "or working together, without a clear formal brand sponsorship offer."
    ),
    "Customer": (
        "The sender appears to be an existing customer discussing a previous purchase, "
        "booking, order, delivered service, or ongoing paid work."
    ),
    "Fan message": (
        "The sender is a follower or fan expressing appreciation, compliments, affection, "
        "support, or casual conversation without a clear business request."
    ),
    "General question": (
        "The sender asks a general question that does not clearly fit service questions, "
        "pricing, buying intent, brand deals, collaboration, customer matters, support, or spam."
    ),
    "Support": (
        "The sender needs help resolving a problem with an existing service, booking, payment, "
        "delivery, account, or completed transaction."
    ),
    "Spam and scams": (
        "The message is unsolicited spam, phishing, fraud, a suspicious link, a request for "
        "passwords or verification codes, or another attempt to deceive the recipient."
    ),
}

# Examples include English and Hinglish messages, similar to the messages in the user's test.
EXAMPLE_MESSAGES = [
    "Hi, our company wants to sponsor your next video.",
    "How much do you charge for a promotional post?",
    "I love your content. Keep it up!",
    "Click this suspicious link and enter your account password.",
    "Ap wedding shoot bhi krte ho ky",
    "Bhai ek video edit Kari h story pr h dekh acchi ho to colleb kar le",
]

CATEGORY_COLORS = {
    "Service question": ("#eaf0ff", "#3156a6"),
    "Pricing inquiry": ("#fff2d9", "#8d5b00"),
    "Potential buyer": ("#e1f7eb", "#087443"),
    "Brand deal": ("#dff8eb", "#087a55"),
    "Collaboration": ("#e8f3ff", "#245c9c"),
    "Customer": ("#e1f7f5", "#08796d"),
    "Fan message": ("#f0eaff", "#6542a6"),
    "General question": ("#edf0f5", "#465267"),
    "Support": ("#e7f4ff", "#21648d"),
    "Spam and scams": ("#ffe8e8", "#b42318"),
}


st.set_page_config(page_title="Message Inbox Classifier", page_icon="✉️", layout="wide")


@st.cache_resource(show_spinner=False)
def load_model(device: str) -> CrossEncoder:
    """Load once and reuse the model across Streamlit reruns."""
    if device == "cpu":
        torch.set_num_threads(CPU_THREAD_COUNT)
    return CrossEncoder(MODEL_NAME, device=device)


def classify_messages(model: CrossEncoder, messages: list[str]) -> list[tuple[str, float]]:
    labels = list(CATEGORIES.keys())
    pairs = [
        (message, f"Message category: {label}. {description}")
        for message in messages
        for label, description in CATEGORIES.items()
    ]
    scores = model.predict(
        pairs,
        batch_size=MODEL_BATCH_SIZE,
        show_progress_bar=False,
    )
    classifications = []
    for message_index in range(len(messages)):
        start = message_index * len(labels)
        message_scores = scores[start : start + len(labels)]
        best_index = max(range(len(labels)), key=lambda i: float(message_scores[i]))
        classifications.append((labels[best_index], float(message_scores[best_index])))
    return classifications


@st.cache_data(show_spinner=False, max_entries=2)
def build_pdf_export(records: list[dict]) -> bytes:
    """Create a readable PDF with classified messages grouped by category."""
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title="Classified Message Inbox",
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Classified Message Inbox", styles["Title"]),
        Paragraph(f"Total messages: {len(records)}", styles["Normal"]),
        Spacer(1, 12),
    ]

    records_by_category = {category: [] for category in CATEGORIES}
    for record in records:
        records_by_category[record["label"]].append(record)

    for category, category_records in records_by_category.items():
        if not category_records:
            continue

        story.append(Paragraph(f"{escape(category)} ({len(category_records)})", styles["Heading2"]))
        for record in category_records:
            # Helvetica does not cover all Unicode characters; preserve unsupported ones as readable escapes.
            text = "".join(
                char
                if ord(char) <= 255
                else f"\\u{ord(char):04x}" if ord(char) <= 0xFFFF else f"\\U{ord(char):08x}"
                for char in record["text"]
            )
            message = escape(text).replace("\n", "<br/>")
            created_at = escape(record["created_at"])
            story.append(Paragraph(message, styles["BodyText"]))
            story.append(Paragraph(created_at, styles["Italic"]))
            story.append(Spacer(1, 8))

    document.build(story)
    return buffer.getvalue()


def load_example_messages() -> None:
    # Callback executes before Streamlit redraws the text area.
    st.session_state["message_input"] = "\n".join(EXAMPLE_MESSAGES)


def render_message_card(record: dict) -> None:
    message = html.escape(record["text"]).replace("\n", "<br>")
    label = record["label"]
    background, foreground = CATEGORY_COLORS[label]
    safe_label = html.escape(label)
    created = html.escape(record["created_at"])

    st.markdown(
        f"""
        <div class="message-card">
          <div class="message-content">{message}</div>
          <div class="message-footer">
            <span class="category-tag" style="background:{background};color:{foreground};">{safe_label}</span>
            <span class="message-time">{created}</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# Styling to make the page look like a minimal inbox.
st.markdown(
    """
    <style>
      .block-container { padding-top: 1.3rem; max-width: 1180px; }
      .inbox-title { font-size: 1.55rem; font-weight: 700; margin-bottom: .15rem; }
      .inbox-subtitle { color: #687386; font-size: .9rem; margin-bottom: 1.1rem; }
      .message-card {
        border: 1px solid #e4e7ec; border-radius: 12px; padding: 15px 17px;
        margin: 8px 0; background: var(--secondary-background-color, #ffffff);
      }
      .message-content { color: var(--text-color, #1d2939); font-size: 1rem; line-height: 1.45; overflow-wrap: anywhere; }
      .message-footer { display: flex; gap: 10px; align-items: center; margin-top: 11px; }
      .category-tag { display: inline-block; border-radius: 6px; padding: 3px 8px; font-size: .78rem; font-weight: 600; }
      .message-time { color: #8a94a6; font-size: .75rem; margin-left: auto; }
      div[data-testid="stSidebar"] { border-right: 1px solid #e6e8ec; }
      div[data-testid="stProgressBar"] { margin-bottom: .6rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

# Clear the previous input before the text area is created on this rerun.
if st.session_state.pop("_clear_message_input", False):
    st.session_state["message_input"] = ""

if "inbox_messages" not in st.session_state:
    st.session_state["inbox_messages"] = []

messages = st.session_state["inbox_messages"]

# Sidebar folders and live counts.
st.sidebar.markdown("## Inbox")
st.sidebar.caption("FOLDERS")
folder_options = ["All messages"] + list(CATEGORIES.keys())


def folder_count(folder: str) -> int:
    if folder == "All messages":
        return len(messages)
    return sum(1 for item in messages if item["label"] == folder)

selected_folder = st.sidebar.radio(
    "Folders",
    options=folder_options,
    format_func=lambda folder: f"{folder}   {folder_count(folder)}",
    label_visibility="collapsed",
)
st.sidebar.divider()
st.sidebar.caption(f"Model: {MODEL_NAME}")
st.sidebar.caption(f"Device when loaded: {'CUDA / NVIDIA GPU' if torch.cuda.is_available() else 'CPU'}")
st.sidebar.caption(f"CPU inference threads: {CPU_THREAD_COUNT}")

# Main inbox header.
header_col, count_col = st.columns([8, 1])
with header_col:
    st.markdown('<div class="inbox-title">Inbox</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="inbox-subtitle">Classify message text locally with the BGE reranker.</div>',
        unsafe_allow_html=True,
    )
with count_col:
    st.metric("Messages", folder_count(selected_folder))

st.markdown("#### Test messages")
st.caption("Paste one message per line. The app classifies each message and adds its label to the inbox.")

# The callback lets the sample button safely fill this widget's state.
input_col, action_col = st.columns([5, 1])
with input_col:
    raw_input = st.text_area(
        "Message text",
        key="message_input",
        height=115,
        placeholder=(
            "Ap wedding shoot bhi krte ho ky\n"
            "Bhai ek video edit Kari h story pr h dekh acchi ho to colleb kar le"
        ),
        label_visibility="collapsed",
    )
with action_col:
    st.button("Load examples", on_click=load_example_messages, use_container_width=True)
    classify_clicked = st.button("Classify messages", type="primary", use_container_width=True)
    st.caption("No fixed message limit. Large batches may take longer to classify.")

# A placeholder is used to show results as each message is processed.
live_results = st.empty()

if classify_clicked:
    input_messages = [line.strip() for line in st.session_state.get("message_input", "").splitlines() if line.strip()]

    if not input_messages:
        st.warning("Enter at least one message, or click Load examples.")
    else:
        with live_results.container():
            with st.spinner(f"Loading {MODEL_NAME} if needed..."):
                device = "cuda" if torch.cuda.is_available() else "cpu"
                model = load_model(device)

            status = st.empty()
            progress = st.progress(0)
            live_cards = st.container()

            for chunk_start in range(0, len(input_messages), CLASSIFICATION_CHUNK_SIZE):
                chunk = input_messages[chunk_start : chunk_start + CLASSIFICATION_CHUNK_SIZE]
                chunk_end = chunk_start + len(chunk)
                status.caption(
                    f"Classifying messages {chunk_start + 1}–{chunk_end} of {len(input_messages)}…"
                )
                classifications = classify_messages(model, chunk)

                for message, (label, score) in zip(chunk, classifications):
                    record = {
                        "text": message,
                        "label": label,
                        # Keep the score internally for later evaluation, but don't present it as a probability.
                        "score": score,
                        "created_at": datetime.now().strftime("Just now · %H:%M:%S"),
                    }
                    st.session_state["inbox_messages"].insert(0, record)

                    # Re-render the live area after each new result.
                    with live_cards:
                        render_message_card(record)

                progress.progress(chunk_end / len(input_messages))

            status.success(f"Finished classifying {len(input_messages)} message(s).")

        # Clear the text box at the start of the next run, then redraw counts and folders.
        st.session_state["_clear_message_input"] = True
        st.rerun()

# Export the full inbox so downloads include results from earlier batches in this session.
if messages:
    st.divider()
    st.markdown("#### Export classifications")
    st.caption("Exports all classified messages currently in the inbox.")
    export_col, jsonl_col = st.columns(2)
    with export_col:
        st.download_button(
            "Download organized PDF",
            data=build_pdf_export(messages),
            file_name="classified_messages.pdf",
            mime="application/pdf",
            use_container_width=True,
        )
    with jsonl_col:
        jsonl_data = "\n".join(
            json.dumps({"text": record["text"], "label": record["label"]}, ensure_ascii=False)
            for record in messages
        )
        st.download_button(
            "Download compact JSONL",
            data=jsonl_data,
            file_name="classified_messages.jsonl",
            mime="application/x-ndjson",
            help="One compact JSON object per line, suitable for agents and LLM workflows.",
            use_container_width=True,
        )

# Render stored inbox messages. No sender names or profile pictures are displayed.
visible_messages = [
    item for item in st.session_state["inbox_messages"]
    if selected_folder == "All messages" or item["label"] == selected_folder
]

st.divider()
st.markdown(f"#### {selected_folder}")
if not visible_messages:
    st.info("No messages in this folder yet. Paste some messages above and click Classify messages.")
else:
    for record in visible_messages:
        render_message_card(record)

st.caption("Labels are best-match predictions, not guaranteed truth or calibrated confidence probabilities. Review important or ambiguous messages manually.")
