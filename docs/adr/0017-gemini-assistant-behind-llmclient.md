# 0017. "Ask my resume" with Gemini behind our own LlmClient, without RAG

- **Status:** Accepted
- **Date:** 2026-11-24
- **Related:** spec "Build order, step 12", commit 815fe2d

## Context

Visitors can ask questions about the resume. Answers must come only from the public resume, cost must be capped, visitor input is untrusted, and the questions must not be stored.

## Decision

- Google Gemini through the official `@google/genai` SDK, behind our own `LlmClient` interface (a fake in tests, the provider can change). `GEMINI_MODEL` lists models to try in order; when one is rejected the next is tried, and the one that answered is tried first next time.
- One stateless call per question: the whole public resume goes into the prompt. Plain request/response (`POST /api/assistant/ask`), short JSON answers shown as plain text, with an optional Explore query checked by `@my-resume/query-parser`.
- 10 questions per 10 minutes per IP, a monthly token cap (`ASSISTANT_MONTHLY_TOKEN_LIMIT`, then 503), only monthly totals stored. Off by default in Preferences; unavailable without `GEMINI_API_KEY`.

## Alternatives considered

- **LangChain / LangGraph:** no tools, no retriever, one call; the framework adds weight and churn.
- **RAG with a vector store:** the resume fits in the prompt.
- **Streaming answers:** answers are short, and streaming needs proxy buffering changes; left for 12b.
- **Another provider:** possible later through `LlmClient` without touching the rest of the assistant.

## Consequences

Cheap and simple; a bigger resume or multi-turn chat would revisit RAG and streaming. Prompt injection is handled by instructions and plain-text rendering, not by a guarantee.
