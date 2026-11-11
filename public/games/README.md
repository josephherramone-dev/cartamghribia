# Adding a game to Divoxe Games

A game is two small pieces: a **server adapter** (rules, validated on the server) and a **browser module** (drawing and input).
The platform already handles nicknames, rooms and invite links, quick match, bots, reconnecting, chat, rematches and the result screen.

## 1. Server adapter — `server/games/<id>.js`

```js
module.exports = {
  id: 'mygame', name: 'My Game', minPlayers: 2, maxPlayers: 2,
  GameError,                          // class thrown for invalid moves (message is shown to the player)
  create(players) { return state; },  // players: [{ id, name }]
  view(state, playerId) { return { turn, result, ... }; }, // what this player may see
  act(state, playerId, action) {},    // apply a move or throw new GameError('...')
  turnOf(state) { return playerId | null; },
  isOver(state) { return bool; },
  botAct(state, botId, level) { return action; },          // level: 'easy' | 'hard'
  // optional
  onIdle(state, playerId) {},         // a disconnected player's turn timed out
  onLeave(state, playerId) {},        // player left mid-game (e.g. forfeit)
  botDelay(state) { return ms; },
};
```
`view().result` must be `null` or `{ winners: [playerIds], text }` (empty winners = draw).
Register it in `server/games/index.js`.

## 2. Browser module — `public/games/<id>/<id>.js` (+ css)

```js
Divoxe.registerGame({
  id: 'mygame', name: 'My Game', tagline: '...', description: '...',
  playersLabel: '2 players', maxBots: 1,
  accent: 'linear-gradient(135deg, #111, #333)',   // tile colour
  icon: '<svg>…</svg>',                             // small square icon
  art() { return '<svg class="art">…</svg>'; },     // tile artwork
  playerBadge(view, player) { return ''; },         // optional text in the player list
  mount(root, api) {
    // api.send(action), api.me(), api.player(id), api.playerName(id), api.toast(msg), api.sound(name), api.signal(data)
    return { update(room) {}, destroy() {}, busy() { return false; }, onSignal(from, data) {} };
  },
});
```
Then add it to `MANIFEST` at the top of `public/js/app.js`.
