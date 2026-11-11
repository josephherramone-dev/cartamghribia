# Divoxe Games

A free, no-signup game platform: pick a nickname and play **Chess**, **8-Ball Pool** and **Carta Beldia (Hezz 2)**
online with friends, in quick matches with other visitors, or against the computer.

Made by **Divoxe**.

## Run it

```bash
npm install
npm start
```

Open http://localhost:3000. For hosting on a VPS see [DEPLOY.md](DEPLOY.md).

## Features

- Guest profiles (nickname and emoji avatar stored in the browser), no login
- **Quick match** (matchmaking with people online), **private rooms** with invite links/codes, **vs computer** (Easy / Hard)
- Computer players can fill empty seats in any room
- Live chat with quick reactions, reconnect after refresh, rematches
- Online player counter
- Works on phones and desktops

## Games

| Game | Players | Notes |
|------|---------|-------|
| Carta Beldia | 2–4 | Moroccan Hezz 2 rules, Spanish-deck artwork, optional real card images in `public/cards/` |
| Chess | 2 | Full rules via chess.js, alpha-beta computer player |
| 8-Ball Pool | 2 | Shared physics on server and browser, standard 8-ball rules, simulation-based computer player |

## Project layout

- `server/index.js` — Express + Socket.IO: rooms, matchmaking, bots, chat (game-agnostic)
- `server/games/` — one adapter per game (rules on the server)
- `public/js/app.js` — platform shell (home, game picker, lobby, chat, results)
- `public/games/<id>/` — one browser module per game
- `test/` — `npm test`

## Adding a game

See [public/games/README.md](public/games/README.md): write a server adapter and a browser module, register both, done.
The platform handles rooms, matchmaking, bots, chat and results.
