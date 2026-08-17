import type { GameState, Position, Team } from './game'

export type ClientMessage =
    | { type: 'move'; pieceId: string; to: Position }
    | { type: 'restart' }
    | { type: 'cancel_restart' }
    | { type: 'decline_restart' }

export type ServerMessage =
    | { type: 'joined'; gameId: string; team: Team; opponentConnected: boolean }
    | { type: 'state'; state: GameState }
    | { type: 'opponent_joined' }
    | { type: 'opponent_left' }
    /** Teams that currently have a pending restart request. Empty once cleared/resolved. */
    | { type: 'restart_status'; pending: Team[] }
    /** Sent to the requester(s) when the other player explicitly declines a pending restart. */
    | { type: 'restart_declined' }
    | { type: 'error'; message: string }
