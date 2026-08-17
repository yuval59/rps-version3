import { randomUUID } from 'node:crypto'
import type { ServerWebSocket } from 'bun'

import { applyMove, createInitialGameState, otherTeam, type GameState, type Team } from './game'
import type { ClientMessage, ServerMessage } from './protocol'

type Socket = ServerWebSocket<unknown>

/** Manages a single match between two players: their tokens/sockets and the authoritative state. */
export class GameRoom {
    readonly gameId: string
    private state: GameState = createInitialGameState()
    private tokens: Partial<Record<Team, string>> = {}
    private sockets: Partial<Record<Team, Socket>> = {}
    private restartRequests = new Set<Team>()

    constructor(gameId: string) {
        this.gameId = gameId
    }

    /** Returns the next team without an assigned player, or null if the room is full. */
    nextOpenTeam(): Team | null {
        if (!this.tokens.blue) return 'blue'
        if (!this.tokens.red) return 'red'
        return null
    }

    /** Reserves a seat for the given team and returns a session token for it. */
    addPlayer(team: Team): string {
        const token = randomUUID()
        this.tokens[team] = token
        return token
    }

    /** Resolves a session token to its team, if valid for this room. */
    authenticate(token: string): Team | null {
        if (this.tokens.blue === token) return 'blue'
        if (this.tokens.red === token) return 'red'
        return null
    }

    attachSocket(team: Team, ws: Socket) {
        const opponentConnected = Boolean(this.sockets[otherTeam(team)])
        this.sockets[team] = ws

        // Once both players are connected, (re)start from a clean board. This guards against
        // stale state (e.g. a move sent while waiting alone) and gives reconnects a fresh game.
        if (opponentConnected) {
            this.state = createInitialGameState(this.state.boardSize)
            this.clearRestartRequests()
        }

        this.send(team, { type: 'joined', gameId: this.gameId, team, opponentConnected })

        if (opponentConnected) {
            this.broadcastAll({ type: 'state', state: this.state })
        } else {
            this.send(team, { type: 'state', state: this.state })
        }

        this.broadcastExcept(team, { type: 'opponent_joined' })
    }

    detachSocket(team: Team, ws: Socket) {
        // Only clear the slot if it still points at this exact socket (avoids
        // clobbering a newer reconnection that already replaced it).
        if (this.sockets[team] === ws) {
            delete this.sockets[team]
            this.clearRestartRequests()
            this.broadcastExcept(team, { type: 'opponent_left' })
        }
    }

    hasActiveSockets() {
        return Boolean(this.sockets.blue || this.sockets.red)
    }

    handleMessage(team: Team, message: ClientMessage) {
        if (message.type === 'move') {
            if (this.state.winner) {
                this.send(team, { type: 'error', message: 'Game is already over' })
                return
            }
            if (team !== this.state.turn) {
                this.send(team, { type: 'error', message: 'Not your turn' })
                return
            }

            const next = applyMove(this.state, message.pieceId, message.to)
            if (next === this.state) {
                this.send(team, { type: 'error', message: 'Illegal move' })
                return
            }

            this.state = next
            this.broadcastAll({ type: 'state', state: this.state })
            return
        }

        if (message.type === 'restart') {
            this.restartRequests.add(team)

            if (this.restartRequests.size === 2) {
                this.state = createInitialGameState(this.state.boardSize)
                this.clearRestartRequests()
                this.broadcastAll({ type: 'state', state: this.state })
                return
            }

            this.broadcastAll({ type: 'restart_status', pending: [...this.restartRequests] })
            return
        }

        if (message.type === 'cancel_restart') {
            if (this.restartRequests.delete(team)) {
                this.broadcastAll({ type: 'restart_status', pending: [...this.restartRequests] })
            }
            return
        }

        if (message.type === 'decline_restart') {
            if (this.restartRequests.size === 0) return

            // Notify whoever had requested a restart (excluding the decliner themselves,
            // in case both had somehow requested) that it was declined.
            for (const requester of this.restartRequests) {
                if (requester !== team) this.send(requester, { type: 'restart_declined' })
            }

            this.restartRequests.clear()
            this.broadcastAll({ type: 'restart_status', pending: [] })
        }
    }

    private clearRestartRequests() {
        if (this.restartRequests.size === 0) return
        this.restartRequests.clear()
        this.broadcastAll({ type: 'restart_status', pending: [] })
    }

    private send(team: Team, message: ServerMessage) {
        this.sockets[team]?.send(JSON.stringify(message))
    }

    private broadcastAll(message: ServerMessage) {
        this.send('blue', message)
        this.send('red', message)
    }

    private broadcastExcept(team: Team, message: ServerMessage) {
        this.send(otherTeam(team), message)
    }
}
