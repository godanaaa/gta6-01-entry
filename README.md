# NIGHTFALL: DISTRICT ZERO

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01). NIGHTFALL is an offline, overhead crime-action game set in Vespera City. Launch `node serve.ts` and open `http://localhost:8080`. The four fixed preview scenes are `?shot=start&seed=1`, `?shot=play&seed=1`, `?shot=chase&seed=1`, and `?shot=night&seed=1`.

## Controls

| Input | Result |
| --- | --- |
| W / S | Drive forward or back; walk forward or back while outside |
| A / D | Turn the vehicle or change facing direction on foot |
| E | Step out of a vehicle; on foot, interact at the objective or take a nearby car |
| F or left mouse button | Fire the equipped weapon |
| Q | Cycle weapon slots |
| R | Restore the selected slot's displayed ammunition |
| 1 / 2 / 3 | Change the displayed vehicle model |
| J | Open or dismiss the mission journal |
| M | Show or hide the district atlas |
| K | Store campaign progress in local browser storage |
| Escape | Pause or return to the game |
| Enter | Start a campaign or continue the saved one |

The gold ring marks the current destination. Drive close, leave the car, walk into the ring, and press E. Completed chapters award cash and reputation. Continue restores the saved chapter and player resources on this browser.

## The campaign

The journal tracks eight chapters: BACK IN THE CITY, HOT CARGO, NO QUESTIONS, NIGHT SHIFT, CROSSTOWN, THE LEDGER, OLD DEBTS, and DISTRICT ZERO. Their entries show LOCKED, AVAILABLE, ACTIVE, or COMPLETED. Each chapter has its own title, objective text, payout, reputation award, and destination marker; the current slice resolves them through the same marker interaction.

## City systems

- A generated street grid, harbor piers, illuminated building fronts, and eight districts form the Vespera backdrop.
- Jace can drive or travel on foot. Civilian cars and pedestrians move through the nearby scene, and cars can be taken while walking.
- Gunfire and car theft increase the wanted rating. Pursuing police cars appear, and the HUD shows the response level.
- The screen displays the active chapter, objective, money, health, armor, ammunition, speed, wanted stars, and a local map with player and police markers.
- The start screen, pause overlay, district atlas, mission list, browser save, and four query-selected scenes are included.
- The scene uses canvas drawing and built-in browser features. It loads no remote code or media.

## Scope notes

This is a compact game slice. Chapter objectives share a common interaction, and there is no distinct mission scripting, enemy gang behavior, collision damage, or vehicle-specific handling. Weapon slots currently share the same firing action. Settings and controls appear in the title screen as labels, and audio, weather, and a changing time cycle are not implemented. Police behavior is a small pursuit simulation rather than a full tiered response model.
