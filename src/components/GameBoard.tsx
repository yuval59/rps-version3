'use client'

import { useState } from 'react'

import { Board } from './Board'
import { MainMenu } from './MainMenu'
import { Player } from './Player'
import type { Position } from './Player'
import { getLegalMoves, getPieceAt, isSamePosition, type GameState } from '@/lib/game'
import { useGameConnection } from '@/hooks/useGameConnection'

const TEAM_LABEL = {
    blue: 'Blue',
    red: 'Red',
} as const

export const GameBoard = () => {
    const {
        gameId,
        team,
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
    } = useGameConnection()
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // Selection is purely local UI state. Whenever the server pushes a new state (e.g. after
    // a move is applied, a restart, or the opponent's turn begins) it should no longer carry
    // over, so we reset it during render rather than in an effect (see react.dev guidance on
    // adjusting state when props/derived values change).
    const [prevState, setPrevState] = useState<GameState | null>(state)
    if (state !== prevState) {
        setPrevState(state)
        setSelectedId(null)
    }

    if (status === 'connecting') {
        return <div className='text-lg'>Connecting to game server…</div>
    }

    // Idle: no active room yet, or a create/join attempt failed before a room was joined.
    if (status === 'idle' || (status === 'error' && !gameId)) {
        return <MainMenu onCreate={createGame} onJoin={joinGame} error={error} />
    }

    if (status === 'error' || !state) {
        return (
            <div className='flex flex-col items-center gap-4'>
                <div className='text-lg text-red-600'>{error ?? 'Something went wrong.'}</div>
                <button
                    type='button'
                    onClick={returnToMenu}
                    className='rounded border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
                >
                    Back to menu
                </button>
            </div>
        )
    }

    const { boardSize, pieces, turn, winner } = state
    const selectedPiece = pieces.find((piece) => piece.id === selectedId) ?? null
    const legalMoves = selectedPiece ? getLegalMoves(selectedPiece, pieces, boardSize) : []
    const moveSquares = legalMoves.filter((move) => !getPieceAt(pieces, move))
    const captureSquares = legalMoves.filter((move) => getPieceAt(pieces, move))
    const isMyTurn = team === turn && !winner && status === 'playing'
    const iRequestedRestart = team != null && restartPending.includes(team)
    const opponentRequestedRestart = restartPending.length > 0 && !iRequestedRestart

    const handleSquareClick = (position: Position) => {
        if (!isMyTurn) return

        const clickedPiece = getPieceAt(pieces, position)

        // A piece is already selected: try to move it, switch selection, or deselect.
        if (selectedPiece) {
            if (clickedPiece && clickedPiece.id === selectedPiece.id) {
                setSelectedId(null)
                return
            }

            if (legalMoves.some((move) => isSamePosition(move, position))) {
                sendMove(selectedPiece.id, position)
                return
            }

            if (clickedPiece && clickedPiece.team === turn) {
                setSelectedId(clickedPiece.id)
                return
            }

            setSelectedId(null)
            return
        }

        // Nothing selected yet: select an own piece.
        if (clickedPiece && clickedPiece.team === turn) {
            setSelectedId(clickedPiece.id)
        }
    }

    return (
        <div className='flex flex-col items-center gap-4'>
            <div className='text-lg font-medium'>
                {winner ? (
                    <span>{TEAM_LABEL[winner]} wins!</span>
                ) : status === 'waiting-for-opponent' ? (
                    <span>Waiting for opponent to join…</span>
                ) : status === 'opponent-left' ? (
                    <span>Opponent disconnected</span>
                ) : (
                    <span>
                        {TEAM_LABEL[turn]}&apos;s turn {team === turn ? '(you)' : ''}
                    </span>
                )}
            </div>

            {team && <div className='text-sm text-black/60 dark:text-white/60'>You are {TEAM_LABEL[team]}</div>}

            {status === 'waiting-for-opponent' && gameId && (
                <div className='rounded border border-black/10 bg-black/5 px-3 py-2 text-center text-sm dark:border-white/10 dark:bg-white/5'>
                    Room code is <span className='font-mono text-base font-semibold tracking-widest'>{gameId}</span>
                </div>
            )}

            {opponentRequestedRestart && (
                <div className='flex flex-col items-center gap-2 rounded border border-black/10 bg-black/5 px-3 py-2 text-center text-sm dark:border-white/10 dark:bg-white/5'>
                    <span>Opponent wants to restart the game.</span>
                    <div className='flex gap-3'>
                        <button
                            type='button'
                            onClick={requestRestart}
                            className='rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700'
                        >
                            Confirm
                        </button>
                        <button
                            type='button'
                            onClick={declineRestart}
                            className='rounded border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
                        >
                            Decline
                        </button>
                    </div>
                </div>
            )}

            {restartNotice && (
                <div className='flex items-center gap-3 rounded border border-black/10 bg-black/5 px-3 py-2 text-center text-sm dark:border-white/10 dark:bg-white/5'>
                    <span>{restartNotice}</span>
                    <button
                        type='button'
                        onClick={dismissRestartNotice}
                        aria-label='Dismiss'
                        className='text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white'
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className='relative'>
                <Board
                    size={boardSize}
                    onSquareClick={handleSquareClick}
                    selectedSquare={selectedPiece?.position ?? null}
                    highlightedSquares={moveSquares}
                    captureSquares={captureSquares}
                />
                {pieces.map((piece) => (
                    <Player
                        key={piece.id}
                        boardSize={boardSize}
                        position={piece.position}
                        team={piece.team}
                        type={piece.type}
                        className={piece.id === selectedId ? 'drop-shadow-[0_0_6px_rgba(250,204,21,0.9)]' : ''}
                    />
                ))}
            </div>

            <div className='flex gap-3'>
                {iRequestedRestart ? (
                    <button
                        type='button'
                        onClick={cancelRestart}
                        className='rounded border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
                    >
                        Cancel restart request
                    </button>
                ) : (
                    <button
                        type='button'
                        onClick={requestRestart}
                        disabled={opponentRequestedRestart}
                        className='rounded border border-black/10 px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10'
                    >
                        Restart
                    </button>
                )}
                <button
                    type='button'
                    onClick={returnToMenu}
                    className='rounded border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
                >
                    Leave
                </button>
            </div>
        </div>
    )
}
