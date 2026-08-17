export type PlayerType = 'rock' | 'paper' | 'scissors'

export type Team = 'blue' | 'red'

export type Position = {
    row: number
    col: number
}

export type PlayerProps = {
    /** Which piece this player is. */
    type: PlayerType
    /** Which team this player belongs to. Used to tint the icon. */
    team: Team
    /** Zero-indexed row/col of the piece. Assumed to be within the board. */
    position: Position
    /** Number of squares per side of the board (n x n), used to scale the position. */
    boardSize: number
    /** Extra class names applied to the piece container. */
    className?: string
}

const PLAYER_ICON_SRC: Record<PlayerType, string> = {
    rock: '/Rock.png',
    paper: '/Paper.png',
    scissors: '/Scissors.png',
}

const TEAM_COLOR: Record<Team, string> = {
    blue: '#2563eb',
    red: '#dc2626',
}

export const Player = ({ type, team, position, boardSize, className = '' }: PlayerProps) => {
    const n = Math.max(1, Math.floor(boardSize))
    const { row, col } = position
    const iconSrc = PLAYER_ICON_SRC[type]

    return (
        <div
            className={`absolute p-1 select-none pointer-events-none ${className}`}
            style={{
                left: `${(col / n) * 100}%`,
                top: `${(row / n) * 100}%`,
                width: `${100 / n}%`,
                height: `${100 / n}%`,
            }}
            role='img'
            aria-label={`${team} ${type}`}
        >
            <div
                className='h-full w-full'
                style={{
                    backgroundColor: TEAM_COLOR[team],
                    maskImage: `url(${iconSrc})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskImage: `url(${iconSrc})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                }}
            />
        </div>
    )
}
