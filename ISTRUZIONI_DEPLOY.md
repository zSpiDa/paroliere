# 🎲 PAROLIERE — Guida al Deploy Completo

## PASSO 1: Configura il database su Supabase

1. Vai su **https://supabase.com** e apri il tuo progetto
2. Nel menu laterale, clicca su **SQL Editor**
3. Copia e incolla tutto il contenuto del file `supabase-schema.sql`
4. Clicca **Run** (il triangolo verde)
5. Dovresti vedere "Success" — il database è pronto!

---

## PASSO 2: Deploy su Vercel (gratuito, ~5 minuti)

### Opzione A: Deploy diretto da cartella (più semplice)

1. Installa Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Estrai lo zip e vai nella cartella:
   ```bash
   cd paroliere
   ```

3. Lancia il deploy:
   ```bash
   vercel
   ```
   - Rispondi alle domande: Y, Y, N (usa le impostazioni default)
   - Vercel ti darà un URL tipo `paroliere-xyz.vercel.app`

### Opzione B: Deploy via GitHub (consigliato per aggiornamenti futuri)

1. Crea un account su **https://github.com** (se non ce l'hai)
2. Crea un nuovo repository chiamato `paroliere`
3. Estrai lo zip, vai nella cartella ed esegui:
   ```bash
   git init
   git add .
   git commit -m "primo commit"
   git remote add origin https://github.com/TUO_USERNAME/paroliere.git
   git push -u origin main
   ```
4. Vai su **https://vercel.com** → "Add New Project" → Importa il repo GitHub
5. Vercel rileva automaticamente Next.js — clicca Deploy

### ⚠️ IMPORTANTE: Variabili d'ambiente su Vercel

Dopo il deploy, vai su Vercel → Settings → Environment Variables e aggiungi:

| Nome | Valore |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://eedfshurfqomfcpjpngf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (la chiave completa) |

Poi clicca **Redeploy** per applicare le variabili.

---

## PASSO 3: Testa il gioco

1. Apri l'URL Vercel in due finestre del browser (o condividilo con un amico)
2. Nella prima finestra: crea una stanza, copia il codice
3. Nella seconda finestra: usa "Entra con Codice" e incolla il codice
4. L'host clicca "Inizia la Partita"
5. 🎲 Buon gioco!

---

## Come si gioca

- **Seleziona** una tessera dal rack (in basso a destra)
- **Clicca** su una casella vuota del tabellone per posizionarla
- **Clicca su una tessera piazzata** per ritirarla nel rack
- **"Conferma"** per validare la mossa (le parole vengono verificate in italiano)
- **"Ritira tessere"** per rimettere tutte le tessere nel rack
- **"Salta turno"** se non riesci a fare nessuna mossa
- Prima mossa: deve coprire la casella centrale ★ con almeno 2 lettere
- Bonus BINGO: +50 punti se usi tutte e 7 le tessere in una mossa!

---

## Legenda caselle premium

| Colore | Sigla | Effetto |
|--------|-------|---------|
| 🔴 Rosso | TW | Parola × 3 |
| 🟠 Arancio | DW | Parola × 2 |
| 🔵 Blu scuro | TL | Lettera × 3 |
| 🔵 Blu chiaro | DL | Lettera × 2 |
| ⭐ Centro | ★ | Parola × 2 (prima mossa) |

---

## Monetizzazione (idee future)

⚠️ Non chiamarlo "Scarabeo" — è un marchio Mattel. "Paroliere" è perfetto!

### Modelli gratuiti per iniziare:
- **Google AdSense** — pubblicità display nelle pagine (lobby/fine partita)
- **Donazioni** — Ko-fi o PayPal donate button

### Modelli premium (quando hai traffico):
- Stanze private illimitate (free: solo pubblica)
- Avatar e temi personalizzati
- Tornei con classifiche settimanali
- Abbonamento mensile (€2-3/mese)

### Realisticamente:
- Con 100 utenti attivi/giorno → €50-150/mese (ads)
- Con una piccola community italiana → crescita organica possibile
- Costa €0/mese finché stai nei tier gratuiti di Vercel + Supabase

---

## Struttura del progetto

```
paroliere/
├── src/
│   ├── app/
│   │   ├── page.tsx          ← Homepage / lobby
│   │   └── room/[id]/
│   │       ├── page.tsx      ← Sala d'attesa
│   │       └── play/
│   │           └── page.tsx  ← Il gioco vero e proprio
│   ├── lib/
│   │   ├── supabase.ts       ← Client Supabase
│   │   └── game.ts           ← Logica di gioco (tessere, punteggi, validazione)
│   └── types/
│       └── index.ts          ← TypeScript types
├── supabase-schema.sql       ← Schema DB da eseguire su Supabase
└── .env.local                ← Variabili d'ambiente (non committare su Git!)
```
