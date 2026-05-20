'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createTileBag, createEmptyBoard, drawTiles } from '@/lib/game'
import { Room, Player } from '@/types'

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.id as string

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [myPlayerId, setMyPlayerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    if (data) {
      setRoom(data)
      if (data.status === 'playing') {
        router.push(`/room/${roomId}/play`)
      }
    }
  }, [roomId, router])

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('players').select('*').eq('room_id', roomId)
    if (data) setPlayers(data)
  }, [roomId])

  useEffect(() => {
    const playerId = localStorage.getItem('paroliere_player_id') || ''
    setMyPlayerId(playerId)

    loadRoom()
    loadPlayers()
    setLoading(false)

    // Subscribe to room changes
    const roomSub = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        const updated = payload.new as Room
        setRoom(updated)
        if (updated.status === 'playing') {
          router.push(`/room/${roomId}/play`)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => {
        loadPlayers()
      })
      .subscribe()

    return () => { supabase.removeChannel(roomSub) }
  }, [roomId, loadRoom, loadPlayers, router])

  async function startGame() {
    if (!room || players.length < 2) return
    setStarting(true)

    try {
      let bag = createTileBag()
      const board = createEmptyBoard()

      // Deal 7 tiles to each player
      const updatedPlayers = []
      for (const player of players) {
        const { drawn, remaining } = drawTiles(bag, 7)
        bag = remaining
        updatedPlayers.push({ ...player, rack: drawn })
      }

      // Update each player's rack
      for (const player of updatedPlayers) {
        await supabase
          .from('players')
          .update({ rack: player.rack })
          .eq('id', player.id)
      }

      // Create game state
      await supabase.from('game_state').insert({
        room_id: roomId,
        board,
        tile_bag: bag,
        current_turn: players[0].player_id,
        turn_number: 0,
        words_played: [],
      })

      // Update room status to playing
      await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId)
    } catch (e) {
      console.error(e)
    } finally {
      setStarting(false)
    }
  }

  function copyCode() {
    if (!room) return
    navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isHost = players.find(p => p.player_id === myPlayerId)?.is_host
  const canStart = players.length >= 2 && isHost

  if (loading || !room) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-amber-400 text-xl animate-pulse">Caricamento...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#1a1a2e] text-white" style={{ fontFamily: "'Georgia', serif" }}>
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-white/40 hover:text-white transition-colors text-sm">← Esci</button>
          <div className="w-px h-5 bg-white/20" />
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-sm font-bold text-[#1a1a2e]">P</div>
          <span className="text-amber-400 font-bold tracking-wide">PAROLIERE</span>
        </div>
        <div className="text-white/40 text-sm">Sala d&apos;Attesa</div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-12">
        {/* Room code */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6 text-center">
          <p className="text-white/40 text-sm mb-2 tracking-wider uppercase text-xs">Codice Stanza</p>
          <div className="text-5xl font-mono font-bold text-amber-400 tracking-widest mb-4">{room.code}</div>
          <div className="flex gap-2 justify-center">
            <button onClick={copyCode} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
              {copied ? '✓ Copiato!' : '📋 Copia Codice'}
            </button>
            <button onClick={copyLink} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
              🔗 Copia Link
            </button>
          </div>
        </div>

        {/* Players list */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-amber-400 font-semibold">Giocatori</h2>
            <span className="text-white/40 text-sm">{players.length}/{room.max_players}</span>
          </div>
          <div className="space-y-3">
            {players.map((player, i) => (
              <div key={player.id} className={`flex items-center gap-3 p-3 rounded-xl ${player.player_id === myPlayerId ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-white/5'}`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
                  style={{ background: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'][i % 4] + '33', color: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'][i % 4] }}>
                  {player.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{player.nickname} {player.player_id === myPlayerId ? <span className="text-xs text-amber-400/70">(tu)</span> : ''}</p>
                </div>
                <div className="flex gap-2">
                  {player.is_host && <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full">Host</span>}
                  <div className={`w-2 h-2 rounded-full mt-1 ${player.is_connected ? 'bg-green-400' : 'bg-red-400'}`} />
                </div>
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: room.max_players - players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-white/10">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/20">?</div>
                <p className="text-white/30 text-sm">In attesa di un giocatore...</p>
              </div>
            ))}
          </div>
        </div>

        {/* Settings summary */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
          <p className="text-white/40 text-xs mb-3 uppercase tracking-wider">Impostazioni partita</p>
          <div className="flex gap-4 text-sm">
            <div className="flex-1 text-center">
              <p className="text-white/40 text-xs">Timer</p>
              <p className="text-amber-400 font-bold">{room.turn_timer}s</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-white/40 text-xs">Scadenza</p>
              <p className="text-amber-400 font-bold">{room.timeout_action === 'skip' ? 'Salta' : 'Nulla'}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-white/40 text-xs">Max giocatori</p>
              <p className="text-amber-400 font-bold">{room.max_players}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-white/40 text-xs">Tipo</p>
              <p className="text-amber-400 font-bold">{room.is_public ? 'Pubblica' : 'Privata'}</p>
            </div>
          </div>
        </div>

        {/* Start button */}
        {isHost ? (
          <button
            onClick={startGame}
            disabled={!canStart || starting}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-[#1a1a2e] font-bold rounded-xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? 'Avvio in corso...' : players.length < 2 ? 'Attendi almeno 2 giocatori' : 'Inizia la Partita! 🎲'}
          </button>
        ) : (
          <div className="text-center py-4 text-white/40">
            <div className="text-2xl mb-2 animate-pulse">⏳</div>
            <p>In attesa che l&apos;host avvii la partita...</p>
          </div>
        )}
      </div>
    </main>
  )
}
