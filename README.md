# NIGHTFALL: DISTRICT ZERO

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**The city remembers everything.** NIGHTFALL is an offline, overhead crime story set in Vespera, a fictional coastal city. Jace Mercer returns after years away and finds his mentor Elias Rook missing, with several factions trying to take control of Rook's network.

The project is entered in the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01).

## Launch the game

From the repository directory, start the included static server:

```sh
node serve.ts
```

Open `http://localhost:8080` in a desktop browser. The game draws its world with the Canvas API and loads only local files; it does not request remote scripts, images, or sound.

For a fixed preview scene, add one of these query strings to the page address:

| Scene | Query |
| --- | --- |
| City drive | `?shot=start&seed=1` |
| Mission in progress | `?shot=play&seed=1` |
| Police pursuit | `?shot=chase&seed=1` |
| Night waterfront | `?shot=night&seed=1` |

## Playing

| Input | Effect |
| --- | --- |
| W / S or Up / Down | Accelerate or reverse; walk forward or backward while outside a car |
| A / D or Left / Right | Steer in a vehicle or turn on foot |
| E | Exit a vehicle; on foot, use the mission marker or enter a nearby traffic car |
| F or left mouse button | Fire the current weapon, when ammunition remains |
| Q | Move to the next weapon slot |
| R | Refill the displayed round count from that slot's ammunition |
| 1, 2, or 3 | Pick the Arclight Velo, Kestrel S9, or Rook GT vehicle display |
| J | Show or dismiss the mission journal |
| M | Open or close the district atlas |
| K | Store campaign progress in browser local storage |
| Escape | Pause or return to play |
| Enter | Start a campaign or resume a saved one from the title screen |

Drive to the pulsing gold destination marker. Press E to leave the vehicle, walk to the objective, then press E again to complete the chapter. Completing a chapter awards both money and reputation. Continue restores the saved chapter and player resources in the browser profile that created the save.

## City systems

Vespera is represented as a compact street grid spanning Harbor, Downtown, Old Quarter, Industrial, Hillside, Market, Southside, and Transit. The view includes lit building windows, waterfront piers, moving road traffic, and pedestrians. The interface shows the current chapter and objective, money, health, armor, ammunition, vehicle speed, wanted stars, and a minimap with the player, destination, and police positions.

Gunfire and taking a traffic vehicle attract police attention. The wanted display can rise to five stars. Patrol cars follow the player, and the wanted level slowly falls during play. The mission journal tracks eight story chapters:

1. **BACK IN THE CITY** — meet Mara Venn and retrieve a stolen vehicle.
2. **HOT CARGO** — steal a delivery van and take it to the Blackwater warehouse.
3. **NO QUESTIONS** — deliver an unknown package and lose the police.
4. **NIGHT SHIFT** — enter the warehouse and recover evidence.
5. **CROSSTOWN** — drive across Vespera while rivals pursue.
6. **THE LEDGER** — infiltrate a business and take its records.
7. **OLD DEBTS** — help a former ally escape an enemy faction.
8. **DISTRICT ZERO** — survive the finale and reach a safehouse.

## Current implementation

This build provides one reusable destination interaction for the campaign chapters and a lightweight overhead police pursuit. The five weapon slots use the same firing behavior, while the three selected car names affect the displayed model color rather than vehicle handling. Browser saves retain chapter, cash, reputation, health, armor, mission states, and the night palette.

The project does not yet include enemy combatants, vehicle damage, distinct mission objective logic, vehicle upgrades, weather, or synthesized audio. Those story beats are represented by the journal and destination interaction rather than separate mission scenes.
