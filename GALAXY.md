# Galaxy.ai notes for Sage Router

## Auth
- Env var: `GALAXY_API_KEY`
- REST base: `https://app.galaxy.ai/api`
- MCP endpoint: `https://app.galaxy.ai/api/mcp`

## What Galaxy is
Galaxy is not a drop-in OpenAI `/v1/chat/completions` provider.
It exposes:
- async direct model runs via `/v1/nodes/{nodeType}/run`
- polling via `/v1/nodes/runs/{runId}`
- remote MCP tools for workflow management and model runs

## MCP
Example MCP config:

```json
{
  "mcpServers": {
    "galaxyai": {
      "url": "https://app.galaxy.ai/api/mcp",
      "headers": {
        "Authorization": "Bearer ${GALAXY_API_KEY}"
      }
    }
  }
}
```

## High-value tools exposed by Galaxy MCP
- `list_models`
- `run_model`
- `get_model_run`
- `list_workflows`
- `get_workflow`
- `create_workflow`
- `add_node`
- `connect_nodes`
- `start_run`
- `get_run`

## Adapter shape for Sage Router
A future `galaxy-workflow` adapter should:
1. map routed request intent to a Galaxy node/model or workflow
2. `POST /v1/nodes/{nodeType}/run`
3. poll `GET /v1/nodes/runs/{runId}` until terminal state
4. translate output into OpenAI-style assistant content or tool-call payloads
5. use dynamic timeout policy based on intent/route mode

## Caveats
- async by design, so latency can be materially higher than standard chat providers
- real-time token streaming is not native in the same way as OpenAI SSE
- MCP is best for workflow/tool access, not as a transparent chat-completions replacement
