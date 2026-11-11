// Game registry. To add a new game, create an adapter in this folder and list it here,
// then add its browser module in public/games/<id>/ (see public/games/README.md).
const list = [require('./carta'), require('./chess'), require('./pool')];
module.exports = Object.fromEntries(list.map((g) => [g.id, g]));
