# MCP External Website POC

This document describes the minimal proof-of-concept to consume tenant business context from `sts-ai` in an external frontend website.

## Endpoints

- Handshake: `POST /api/mcp/handshake`
- JSON-RPC: `POST /api/mcp/jsonrpc`

## 1) Handshake

Request (authenticated creator session):

```json
{
  "tenantId": "<tenant-id>",
  "domain": "https://example-client-site.com",
  "scopes": [
    "tenant.core.compact.read",
    "tenant.industry.compact.read",
    "tenant.social.compact.read",
    "tenant.services.list.read",
    "tenant.pricing.read",
    "tenant.links.read"
  ]
}
```

Response:

- short-lived bearer token
- scope list
- expiry timestamp

## 2) JSON-RPC calls

### initialize

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}
```

### resources/list

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/list",
  "params": {}
}
```

### resources/read

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "mcp://tenant/<tenant-id>/services/list"
  }
}
```

## 3) Render strategy in external site

Use returned resources to build pages dynamically:

- hero/header content from `core/compact`
- service copy from `industry/compact`
- social/footer links from `social/compact`
- package CTA labels from `pricing`
- chat/checkout/link metadata from `links`

## 4) PrimeOne insurance experiment

To validate with your external test app:

1. clone `https://github.com/itsMrApon/primeone_Insurance`
2. add a small MCP client utility that:
   - obtains handshake token from `sts-ai`
   - calls `resources/read` for selected URIs
   - maps response to existing service cards/sections
3. compare manual hardcoded content vs MCP-driven content updates.

## 5) Security notes

- keep handshake endpoint authenticated (creator/backoffice only)
- keep bearer token short-lived
- enforce scope checks on every `resources/read`
- validate tenant ownership in handshake flow

