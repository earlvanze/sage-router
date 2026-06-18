# Use Sage Router with OpenHands

OpenHands can route through Sage Router when configured with an OpenAI-compatible endpoint.

```bash
export OPENAI_BASE_URL=http://localhost:8790/v1
export OPENAI_API_KEY=local-router
```

Use Sage Router to keep OpenHands on one stable endpoint while routing between local models, Ollama Cloud, NVIDIA NIM, and cloud APIs according to policy and health.

Recommended route mode: `balanced` for general tasks, `best` for fragile repo-wide changes, and `local-first` for low-risk background work.
