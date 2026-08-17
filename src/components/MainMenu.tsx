'use client'

import { useState, type FormEvent } from 'react'

export type MainMenuProps = {
    onCreate: () => void
    onJoin: (gameId: string) => void
    error?: string | null
}

export const MainMenu = ({ onCreate, onJoin, error }: MainMenuProps) => {
    const [mode, setMode] = useState<'menu' | 'join'>('menu')
    const [roomCode, setRoomCode] = useState('')

    const handleJoinSubmit = (event: FormEvent) => {
        event.preventDefault()
        if (roomCode.trim()) onJoin(roomCode.trim())
    }

    return (
        <div className='flex flex-col items-center gap-6'>
            <h1 className='text-2xl font-semibold'>Rock Paper Scissors Chess</h1>

            {mode === 'menu' && (
                <div className='flex gap-4'>
                    <button
                        type='button'
                        onClick={onCreate}
                        className='rounded bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700'
                    >
                        Create
                    </button>
                    <button
                        type='button'
                        onClick={() => setMode('join')}
                        className='rounded border border-black/10 px-6 py-3 font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
                    >
                        Join
                    </button>
                </div>
            )}

            {mode === 'join' && (
                <form onSubmit={handleJoinSubmit} className='flex flex-col items-center gap-3'>
                    <input
                        autoFocus
                        value={roomCode}
                        onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                        placeholder='Room code'
                        maxLength={6}
                        className='w-40 rounded border border-black/10 px-3 py-2 text-center text-lg uppercase tracking-widest dark:border-white/10 dark:bg-transparent'
                    />
                    <div className='flex gap-3'>
                        <button
                            type='submit'
                            disabled={!roomCode.trim()}
                            className='rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                        >
                            Join room
                        </button>
                        <button
                            type='button'
                            onClick={() => setMode('menu')}
                            className='rounded border border-black/10 px-4 py-2 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
                        >
                            Back
                        </button>
                    </div>
                </form>
            )}

            {error && <div className='max-w-sm text-center text-sm text-red-600'>{error}</div>}
        </div>
    )
}
