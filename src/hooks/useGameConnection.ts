'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { GameState, Position, Team } from '@/lib/game'

type ServerMessage =
    | { type: 'joined'; gameId: string; team: Team; opponentConnected: boolean }
    | { type: 'state'; state: GameState }
    | { type: 'opponent_joined' }
    | { type: 'opponent_left' }
    | { type: 'restart_status'; pending: Team[] }
    | { type: 'restart_declined' }
    | { type: 'error'; message: string }

export type ConnectionStatus =
    | 'idle'
    | 'connecting'
    | 'waiting-for-opponent'
    | 'playing'
    | 'opponent-left'
    | 'error'

type SessionInfo = { gameId: string; token: string; team: Team }

const HTTP_URL = process.env.NEXT_PUBLIC_GAME_SERVER_HTTP_URL ?? 'http://localhost:8787'
const WS_URL = process.env.NEXT_PUBLIC_GAME_SERVER_WS_URL ?? 'ws://localhost:8787/ws'
const GAME_QUERY_PARAM = 'game'

const sessionStorageKey = (gameId: string) => `rps-session:${gameId}`

const readCachedSession = (gameId: string): SessionInfo | null => {
    const raw = sessionStorage.getItem(sessionStorageKey(gameId))
    if (!raw) return null
    try {
        return JSON.parse(raw) as SessionInfo
    } catch {
        return null
    }
}

const writeCachedSession = (session: SessionInfo) => {
    sessionStorage.setItem(sessionStorageKey(session.gameId), JSON.stringify(session))
}

async function createSession(): Promise<SessionInfo> {
    const res = await fetch(`${HTTP_URL}/games`, { method: 'POST' })
    if (!res.ok) throw new Error('Unable to reach the game server.')
    const session = (await res.json()) as SessionInfo
    writeCachedSession(session)
    return session
}

async function joinSession(rawGameId: string): Promise<SessionInfo> {
    const gameId = rawGameId.trim()
    if (!gameId) throw new Error('Enter a room code to join.')

    const cached = readCachedSession(gameId.toUpperCase())
    if (cached) return cached

    const res = await fetch(`${HTTP_URL}/games/${encodeURIComponent(gameId)}/join`, { method: 'POST' })
    if (!res.ok) throw new Error('Room not found. Double-check the code and try again.')
    const session = (await res.json()) as SessionInfo
    writeCachedSession(session)
    return session
}

/**
 * Drives the main-menu → match lifecycle: `createGame`/`joinGame` create or join a
 * room on the server, then a WebSocket keeps `state` in sync with the server's
 * authoritative GameState for the rest of the match. The server validates and
 * applies every move.
 */
export const useGameConnection = () => {
    const [session, setSession] = useState<SessionInfo | null>(null)
    const [state, setState] = useState<GameState | null>(null)
    const [status, setStatus] = useState<ConnectionStatus>('connecting')
    const [error, setError] = useState<string | null>(null)
    const [restartPending, setRestartPending] = useState<Team[]>([])
    const [restartNotice, setRestartNotice] = useState<string | null>(null)
    const socketRef = useRef<WebSocket | null>(null)

    const beginSession = useCallback((promise: Promise<SessionInfo>) => {
        setStatus('connecting')
        setError(null)
        promise
            .then((newSession) => {
                setSession(newSession)
                const url = new URL(window.location.href)
                url.searchParams.set(GAME_QUERY_PARAM, newSession.gameId)
                window.history.replaceState(null, '', url.toString())
            })
            .catch((err: unknown) => {
                setStatus('error')
                setError(err instanceof Error ? err.message : 'Something went wrong.')
            })
    }, [])

    const createGame = useCallback(() => beginSession(createSession()), [beginSession])
    const joinGame = useCallback((gameId: string) => beginSession(joinSession(gameId)), [beginSession])

    const returnToMenu = useCallback(() => {
        socketRef.current?.close()
        setSession(null)
        setState(null)
        setError(null)
        setRestartPending([])
        setRestartNotice(null)
        setStatus('idle')
        const url = new URL(window.location.href)
        url.searchParams.delete(GAME_QUERY_PARAM)
        window.history.replaceState(null, '', url.toString())
    }, [])

    // If the page was opened via a shared `?game=` link, auto-join that room. Otherwise fall
    // back to the idle main menu so the player can choose Create or Join. This intentionally
    // resolves the fetch inline (rather than via the memoized joinGame/beginSession helpers)
    // so no state setter runs synchronously within the effect body itself.
    useEffect(() => {
        let cancelled = false

        // Deferred to a microtask so the initial idle/join decision below never calls a
        // state setter synchronously within the effect body itself.
        Promise.resolve().then(() => {
            if (cancelled) return

            const url = new URL(window.location.href)
            const gameIdFromUrl = url.searchParams.get(GAME_QUERY_PARAM)

            if (!gameIdFromUrl) {
                setStatus('idle')
                return
            }

            joinSession(gameIdFromUrl)
                .then((newSession) => {
                    if (cancelled) return
                    setSession(newSession)
                    const nextUrl = new URL(window.location.href)
                    nextUrl.searchParams.set(GAME_QUERY_PARAM, newSession.gameId)
                    window.history.replaceState(null, '', nextUrl.toString())
                })
                .catch((err: unknown) => {
                    if (cancelled) return
                    setStatus('error')
                    setError(err instanceof Error ? err.message : 'Failed to join room.')
                })
        })

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!session) return

        const ws = new WebSocket(`${WS_URL}?gameId=${session.gameId}&token=${session.token}`)
        socketRef.current = ws

        ws.onmessage = (event) => {
            const message = JSON.parse(String(event.data)) as ServerMessage
            switch (message.type) {
                case 'joined':
                    setStatus(message.opponentConnected ? 'playing' : 'waiting-for-opponent')
                    break
                case 'state':
                    setState(message.state)
                    break
                case 'opponent_joined':
                    setStatus('playing')
                    break
                case 'opponent_left':
                    setStatus('opponent-left')
                    setRestartPending([])
                    setRestartNotice(null)
                    break
                case 'restart_status':
                    setRestartPending(message.pending)
                    break
                case 'restart_declined':
                    setRestartNotice('Opponent declined your restart request.')
                    break
                case 'error':
                    setError(message.message)
                    break
            }
        }
        ws.onerror = () => {
            setStatus('error')
            setError('Lost connection to the game server.')
        }

        return () => {
            ws.close()
            if (socketRef.current === ws) socketRef.current = null
        }
    }, [session])

    const sendMove = useCallback((pieceId: string, to: Position) => {
        socketRef.current?.send(JSON.stringify({ type: 'move', pieceId, to }))
    }, [])

    const requestRestart = useCallback(() => {
        setRestartNotice(null)
        socketRef.current?.send(JSON.stringify({ type: 'restart' }))
    }, [])

    const cancelRestart = useCallback(() => {
        socketRef.current?.send(JSON.stringify({ type: 'cancel_restart' }))
    }, [])

    const declineRestart = useCallback(() => {
        socketRef.current?.send(JSON.stringify({ type: 'decline_restart' }))
    }, [])

    const dismissRestartNotice = useCallback(() => {
        setRestartNotice(null)
    }, [])

    return {
        gameId: session?.gameId ?? null,
        team: session?.team ?? null,
        state,
        status,
        error,
        restartPending,
        restartNotice,
        createGame,
        joinGame,
        sendMove,
        requestRestart,
        cancelRestart,
        declineRestart,
        dismissRestartNotice,
        returnToMenu,
    }
}
