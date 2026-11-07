# Carta Mghribia — Hezz2 Online

An online multiplayer version of **Hezz2**, the classic Moroccan *Carta Beldia* shedding game, played with the 40-card Spanish deck.

## Play locally

```bash
npm install
npm start
```

Open http://localhost:3000, create a room and share the invite link (2–4 players).

## Rules

- Each player gets 4 cards. Play a card matching the top card's **suit** or **number**.
- Can't play? Draw one card; your turn ends.
- **2**: the next player draws 2, unless they answer with a 2. Twos stack (2 → 4 → 6…).
- **1**: skips the next player.
- **7**: wild. Play it on anything and choose the next suit.
- First player to empty their hand wins.

## Project layout

- `server/game.js`: the rules engine (pure functions, unit tested)
- `server/index.js`: Express + Socket.IO server, rooms, reconnection
- `public/`: browser client (HTML/CSS/JS, no build step)
- `test/`: rules tests, run with `npm test`

The server is authoritative: it validates every move and only sends each player their own hand.
If a player disconnects mid-game they can reload to rejoin; while they're away their turns are auto-drawn after 20 seconds.
