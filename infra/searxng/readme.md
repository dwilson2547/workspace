# Searxng

Local SearXNG docker to be queried by an MCP server.

## Start

1) Ensure Docker and Docker Compose are installed.
2) From this folder, start the service:
	- `docker compose up -d`

SearXNG will be available at http://localhost:8080/.

## API usage

Example JSON search request:

`http://localhost:8080/search?q=hello&format=json`

## Configuration

Settings are mounted from ./searxng/settings.yml.
Update the `server.secret_key` value before exposing beyond localhost.

## Troubleshooting

- If you see 403 when using `format=json`, restart the container after changing settings or limiter config.
- For WSL2 + Windows clients, ensure ./searxng/limiter.toml exists and allows private network IPs.
- Check container logs for bot detection messages if 403 persists.