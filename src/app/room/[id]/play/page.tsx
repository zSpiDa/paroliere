'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  drawTiles, calculateWordScore, getWordsFromPlacement,
  isValidPlacement, validateItalianWord
} from '@/lib/game'
import { Tile, BoardCell, Player, Room, GameState, PlacedTile, WordPlayed } from '@/types'

const PREMIUM_COLORS: Record<string, { bg: string; label: string; text: string }> = {
  TW: { bg: '#dc2626', label: 'TW', text: '#fff' },
  DW: { bg: '#f97316', label: 'DW', text: '#fff' },
  TL: { bg: '#2563eb', label: 'TL', text: '#fff' },
  DL: { bg: '#60a5fa', label: 'DL', text: '#fff' },
}

const PLAYER_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444']

export default function PlayPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.id as string

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myPlayerId, setMyPlayerId] = useState('')
  const [board, setBoard] = useState<Record<string, BoardCell>>({})
  const [myRack, setMyRack] = useState<Tile[]>([])
  const [placedTiles, setPlacedTiles] = useState<PlacedTile[]>([])
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [validating, setValidating] = useState(false)
  const [message, setMessage] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const showMessage = (msg: string, duration = 3000) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), duration)
  }

  const loadData = useCallback(async () => {
    const [{ data: roomData }, { data: playersData }, { data: gsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('players').select('*').eq('room_id', roomId),
      supabase.from('game_state').select('*').eq('room_id', roomId).single(),
    ])
    if (roomData) setRoom(roomData)
    if (playersData) setPlayers(playersData)
    if (gsData) {
      setGameState(gsData)
      setBoard(gsData.board)
      const pid = localStorage.getItem('paroliere_player_id') || ''
      const me = playersData?.find(p => p.player_id === pid)
      if (me) setMyRack(me.rack || [])
    }
  }, [roomId])

  useEffect(() => {
    const pid = localStorage.getItem('paroliere_player_id') || ''
    setMyPlayerId(pid)
    loadData()

    const sub = supabase
      .channel(`play-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` }, payload => {
        const gs = payload.new as GameState
        setGameState(gs)
        setBoard(gs.board)
        setPlacedTiles([])
        setSelectedTile(null)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, payload => {
        const updatedPlayer = payload.new as Player
        setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p))
        if (updatedPlayer.player_id === pid) {
          setMyRack(updatedPlayer.rack || [])
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        const r = payload.new as Room
        setRoom(r)
        if (r.status === 'finished') setGameOver(true)
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [roomId, loadData])

  // Timer
  useEffect(() => {
    if (!room || !gameState) return
    setTimeLeft(room.turn_timer)
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          // Auto-handle timeout
          if (room.timeout_action === 'skip' && gameState.current_turn === myPlayerId) {
            handleSkipTurn()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [gameState?.current_turn, roomId])

  const isMyTurn = gameState?.current_turn === myPlayerId

  function handleRackTileClick(tile: Tile) {
    if (!isMyTurn) return
    setSelectedTile(selectedTile?.id === tile.id ? null : tile)
  }

  function handleBoardCellClick(row: number, col: number) {
    if (!isMyTurn) return
    const key = `${row},${col}`
    const cell = board[key]

    // If clicking already-placed tile, return it to rack
    const alreadyPlaced = placedTiles.find(p => p.row === row && p.col === col)
    if (alreadyPlaced) {
      setPlacedTiles(prev => prev.filter(p => !(p.row === row && p.col === col)))
      setMyRack(prev => [...prev, alreadyPlaced.tile])
      setBoard(prev => ({ ...prev, [key]: { ...prev[key], tile: null } }))
      return
    }

    // Place selected tile
    if (selectedTile && !cell?.tile) {
      const placed: PlacedTile = { tile: selectedTile, row, col }
      setPlacedTiles(prev => [...prev, placed])
      setBoard(prev => ({ ...prev, [key]: { ...prev[key], tile: selectedTile } }))
      setMyRack(prev => prev.filter(t => t.id !== selectedTile.id))
      setSelectedTile(null)
    }
  }

  function recallTiles() {
    const returned = placedTiles.map(p => p.tile)
    setMyRack(prev => [...prev, ...returned])
    const newBoard = { ...board }
    for (const { row, col } of placedTiles) {
      newBoard[`${row},${col}`] = { ...newBoard[`${row},${col}`], tile: null }
    }
    setBoard(newBoard)
    setPlacedTiles([])
    setSelectedTile(null)
  }

  async function handleSkipTurn() {
    if (!gameState || !room) return
    const currentIndex = players.findIndex(p => p.player_id === gameState.current_turn)
    const nextIndex = (currentIndex + 1) % players.length
    const nextPlayer = players[nextIndex]

    await supabase.from('game_state').update({
      current_turn: nextPlayer.player_id,
      turn_number: gameState.turn_number + 1,
      updated_at: new Date().toISOString(),
    }).eq('room_id', roomId)

    showMessage('Turno saltato')
  }

  async function submitMove() {
    if (!gameState || !room || !isMyTurn || placedTiles.length === 0) return

    setValidating(true)

    try {
      const isFirstMove = gameState.turn_number === 0
      const validation = isValidPlacement(placedTiles, gameState.board, isFirstMove)

      if (!validation.valid) {
        showMessage(`❌ ${validation.error}`)
        setValidating(false)
        return
      }

      // Get all words formed
      const words = getWordsFromPlacement(placedTiles, gameState.board)
      if (words.length === 0) {
        showMessage('❌ Nessuna parola formata')
        setValidating(false)
        return
      }

      // Validate each word in Italian
      const wordStrings = words.map(w => w.map(p => p.tile.letter === '_' ? '?' : p.tile.letter).join(''))
      let totalScore = 0
      const invalidWords: string[] = []

      for (let i = 0; i < words.length; i++) {
        const wordStr = wordStrings[i]
        const valid = await validateItalianWord(wordStr)
        if (!valid) {
          invalidWords.push(wordStr)
        } else {
          totalScore += calculateWordScore(words[i], gameState.board)
        }
      }

      if (invalidWords.length > 0) {
        showMessage(`❌ Parole non valide: ${invalidWords.join(', ')}`)
        setValidating(false)
        return
      }

      // Bingo bonus: using all 7 tiles
      if (placedTiles.length === 7) totalScore += 50

      // Update board
      const newBoard = { ...gameState.board }
      for (const { tile, row, col } of placedTiles) {
        newBoard[`${row},${col}`] = { ...newBoard[`${row},${col}`], tile }
      }

      // Draw new tiles
      const me = players.find(p => p.player_id === myPlayerId)!
      let bag = gameState.tile_bag
      let newRack = myRack
      if (bag.length > 0) {
        const { drawn, remaining } = drawTiles(bag, placedTiles.length)
        newRack = [...myRack, ...drawn]
        bag = remaining
      }

      // Check if game ends (empty rack and bag)
      const gameEnds = newRack.length === 0 && bag.length === 0

      // Next turn
      const currentIndex = players.findIndex(p => p.player_id === myPlayerId)
      const nextIndex = (currentIndex + 1) % players.length
      const nextPlayer = players[nextIndex]

      // Update player score
      const newScore = (me.score || 0) + totalScore
      await supabase.from('players').update({ score: newScore, rack: newRack }).eq('id', me.id)

      // Record move
      const newWordsPlayed: WordPlayed[] = [
        ...(gameState.words_played || []),
        ...wordStrings.map(w => ({ word: w, score: totalScore, player_nickname: me.nickname, player_id: myPlayerId }))
      ]

      // Update game state
      await supabase.from('game_state').update({
        board: newBoard,
        tile_bag: bag,
        current_turn: nextPlayer.player_id,
        turn_number: gameState.turn_number + 1,
        words_played: newWordsPlayed,
        updated_at: new Date().toISOString(),
      }).eq('room_id', roomId)

      if (gameEnds) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
      }

      showMessage(`✅ +${totalScore} punti! ${wordStrings.join(', ')}`)
      setPlacedTiles([])
    } catch (e) {
      console.error(e)
      showMessage('Errore durante la validazione')
    } finally {
      setValidating(false)
    }
  }

  const currentPlayer = players.find(p => p.player_id === gameState?.current_turn)
  const me = players.find(p => p.player_id === myPlayerId)
  const timerPct = room ? (timeLeft / room.turn_timer) * 100 : 100
  const timerColor = timeLeft > 20 ? '#10b981' : timeLeft > 10 ? '#f59e0b' : '#ef4444'

  if (!gameState || !room) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-amber-400 text-xl animate-pulse">Caricamento partita...</div>
      </div>
    )
  }

  if (gameOver) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
    return (
      <div className="min-h-screen bg-[#1a1a2e] text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-3xl font-bold text-amber-400">Fine Partita!</h1>
          </div>
          <div className="space-y-3 mb-8">
            {sortedPlayers.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-4 p-4 rounded-xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500' : 'bg-white/5'}`}>
                <div className="text-2xl">{['🥇', '🥈', '🥉', '4️⃣'][i]}</div>
                <div className="flex-1">
                  <p className="font-bold">{p.nickname}</p>
                </div>
                <p className="text-amber-400 font-bold text-xl">{p.score} pt</p>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/')} className="w-full py-4 bg-amber-500 text-[#1a1a2e] font-bold rounded-xl text-lg">
            Torna alla Lobby
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f1e] text-white flex flex-col" style={{ fontFamily: "'Georgia', serif" }}>
      {/* Top bar */}
      <div className="border-b border-white/10 px-4 py-2 flex items-center justify-between bg-[#1a1a2e]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-500 rounded flex items-center justify-center text-xs font-bold text-[#1a1a2e]">P</div>
          <span className="text-amber-400 font-bold text-sm">PAROLIERE</span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-3">
          <div className="text-sm text-white/60">
            {currentPlayer ? (isMyTurn ? '🟢 Il tuo turno!' : `⏳ ${currentPlayer.nickname}`) : ''}
          </div>
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none" stroke={timerColor} strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - timerPct / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: timerColor }}>
              {timeLeft}
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="flex gap-3">
          {players.map((p, i) => (
            <div key={p.id} className={`text-center px-2 py-1 rounded-lg ${p.player_id === gameState.current_turn ? 'bg-white/10' : ''}`}>
              <p className="text-xs font-bold" style={{ color: PLAYER_COLORS[i % 4] }}>{p.nickname.substring(0, 8)}</p>
              <p className="text-sm font-bold text-white">{p.score}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e] border border-amber-500/50 text-amber-400 px-6 py-3 rounded-xl shadow-lg text-sm font-medium">
          {message}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Board */}
        <div className="flex-1 flex items-center justify-center p-2 overflow-auto">
          <div className="inline-block">
            {/* Column headers */}
            <div className="flex mb-0.5 ml-5">
              {Array.from({ length: 15 }, (_, i) => (
                <div key={i} className="w-7 h-4 flex items-center justify-center text-[8px] text-white/20 font-mono">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            {Array.from({ length: 15 }, (_, row) => (
              <div key={row} className="flex">
                <div className="w-5 flex items-center justify-center text-[8px] text-white/20 font-mono">{row + 1}</div>
                {Array.from({ length: 15 }, (_, col) => {
                  const key = `${row},${col}`
                  const cell = board[key]
                  const isPlaced = placedTiles.some(p => p.row === row && p.col === col)
                  const premium = cell?.premium
                  const tile = cell?.tile

                  let bg = '#1e1e3a'
                  if (premium) bg = PREMIUM_COLORS[premium].bg + '33'
                  if (cell?.isCenter && !tile) bg = '#f59e0b33'

                  return (
                    <div
                      key={col}
                      onClick={() => handleBoardCellClick(row, col)}
                      className={`w-7 h-7 border flex items-center justify-center cursor-pointer transition-all relative
                        ${tile ? '' : 'hover:bg-white/10'}
                        ${isPlaced ? 'border-amber-400' : 'border-white/10'}
                        ${isMyTurn && selectedTile && !tile ? 'cursor-crosshair' : ''}
                      `}
                      style={{ background: tile ? (isPlaced ? '#92400e' : '#374151') : bg }}
                    >
                      {tile ? (
                        <div className="w-full h-full flex flex-col items-center justify-center relative">
                          <span className="text-[11px] font-bold text-white leading-none">{tile.letter === '_' ? '' : tile.letter}</span>
                          <span className="text-[6px] text-white/60 absolute bottom-0 right-0.5">{tile.points > 0 ? tile.points : ''}</span>
                        </div>
                      ) : (
                        premium ? (
                          <span className="text-[7px] font-bold" style={{ color: PREMIUM_COLORS[premium].text + 'cc' }}>
                            {PREMIUM_COLORS[premium].label}
                          </span>
                        ) : cell?.isCenter ? (
                          <span className="text-[10px]">★</span>
                        ) : null
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-56 bg-[#1a1a2e] border-l border-white/10 flex flex-col p-3 gap-3 overflow-y-auto">
          {/* My Rack */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Le tue tessere</p>
            <div className="flex flex-wrap gap-1.5 p-2 bg-white/5 rounded-xl min-h-[60px]">
              {myRack.map(tile => (
                <button
                  key={tile.id}
                  onClick={() => handleRackTileClick(tile)}
                  disabled={!isMyTurn}
                  className={`w-9 h-9 rounded flex flex-col items-center justify-center relative transition-all
                    ${selectedTile?.id === tile.id ? 'ring-2 ring-amber-400 bg-amber-900 scale-110' : 'bg-amber-700 hover:bg-amber-600'}
                    ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <span className="text-xs font-bold text-white">{tile.letter === '_' ? '?' : tile.letter}</span>
                  <span className="text-[7px] text-amber-200 absolute bottom-0.5 right-0.5">{tile.points}</span>
                </button>
              ))}
              {myRack.length === 0 && <p className="text-white/20 text-xs w-full text-center py-2">Nessuna tessera</p>}
            </div>
          </div>

          {/* Action buttons */}
          {isMyTurn && (
            <div className="space-y-2">
              <button
                onClick={submitMove}
                disabled={placedTiles.length === 0 || validating}
                className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-40"
              >
                {validating ? 'Validazione...' : `✓ Conferma (${placedTiles.length})`}
              </button>
              <button
                onClick={recallTiles}
                disabled={placedTiles.length === 0}
                className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-all disabled:opacity-40"
              >
                ↩ Ritira tessere
              </button>
              <button
                onClick={handleSkipTurn}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs transition-all"
              >
                Salta turno
              </button>
            </div>
          )}

          {/* Bag count */}
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-xs text-white/40">Tessere nel sacchetto</p>
            <p className="text-xl font-bold text-amber-400">{gameState.tile_bag?.length || 0}</p>
          </div>

          {/* Words played */}
          <div className="flex-1">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Parole giocate</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...(gameState.words_played || [])].reverse().map((w, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400 font-bold text-sm">{w.word}</span>
                    <span className="text-green-400 text-xs">+{w.score}</span>
                  </div>
                  <p className="text-white/30 text-xs">{w.player_nickname}</p>
                </div>
              ))}
              {(!gameState.words_played || gameState.words_played.length === 0) && (
                <p className="text-white/20 text-xs text-center py-4">Nessuna parola ancora</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
