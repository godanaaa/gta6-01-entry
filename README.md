# NIGHTFALL: DISTRICT ZERO

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An entry for [make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01) — "Make GTA 6".

**NIGHTFALL: DISTRICT ZERO** is an original 2D top-down open-world crime game.
The city remembers everything. So does Jace Mercer.

## The story

Jace Mercer comes home to Vespera City after years away, and finds the
world he left behind has moved on without him. His mentor, Elias Rook,
has vanished, and the criminal network Rook built is being torn apart by
the factions that want to control it. Mara Venn, a fixer who owes Rook
a debt, hands Jace his first job — and from there the night only gets
deeper. Across eight chapters Jace steals, delivers, breaks in, runs,
and finally settles the score in District Zero itself.

Everything here is original: the city, the people, the cars, the names,
the story, the art. Nothing is borrowed from any other game.

## Vespera City

A fictional coastal metropolis, built as one compact, driveable map
with eight districts that each look and feel different:

- **Harbor** — cranes, containers, and the Blackwater docks
- **Downtown** — towers, neon, and the Vespera Tower skyline
- **Old Quarter** — narrow streets and the night market
- **Industrial** — the Ironworks factory and warehouse rows
- **Hillside** — steep streets and the Sunset Overlook
- **Market** — crowded stalls and the Neon Arcade
- **Southside** — the Crown Hotel and the late-night streets
- **Airport / Transit** — Central Station and the Meridian Bridge

Landmarks worth finding: Vespera Tower, Meridian Bridge, Blackwater
Harbor, Neon Arcade, Central Station, Crown Hotel, Ironworks Factory,
Old Quarter Market, and Sunset Overlook.

## What you can do

- **Drive the city.** Walk, sprint, and jump on foot; steal any car
  you can reach and drive it. Nine rides, from a battered compact to
  a police cruiser, each with its own handling.
- **Outrun the law.** A wanted level from 0 to 5 stars. One star and
  the police are curious; five and the whole city is coming for you.
  Break line of sight, switch cars, and disappear.
- **Fight back.** A small arsenal of fictional weapons — pistol, heavy
  pistol, SMG, shotgun, rifle — with ammo, reloads, and muzzle flash.
- **Work the eight chapters.** Each mission has its own objective:
  meet a contact, steal a van, deliver a package, break into a
  warehouse, outrun rivals, lift a ledger, spring an ally, and the
  finale in District Zero. Missions track as locked, available,
  active, completed, or failed.
- **Live in the city.** Traffic follows the roads, pedestrians cross
  the streets and scatter when shots ring out, and the police react
  to what they see. Day turns to night; the streetlights come on.
- **Keep what you earn.** Cash from missions, a save system that
  remembers your progress, and a safehouse to come back to.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| Space | Jump |
| C | Crouch |
| E | Interact / enter vehicle |
| Mouse + LMB | Aim / shoot |
| RMB | Aim |
| R | Reload |
| M | Map |
| Esc | Pause |

On-screen prompts tell you when you can enter a car or talk to
someone. The HUD shows health, armor, ammo, weapon, cash, wanted
stars, your current objective, and a minimap with the mission marker.

## How to run it

The game is plain static files with no network use during play.

```sh
node serve.ts          # serves game/ on localhost:8080
```

Open the page in desktop Chrome. `node --check game/src/main.js`
checks the game source, and `MAKEFUN_OUTPUT_DIR=out node main.ts`
builds `out/` with the entry dossier.

## Screenshots

Four deterministic states, driven by the `?shot=` query:

- `?shot=start` — driving through dense downtown, traffic and HUD
- `?shot=play` — a mission scene, on foot with the objective live
- `?shot=chase` — a police pursuit with wanted stars showing
- `?shot=night` — the city at night, streetlights and neon

See `shots.json` for the full list.

## Files

- `game/index.html` — the page that hosts the game
- `game/src/main.js` — the whole game: city, player, vehicles,
  traffic, pedestrians, police, combat, missions, HUD, save
- `main.ts` — the entrypoint; copies `game/` and `screenshots/`
  into the output directory and writes `dossier.json`
- `screenshots/` — the four captured states above
- `shots.json` — the screenshot list with their query states
