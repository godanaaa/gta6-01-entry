# NIGHTFALL: DISTRICT ZERO

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01). NIGHTFALL is an offline, 2D top-down crime-action game set in Vespera City. Start the local server with `node serve.ts`, then visit `http://localhost:8080`. Preview routes are `?shot=start&seed=1`, `?shot=play&seed=1`, `?shot=chase&seed=1`, and `?shot=night&seed=1`.

## How to play

| Key | Action |
| --- | --- |
| W / S | Accelerate or move on foot |
| A / D | Steer or turn |
| E | Leave a car; while walking, use the marker or enter a nearby car |
| F or left click | Fire the selected weapon |
| Q | Select the next ammunition slot |
| R | Reload from the selected slot's stored ammunition |
| 1 / 2 / 3 | Choose the displayed vehicle model |
| J | Show or hide the mission journal |
| M | Open or close the city map |
| K | Save campaign progress in this browser |
| Esc | Pause or resume |
| Enter | Begin a new run or continue an existing save |

Drive toward the gold objective marker, step out with E, walk up to the marker, and press E to finish the current job. Completions grant cash and reputation. Continue loads saved mission progress and player status from local storage.

## Campaign

The journal contains eight chapters: BACK IN THE CITY, HOT CARGO, NO QUESTIONS, NIGHT SHIFT, CROSSTOWN, THE LEDGER, OLD DEBTS, and DISTRICT ZERO. Each has an objective, payout, reputation value, marker, and LOCKED, AVAILABLE, ACTIVE, or COMPLETED status. All chapters currently use the same destination interaction to complete their objective.

## Game systems

- Procedurally placed Vespera blocks, lit windows, roads, harbor piers, and eight named districts.
- Player driving and walking, moving civilian traffic, pedestrians, vehicle entry, weapon slots, ammunition, and wanted stars from zero to five.
- Police cruisers pursue the player; the HUD includes the mission, cash, health, armor, ammunition, speed, wanted level, and a minimap.
- Start menu, pause and journal overlays, map, browser-local save/continue, plus the four deterministic preview scenes.
- Canvas drawing and browser APIs only; the game does not load remote runtime assets.

## Current limits

This is a compact playable slice. Missions share one simple marker interaction, and the eight chapters do not yet have distinct mission mechanics. Weapon slots share firing behavior; there is no enemy gang AI, collision handling, walking collision, vehicle-specific handling, or combat damage. The settings and controls entries are visual labels, and there is no audio, weather, or evolving day/night cycle. Police pursuit and wanted decay are lightweight simulations rather than a full tiered response system.
