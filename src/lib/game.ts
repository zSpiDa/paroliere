import { Tile, BoardCell, PlacedTile } from '@/types'
import { v4 as uuidv4 } from 'uuid'

// Italian Scrabble (Scarabeo) official letter distribution
export const ITALIAN_TILES: { letter: string; points: number; count: number }[] = [
  { letter: 'A', points: 1, count: 14 },
  { letter: 'B', points: 5, count: 3 },
  { letter: 'C', points: 2, count: 6 },
  { letter: 'D', points: 5, count: 3 },
  { letter: 'E', points: 1, count: 11 },
  { letter: 'F', points: 5, count: 3 },
  { letter: 'G', points: 8, count: 2 },
  { letter: 'H', points: 8, count: 2 },
  { letter: 'I', points: 1, count: 12 },
  { letter: 'L', points: 2, count: 5 },
  { letter: 'M', points: 3, count: 5 },
  { letter: 'N', points: 2, count: 7 },
  { letter: 'O', points: 1, count: 15 },
  { letter: 'P', points: 3, count: 4 },
  { letter: 'Q', points: 10, count: 1 },
  { letter: 'R', points: 2, count: 6 },
  { letter: 'S', points: 2, count: 6 },
  { letter: 'T', points: 2, count: 6 },
  { letter: 'U', points: 3, count: 6 },
  { letter: 'V', points: 5, count: 3 },
  { letter: 'Z', points: 10, count: 2 },
  { letter: '_', points: 0, count: 2 }, // blank tiles
]

// Premium squares layout for 15x15 board
const PREMIUM: Record<string, 'TW' | 'DW' | 'TL' | 'DL'> = {
  // Triple Word
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW',
  '7,0': 'TW', '7,14': 'TW',
  '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  // Double Word
  '1,1': 'DW', '2,2': 'DW', '3,3': 'DW', '4,4': 'DW',
  '1,13': 'DW', '2,12': 'DW', '3,11': 'DW', '4,10': 'DW',
  '10,4': 'DW', '11,3': 'DW', '12,2': 'DW', '13,1': 'DW',
  '10,10': 'DW', '11,11': 'DW', '12,12': 'DW', '13,13': 'DW',
  // Triple Letter
  '1,5': 'TL', '1,9': 'TL',
  '5,1': 'TL', '5,5': 'TL', '5,9': 'TL', '5,13': 'TL',
  '9,1': 'TL', '9,5': 'TL', '9,9': 'TL', '9,13': 'TL',
  '13,5': 'TL', '13,9': 'TL',
  // Double Letter
  '0,3': 'DL', '0,11': 'DL',
  '2,6': 'DL', '2,8': 'DL',
  '3,0': 'DL', '3,7': 'DL', '3,14': 'DL',
  '6,2': 'DL', '6,6': 'DL', '6,8': 'DL', '6,12': 'DL',
  '7,3': 'DL', '7,11': 'DL',
  '8,2': 'DL', '8,6': 'DL', '8,8': 'DL', '8,12': 'DL',
  '11,0': 'DL', '11,7': 'DL', '11,14': 'DL',
  '12,6': 'DL', '12,8': 'DL',
  '14,3': 'DL', '14,11': 'DL',
}

export function createTileBag(): Tile[] {
  const bag: Tile[] = []
  for (const { letter, points, count } of ITALIAN_TILES) {
    for (let i = 0; i < count; i++) {
      bag.push({ letter, points, id: uuidv4() })
    }
  }
  return shuffleBag(bag)
}

export function shuffleBag(bag: Tile[]): Tile[] {
  const arr = [...bag]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function drawTiles(bag: Tile[], count: number): { drawn: Tile[]; remaining: Tile[] } {
  const remaining = [...bag]
  const drawn = remaining.splice(0, count)
  return { drawn, remaining }
}

export function createEmptyBoard(): Record<string, BoardCell> {
  const board: Record<string, BoardCell> = {}
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const key = `${row},${col}`
      board[key] = {
        tile: null,
        premium: PREMIUM[key] || null,
        isCenter: row === 7 && col === 7,
      }
    }
  }
  return board
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function calculateWordScore(
  word: PlacedTile[],
  board: Record<string, BoardCell>
): number {
  let wordScore = 0
  let wordMultiplier = 1

  for (const { tile, row, col } of word) {
    const key = `${row},${col}`
    const cell = board[key]
    let letterScore = tile.isBlank ? 0 : tile.points

    if (cell && !cell.tile) {
      // Premium only counts for newly placed tiles
      if (cell.premium === 'TL') letterScore *= 3
      if (cell.premium === 'DL') letterScore *= 2
      if (cell.premium === 'TW') wordMultiplier *= 3
      if (cell.premium === 'DW' || cell.isCenter) wordMultiplier *= 2
    }

    wordScore += letterScore
  }

  return wordScore * wordMultiplier
}

