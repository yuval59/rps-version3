import type { Position } from './Player'

export type BoardProps = {
    /** Number of squares per side (n x n grid). */
    size: number
    /** Pixel size of each square. */
    squareSize?: number
    /** Tailwind class(es) for "light" squares. */
    lightClassName?: string
    /** Tailwind class(es) for "dark" squares. */
    darkClassName?: string
    /** Extra class names applied to the board container. */
    className?: string
    /** Called when a square is clicked, with its zero-indexed row/col. */
    onSquareClick?: (position: Position) => void
    /** Squares to visually mark as legal move destinations (onto empty squares). */
    highlightedSquares?: Position[]
    /** Squares to visually mark as legal capture destinations (an opponent's piece is there). */
    captureSquares?: Position[]
    /** Square to visually mark as the current selection. */
    selectedSquare?: Position | null
}

const isSamePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col

export const Board = ({
    size,
    squareSize = 48,
    lightClassName = 'bg-amber-100',
    darkClassName = 'bg-amber-800',
    className = '',
    onSquareClick,
    highlightedSquares = [],
    captureSquares = [],
    selectedSquare = null,
}: BoardProps) => {
    const n = Math.max(1, Math.floor(size))
    const squares = Array.from({ length: n * n })

    return (
        <div
            className={`inline-grid border border-black/10 dark:border-white/10 ${className}`}
            style={{
                gridTemplateColumns: `repeat(${n}, ${squareSize}px)`,
                gridTemplateRows: `repeat(${n}, ${squareSize}px)`,
            }}
            role='grid'
            aria-rowcount={n}
            aria-colcount={n}
        >
            {squares.map((_, index) => {
                const row = Math.floor(index / n)
                const col = index % n
                const isLight = (row + col) % 2 === 0
                const isHighlighted = highlightedSquares.some((pos) => isSamePosition(pos, { row, col }))
                const isCapture = captureSquares.some((pos) => isSamePosition(pos, { row, col }))
                const isSelected = selectedSquare != null && isSamePosition(selectedSquare, { row, col })

                return (
                    <div
                        key={index}
                        role='gridcell'
                        aria-rowindex={row + 1}
                        aria-colindex={col + 1}
                        onClick={onSquareClick ? () => onSquareClick({ row, col }) : undefined}
                        className={[
                            isLight ? lightClassName : darkClassName,
                            onSquareClick ? 'cursor-pointer' : '',
                            isSelected ? 'ring-4 ring-inset ring-yellow-400' : '',
                            isCapture ? 'ring-4 ring-inset ring-red-500' : isHighlighted ? 'ring-4 ring-inset ring-green-400' : '',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                    />
                )
            })}
        </div>
    )
}
