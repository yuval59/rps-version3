# RPS Game Server

Standalone, fully isolated Bun server that authoritatively hosts matches for the
RPS board game (king-style movement, row-based win condition). It is a separate
app from the Next.js client: its own `package.json`, `tsconfig.json`, and
dependencies.

## Run

```bash
cd server
bun install
bun run dev   # watches for changes, listens on :8787 by default
```

Config via environment variables:
- `PORT` — port to listen on (default `8787`)
- `CORS_ORIGIN` — value for `Access-Control-Allow-Origin` (default `*`)

## HTTP API

- `POST /games` → creates a game, returns `{ gameId, token, team: 'blue' }`
- `POST /games/:id/join` → joins as the second player, returns `{ gameId, token, team: 'red' }`
- `GET /health` → `{ ok: true }`

## WebSocket

Connect to `ws(s)://<host>/ws?gameId=<gameId>&token=<token>`.

Client → server messages:
- `{ "type": "move", "pieceId": "blue-rock", "to": { "row": 1, "col": 0 } }`
- `{ "type": "restart" }`

Server → client messages:
- `{ "type": "joined", "gameId": "...", "team": "blue" }`
- `{ "type": "state", "state": GameState }`
- `{ "type": "opponent_joined" }`
- `{ "type": "opponent_left" }`
- `{ "type": "error", "message": "..." }`

The server is the single source of truth for game state: it validates every
move against the same rules as the client (one square in any direction, no
landing on an occupied square) and declares a winner when a piece reaches the
opposing back row.