// Validate word using free Italian dictionary API
export async function validateItalianWord(word: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/it/${word.toLowerCase()}`
    )
    if (response.ok) return true

    // Fallback: basic common Italian words list for offline play
    const commonWords = new Set([
      'CIAO', 'CASA', 'MARE', 'SOLE', 'LUNA', 'ARIA', 'VINO', 'PANE',
      'MANO', 'VITA', 'ANNO', 'COSA', 'MODO', 'UOMO', 'DONNA', 'TEMPO',
      'BELLO', 'GRANDE', 'PRIMO', 'ALTRI', 'TUTTO', 'COME', 'DICE', 'FARE',
      'BENE', 'MALE', 'SERA', 'NOTTE', 'GIORNO', 'PORTA', 'LUCE', 'CUORE',
    ])
    return commonWords.has(word.toUpperCase())
  } catch {
    return true // Allow play offline
  }
}

export function getWordsFromPlacement(
  placedTiles: PlacedTile[],
  board: Record<string, BoardCell>
): PlacedTile[][] {
  if (placedTiles.length === 0) return []

  // Determine if placement is horizontal or vertical
  const rows = placedTiles.map(p => p.row)
  const cols = placedTiles.map(p => p.col)
  const isHorizontal = rows.every(r => r === rows[0])

  const allWords: PlacedTile[][] = []

  // Merge placed tiles with board
  const tempBoard = { ...board }
  for (const pt of placedTiles) {
    tempBoard[`${pt.row},${pt.col}`] = {
      ...tempBoard[`${pt.row},${pt.col}`],
      tile: pt.tile,
    }
  }

  // Get the main word
  const mainWord = getWordInDirection(placedTiles[0], tempBoard, isHorizontal, placedTiles)
  if (mainWord.length > 1) allWords.push(mainWord)

  // Get cross words
  for (const pt of placedTiles) {
    const crossWord = getWordInDirection(pt, tempBoard, !isHorizontal, placedTiles)
    if (crossWord.length > 1) allWords.push(crossWord)
  }

  return allWords
}

function getWordInDirection(
  startTile: PlacedTile,
  board: Record<string, BoardCell>,
  horizontal: boolean,
  newTiles: PlacedTile[]
): PlacedTile[] {
  const word: PlacedTile[] = []
  const { row, col } = startTile

  // Go backwards to find start
  let startRow = row
  let startCol = col
  while (true) {
    const prevRow = startRow - (horizontal ? 0 : 1)
    const prevCol = startCol - (horizontal ? 1 : 0)
    if (prevRow < 0 || prevCol < 0) break
    const key = `${prevRow},${prevCol}`
    if (!board[key]?.tile) break
    startRow = prevRow
    startCol = prevCol
  }

  // Collect tiles forward
  let r = startRow
  let c = startCol
  while (r < 15 && c < 15) {
    const key = `${r},${c}`
    const cell = board[key]
    if (!cell?.tile) break
    const existing = newTiles.find(t => t.row === r && t.col === c)
    word.push(existing || { tile: cell.tile!, row: r, col: c })
    if (horizontal) c++
    else r++
  }

  return word
}

export function isValidPlacement(
  placedTiles: PlacedTile[],
  board: Record<string, BoardCell>,
  isFirstMove: boolean
): { valid: boolean; error?: string } {
  if (placedTiles.length === 0) return { valid: false, error: 'Nessuna tessera piazzata' }

  const rows = placedTiles.map(p => p.row)
  const cols = placedTiles.map(p => p.col)

  const allSameRow = rows.every(r => r === rows[0])
  const allSameCol = cols.every(c => c === cols[0])

  if (!allSameRow && !allSameCol) {
    return { valid: false, error: 'Le tessere devono essere in linea retta' }
  }

  // Check first move covers center (7,7)
  if (isFirstMove) {
    const coversCenter = placedTiles.some(p => p.row === 7 && p.col === 7)
    if (!coversCenter) {
      return { valid: false, error: 'La prima mossa deve coprire la casella centrale' }
    }
    if (placedTiles.length < 2) {
      return { valid: false, error: 'La prima mossa deve avere almeno 2 lettere' }
    }
  }

  // Check adjacency with existing tiles (after first move)
  if (!isFirstMove) {
    const hasAdjacent = placedTiles.some(({ row, col }) => {
      const neighbors = [
        `${row - 1},${col}`, `${row + 1},${col}`,
        `${row},${col - 1}`, `${row},${col + 1}`,
      ]
      return neighbors.some(k => board[k]?.tile !== null)
    })
    if (!hasAdjacent) {
      return { valid: false, error: 'Le tessere devono essere adiacenti a quelle esistenti' }
    }
  }

  return { valid: true }
}
