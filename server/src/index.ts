import type { ServerWebSocket } from 'bun'

import { Lobby } from './lobby'
import type { Team } from './game'
import type { ClientMessage } from './protocol'

const PORT = Number(process.env.PORT ?? 8787)

const lobby = new Lobby()

const CORS_HEADERS = {
    'access-control-allow-origin': process.env.CORS_ORIGIN ?? '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
}

const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
        ...init,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS, ...init.headers },
    })

type SocketData = { gameId: string; team: Team }

Bun.serve<SocketData>({
    port: PORT,
    fetch(req, server) {
        const url = new URL(req.url)

        if (req.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS })
        }

        if (url.pathname === '/health') {
            return json({ ok: true })
        }

        if (url.pathname === '/games' && req.method === 'POST') {
            const { gameId, token, team } = lobby.createGame()
            return json({ gameId, token, team })
        }

        const joinMatch = url.pathname.match(/^\/games\/([^/]+)\/join$/)
        if (joinMatch && req.method === 'POST') {
            const result = lobby.joinGame(joinMatch[1])
            if (!result) return json({ error: 'Room not found or already full' }, { status: 404 })
            return json(result)
        }

        if (url.pathname === '/ws') {
            const gameId = url.searchParams.get('gameId')
            const token = url.searchParams.get('token')
            if (!gameId || !token) return new Response('Missing gameId or token', { status: 400 })

            const team = lobby.authenticate(gameId, token)
            if (!team) return new Response('Invalid game or token', { status: 403 })

            const upgraded = server.upgrade(req, { data: { gameId, team } })
            if (!upgraded) return new Response('WebSocket upgrade failed', { status: 400 })
            return undefined
        }

        return json({ error: 'Not found' }, { status: 404 })
    },
    websocket: {
        open(ws: ServerWebSocket<SocketData>) {
            lobby.handleConnect(ws.data.gameId, ws.data.team, ws)
        },
        message(ws: ServerWebSocket<SocketData>, raw) {
            let message: ClientMessage
            try {
                message = JSON.parse(String(raw))
            } catch {
                return
            }
            lobby.handleMessage(ws.data.gameId, ws.data.team, message)
        },
        close(ws: ServerWebSocket<SocketData>) {
            lobby.handleDisconnect(ws.data.gameId, ws.data.team, ws)
        },
    },
})

console.log(`RPS game server listening on http://localhost:${PORT}`)
