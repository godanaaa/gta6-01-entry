# NIGHTFALL: DISTRICT ZERO

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**The city remembers everything.** Jace Mercer returns to Vespera, a fictional coastal city, after his mentor Elias Rook disappears. Fixer Mara Venn offers a way back into Rook's network, while rival crews and the police close in.

This project is entered in the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01).

## Run it locally

From this repository, start the included static server:

```sh
node serve.ts
```

Visit `http://localhost:8080` in a desktop browser. The page uses a 2D Canvas scene and files stored in `game/`; gameplay makes no network requests.

The four repeatable preview addresses are listed in [`shots.json`](shots.json): `?shot=start&seed=1`, `?shot=play&seed=1`, `?shot=chase&seed=1`, and `?shot=night&seed=1`.

## Controls

| Key or input | Action |
| --- | --- |
| W / S or Up / Down | Move forward or backward; accelerate or reverse in a car |
| A / D or Left / Right | Turn on foot; steer while driving |
| E | Leave a vehicle, enter nearby traffic, or use the mission marker |
| F or left mouse button | Fire the selected weapon if it has ammunition |
| Q | Select the next weapon slot |
| R | Refresh the displayed rounds from the selected slot |
| 1, 2, or 3 | Change the displayed vehicle model |
| J | Open or dismiss the mission journal |
| M | Show or hide the district map |
| K | Save campaign progress in browser storage |
| Escape | Pause or resume |
| Enter | Begin a campaign or continue saved progress from the title screen |

Drive or walk to the gold marker. Leave the car and press E near the objective to finish the current chapter. Chapters award cash and reputation; the browser save stores campaign resources and mission state.

## City and campaign

Vespera's eight districts are Harbor, Downtown, Old Quarter, Industrial, Hillside, Market, Southside, and Transit. A seeded street grid, colored buildings, lit windows, road traffic, pedestrians, a destination marker, minimap, and HUD create the city view. Gunfire and vehicle theft increase police attention. Up to five wanted stars are shown as patrols follow the player; attention fades over time.

The journal presents these story chapters with locked, available, active, and completed states:

1. **BACK IN THE CITY** — meet Mara Venn and retrieve a stolen vehicle.
2. **HOT CARGO** — steal a delivery van and take it to Blackwater warehouse.
3. **NO QUESTIONS** — deliver the package and lose the police.
4. **NIGHT SHIFT** — enter the warehouse and recover evidence.
5. **CROSSTOWN** — cross Vespera while rivals pursue.
6. **THE LEDGER** — infiltrate a business and take its ledger.
7. **OLD DEBTS** — help an ally escape an enemy faction.
8. **DISTRICT ZERO** — survive the finale and reach a safehouse.

## Implementation notes

This is a compact top-down slice. All five weapon slots share one firing model, vehicle names change the displayed car style rather than its handling, and the chapters share a destination interaction. There is no enemy combat AI, vehicle damage, separate mission scripting, upgrades, weather, or synthesized audio yet. The preview states are deterministic and intended for recorded captures.
