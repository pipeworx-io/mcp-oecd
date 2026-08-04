# @pipeworx/oecd

OECD data MCP — SDMX 2.1 REST API at sdmx.oecd.org, no auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `list_curated_flows(topic?)` — pre-vetted dataflow refs by topic.
- `search_dataflows(query, agency?, limit?)` — keyword search against the dataflow registry.
- `fetch_dataset(flow_ref, key?, start_period?, end_period?, limit?)` — tidy CSV-with-labels rows for any OECD dataflow.

## Finding flow refs

Browse https://data-explorer.oecd.org interactively, or use `search_dataflows`.

## Data source

`https://sdmx.oecd.org/public/rest/` — public, no key required.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "oecd": {
      "url": "https://gateway.pipeworx.io/oecd/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Oecd data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
