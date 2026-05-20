'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateRoomCode } from '@/lib/game'
import { Room } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export default function Home() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [publicRooms, setPublicRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'create' | 'join' | 'public'>('create')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [turnTimer, setTurnTimer] = useState(60)
  const [timeoutAction, setTimeoutAction] = useState<'skip' | 'nothing'>('skip')
  const [isPublic, setIsPublic] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('paroliere_nickname')
    if (saved) setNickname(saved)
    fetchPublicRooms()
  }, [])

  async function fetchPublicRooms() {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'waiting')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setPublicRooms(data)
  }

  function saveNickname(name: string) {
    setNickname(name)
    localStorage.setItem('paroliere_nickname', name)
  }

  function getOrCreatePlayerId(): string {
    let id = localStorage.getItem('paroliere_player_id')
    if (!id) {
      id = uuidv4()
      localStorage.setItem('paroliere_player_id', id)
    }
    return id
  }

  async function createRoom() {
    if (!nickname.trim()) return setError('Inserisci il tuo nome')
    setLoading(true)
    setError('')
    try {
      const playerId = getOrCreatePlayerId()
      const code = generateRoomCode()
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ code, host_id: playerId, status: 'waiting', is_public: isPublic, max_players: maxPlayers, turn_timer: turnTimer, timeout_action: timeoutAction })
        .select()
        .single()
      if (roomError) throw roomError
      await supabase.from('players').insert({ room_id: room.id, player_id: playerId, nickname: nickname.trim(), score: 0, rack: [], is_host: true, is_connected: true })
      localStorage.setItem('paroliere_nickname', nickname.trim())
      router.push(`/room/${room.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  async function joinRoom(roomId?: string, roomCode?: string) {
    if (!nickname.trim()) return setError('Inserisci il tuo nome')
    const code = roomCode || joinCode.trim().toUpperCase()
    if (!roomId && !code) return setError('Inserisci il codice')
    setLoading(true)
    setError('')
    try {
      const playerId = getOrCreatePlayerId()
      let room
      if (roomId) {
        const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single()
        room = data
      } else {
        const { data } = await supabase.from('rooms').select('*').eq('code', code).single()
        room = data
      }
      if (!room) throw new Error('Stanza non trovata')
      if (room.status !== 'waiting') throw new Error('La partita è già iniziata')
      const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('room_id', room.id)
      if (count && count >= room.max_players) throw new Error('Stanza piena')
      const { data: existing } = await supabase.from('players').select('*').eq('room_id', room.id).eq('player_id', playerId).single()
      if (!existing) {
        await supabase.from('players').insert({ room_id: room.id, player_id: playerId, nickname: nickname.trim(), score: 0, rack: [], is_host: false, is_connected: true })
      }
      localStorage.setItem('paroliere_nickname', nickname.trim())
      router.push(`/room/${room.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#1a1a2e] text-white" style={{ fontFamily: "'Georgia', serif" }}>
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-xl font-bold text-[#1a1a2e]">P</div>
          <div>
            <h1 className="text-xl font-bold text-amber-400 tracking-wide">PAROLIERE</h1>
            <p className="text-xs text-white/40">Il gioco delle parole italiane</p>
          </div>
        </div>
        <div className="text-white/30 text-sm">🇮🇹 Italiano</div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <label className="block text-sm text-white/60 mb-2 tracking-wider uppercase text-xs">Il tuo nome</label>
          <input type="text" value={nickname} onChange={e => saveNickname(e.target.value)} placeholder="Come ti chiami?" maxLength={20}
            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500 transition-colors text-lg" />
        </div>
        <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-xl">
          {[{ key: 'create', label: '+ Crea Stanza' }, { key: 'join', label: '→ Codice' }, { key: 'public', label: '🌐 Pubblica' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-amber-500 text-[#1a1a2e]' : 'text-white/50 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'create' && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h2 className="text-amber-400 font-semibold mb-5 text-lg">Impostazioni Partita</h2>
              <div className="space-y-5">
                <div>
                  <label className="text-white/60 text-sm block mb-2">Giocatori (2–4)</label>
                  <div className="flex gap-2">
                    {[2, 3, 4].map(n => (
                      <button key={n} onClick={() => setMaxPlayers(n)}
                        className={`flex-1 py-2.5 rounded-lg border transition-all text-sm font-bold ${maxPlayers === n ? 'bg-amber-500 border-amber-500 text-[#1a1a2e]' : 'border-white/20 text-white/60 hover:border-white/40'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">Timer turno: <span className="text-amber-400 font-bold">{turnTimer}s</span></label>
                  <input type="range" min={15} max={180} step={15} value={turnTimer} onChange={e => setTurnTimer(Number(e.target.value))} className="w-full accent-amber-500" />
                  <div className="flex justify-between text-xs text-white/30 mt-1"><span>15s</span><span>180s</span></div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">Scadenza timer</label>
                  <div className="flex gap-2">
                    {[{ value: 'skip', label: 'Salta turno' }, { value: 'nothing', label: 'Non fare nulla' }].map(opt => (
                      <button key={opt.value} onClick={() => setTimeoutAction(opt.value as 'skip' | 'nothing')}
                        className={`flex-1 py-2.5 rounded-lg border transition-all text-sm ${timeoutAction === opt.value ? 'bg-amber-500 border-amber-500 text-[#1a1a2e] font-bold' : 'border-white/20 text-white/60 hover:border-white/40'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">Stanza pubblica</p>
                    <p className="text-xs text-white/40">Visibile nella lobby</p>
                  </div>
                  <button onClick={() => setIsPublic(!isPublic)} className={`w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-amber-500' : 'bg-white/20'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 ${isPublic ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button onClick={createRoom} disabled={loading} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-[#1a1a2e] font-bold rounded-xl text-lg transition-all disabled:opacity-50">
              {loading ? 'Creazione...' : 'Crea Stanza'}
            </button>
          </div>
        )}
        {tab === 'join' && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h2 className="text-amber-400 font-semibold mb-4 text-lg">Entra con Codice</h2>
              <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="CODICE (es. AB3X7K)" maxLength={6}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500 transition-colors text-2xl text-center tracking-widest font-mono" />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button onClick={() => joinRoom()} disabled={loading || !joinCode.trim()} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-[#1a1a2e] font-bold rounded-xl text-lg transition-all disabled:opacity-50">
              {loading ? 'Accesso...' : 'Entra nella Stanza'}
            </button>
          </div>
        )}
        {tab === 'public' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/50 text-sm">{publicRooms.length} stanze aperte</p>
              <button onClick={fetchPublicRooms} className="text-amber-500 text-sm hover:text-amber-400">Aggiorna</button>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            {publicRooms.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <div className="text-4xl mb-3">🎲</div>
                <p>Nessuna stanza pubblica disponibile</p>
                <p className="text-sm mt-1">Crea tu una partita!</p>
              </div>
            ) : (
              publicRooms.map(room => (
                <div key={room.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-amber-500/50 transition-colors">
                  <div>
                    <p className="font-mono text-amber-400 font-bold text-lg">{room.code}</p>
                    <p className="text-white/40 text-sm">Timer: {room.turn_timer}s · Max {room.max_players} giocatori</p>
                  </div>
                  <button onClick={() => joinRoom(room.id)} disabled={loading} className="px-4 py-2 bg-amber-500 text-[#1a1a2e] font-bold rounded-lg hover:bg-amber-400 transition-colors text-sm">
                    Entra
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  )
}
