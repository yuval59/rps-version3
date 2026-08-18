export type PlayerType = 'rock' | 'paper' | 'scissors'
export type Team = 'blue' | 'red'

export type Position = {
    row: number
    col: number
}

export const BOARD_SIZE = 9

export type Piece = {
    id: string
    type: PlayerType
    team: Team
    position: Position
}

export type GameState = {
    boardSize: number
    pieces: Piece[]
    turn: Team
    winner: Team | null
}

/** Row on which each team starts, and the opposing "goal" row that wins the game for them. */
export const getHomeRow = (team: Team, boardSize: number) => (team === 'blue' ? 0 : boardSize - 1)
export const getGoalRow = (team: Team, boardSize: number) => (team === 'blue' ? boardSize - 1 : 0)

/**
 * Piece types for each of the first three rows from a team's home row, going inward.
 * Blue starts with scissors on row 0, paper on row 1, rock on row 2; red mirrors this
 * from its own home row inward (scissors, paper, rock going toward the middle).
 */
const ROW_TYPES: PlayerType[] = ['scissors', 'paper', 'rock']
const PIECES_PER_ROW = 3

export const createInitialPieces = (boardSize: number): Piece[] => {
    const pieces: Piece[] = []
    const middleStart = Math.floor((boardSize - PIECES_PER_ROW) / 2)

    ;(['blue', 'red'] as Team[]).forEach((team) => {
        const homeRow = getHomeRow(team, boardSize)
        const rowDirection = team === 'blue' ? 1 : -1

        ROW_TYPES.forEach((type, rowOffset) => {
            const row = homeRow + rowOffset * rowDirection
            for (let index = 0; index < PIECES_PER_ROW; index++) {
                pieces.push({
                    id: `${team}-${type}-${index}`,
                    type,
                    team,
                    position: { row, col: middleStart + index },
                })
            }
        })
    })

    return pieces
}

export const createInitialGameState = (boardSize: number = BOARD_SIZE): GameState => ({
    boardSize,
    pieces: createInitialPieces(boardSize),
    turn: 'blue',
    winner: null,
})

export const isSamePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col

export const getPieceAt = (pieces: Piece[], position: Position) =>
    pieces.find((piece) => isSamePosition(piece.position, position))

export const isWithinBoard = (position: Position, boardSize: number) =>
    position.row >= 0 && position.row < boardSize && position.col >= 0 && position.col < boardSize

/** A king move: exactly one square in any of the 8 directions. */
export const isKingMove = (from: Position, to: Position) => {
    const dRow = Math.abs(to.row - from.row)
    const dCol = Math.abs(to.col - from.col)
    return dRow <= 1 && dCol <= 1 && (dRow !== 0 || dCol !== 0)
}

/**
 * Legal destinations for a piece: one square in any direction, on the board, and either
 * unoccupied or occupied by an opponent's piece this one can capture.
 */
export const getLegalMoves = (piece: Piece, pieces: Piece[], boardSize: number): Position[] => {
    const moves: Position[] = []

    for (let dRow = -1; dRow <= 1; dRow++) {
        for (let dCol = -1; dCol <= 1; dCol++) {
            if (dRow === 0 && dCol === 0) continue

            const candidate: Position = { row: piece.position.row + dRow, col: piece.position.col + dCol }
            if (!isWithinBoard(candidate, boardSize)) continue

            const occupant = getPieceAt(pieces, candidate)
            if (occupant && (occupant.team === piece.team || !beats(piece.type, occupant.type))) continue

            moves.push(candidate)
        }
    }

    return moves
}

/** A team wins immediately when one of its pieces reaches the opposing team's home row. */
export const checkWinner = (piece: Piece, boardSize: number): Team | null =>
    piece.position.row === getGoalRow(piece.team, boardSize) ? piece.team : null

export const otherTeam = (team: Team): Team => (team === 'blue' ? 'red' : 'blue')

/** Rock crushes scissors, scissors cut paper, paper covers rock. */
const BEATS: Record<PlayerType, PlayerType> = {
    rock: 'scissors',
    scissors: 'paper',
    paper: 'rock',
}

/** Whether a piece of `attacker` type can capture a piece of `defender` type. */
export const beats = (attacker: PlayerType, defender: PlayerType) => BEATS[attacker] === defender

/** A team wins if it has at least one piece left and the opposing team has none. */
export const checkElimination = (pieces: Piece[]): Team | null => {
    const blueAlive = pieces.some((p) => p.team === 'blue')
    const redAlive = pieces.some((p) => p.team === 'red')
    if (!blueAlive && redAlive) return 'red'
    if (!redAlive && blueAlive) return 'blue'
    return null
}

/**
 * Attempts to move the selected piece to the target position.
 * Returns the resulting state unchanged if the move is illegal. This is the single
 * source of truth for move legality: the server calls this to authoritatively
 * validate and apply every move. A move onto a square occupied by an opponent's piece
 * is only legal if this piece's type beats it (rock beats scissors, scissors beats
 * paper, paper beats rock); the defending piece is captured.
 */
export const applyMove = (state: GameState, pieceId: string, to: Position): GameState => {
    if (state.winner) return state

    const piece = state.pieces.find((p) => p.id === pieceId)
    if (!piece || piece.team !== state.turn) return state

    const legalMoves = getLegalMoves(piece, state.pieces, state.boardSize)
    if (!legalMoves.some((move) => isSamePosition(move, to))) return state

    const captured = getPieceAt(state.pieces, to)
    const movedPiece: Piece = { ...piece, position: to }
    const pieces = state.pieces
        .filter((p) => p.id !== captured?.id)
        .map((p) => (p.id === pieceId ? movedPiece : p))
    const winner = checkWinner(movedPiece, state.boardSize) ?? checkElimination(pieces)

    return {
        ...state,
        pieces,
        winner,
        turn: winner ? state.turn : otherTeam(state.turn),
    }
}
