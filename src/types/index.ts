export interface Tile {
  letter: string
  points: number
  id: string
  isBlank?: boolean
}

export interface BoardCell {
  tile: Tile | null
  premium: 'TW' | 'DW' | 'TL' | 'DL' | null
  isCenter: boolean
  justPlaced?: boolean
}

export interface Player {
  id: string
  player_id: string
  nickname: string
  score: number
  rack: Tile[]
  is_host: boolean
  is_connected: boolean
  room_id: string
}

export interface Room {
  id: string
  code: string
  host_id: string
  status: 'waiting' | 'playing' | 'finished'
  is_public: boolean
  max_players: number
  turn_timer: number
  timeout_action: 'skip' | 'nothing'
}

export interface GameState {
  id: string
  room_id: string
  board: Record<string, BoardCell>
  tile_bag: Tile[]
  current_turn: string
  turn_number: number
  words_played: WordPlayed[]
}

export interface WordPlayed {
  word: string
  score: number
  player_nickname: string
  player_id: string
}

export interface Move {
  id: string
  room_id: string
  player_id: string
  player_nickname: string
  word: string
  score: number
  tiles_placed: PlacedTile[]
}

export interface PlacedTile {
  tile: Tile
  row: number
  col: number
}

export type Direction = 'horizontal' | 'vertical'
