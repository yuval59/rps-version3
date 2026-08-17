import { createHash, randomBytes } from 'node:crypto'
import type { ServerWebSocket } from 'bun'

import { GameRoom } from './gameRoom'
import type { Team } from './game'
import type { ClientMessage } from './protocol'

type Socket = ServerWebSocket<unknown>

/** How long an empty room is kept around before being garbage-collected. */
const ROOM_TTL_MS = 30 * 60 * 1000

/** Length of the human-shareable room code (shorter and easier to read/type than a UUID). */
const ROOM_ID_LENGTH = 6

/** Derives a short, shareable room code from an MD5 hash of random bytes. */
const generateRoomId = (): string =>
    createHash('md5').update(randomBytes(16)).digest('hex').slice(0, ROOM_ID_LENGTH).toUpperCase()

const normalizeRoomId = (gameId: string) => gameId.trim().toUpperCase()

export class Lobby {
    private rooms = new Map<string, GameRoom>()

    createGame(): { gameId: string; token: string; team: Team } {
        let gameId = generateRoomId()
        while (this.rooms.has(gameId)) {
            gameId = generateRoomId()
        }

        const room = new GameRoom(gameId)
        this.rooms.set(gameId, room)
        const token = room.addPlayer('blue')
        return { gameId, token, team: 'blue' }
    }

    joinGame(rawGameId: string): { gameId: string; token: string; team: Team } | null {
        const gameId = normalizeRoomId(rawGameId)
        const room = this.rooms.get(gameId)
        if (!room) return null

        const team = room.nextOpenTeam()
        if (!team) return null

        const token = room.addPlayer(team)
        return { gameId, token, team }
    }

    authenticate(gameId: string, token: string): Team | null {
        return this.rooms.get(normalizeRoomId(gameId))?.authenticate(token) ?? null
    }

    handleConnect(gameId: string, team: Team, ws: Socket) {
        this.rooms.get(gameId)?.attachSocket(team, ws)
    }

    handleMessage(gameId: string, team: Team, message: ClientMessage) {
        this.rooms.get(gameId)?.handleMessage(team, message)
    }

    handleDisconnect(gameId: string, team: Team, ws: Socket) {
        const room = this.rooms.get(gameId)
        room?.detachSocket(team, ws)
        this.scheduleCleanup(gameId)
    }

    private scheduleCleanup(gameId: string) {
        setTimeout(() => {
            const room = this.rooms.get(gameId)
            if (room && !room.hasActiveSockets()) {
                this.rooms.delete(gameId)
            }
        }, ROOM_TTL_MS)
    }
}
