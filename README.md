# NIGHTFALL: DISTRICT ZERO

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/godanaaa/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

An offline 2D top-down crime-action slice set in Vespera City. Run `node serve.ts` and open `http://localhost:8080`. Staged visuals remain available at `?shot=start&seed=1`, `?shot=play&seed=1`, `?shot=chase&seed=1`, and `?shot=night&seed=1`.

## Controls

| Input | Action |
|---|---|
| W / S | Drive or walk forward / backward |
| A / D | Steer or turn |
| E | Exit vehicle; on foot interact with mission marker or nearby traffic |
| F or click | Fire; raises wanted level |
| 1 / 2 / 3 | Select Arclight Velo / Kestrel S9 / Rook GT |
| Q | Cycle weapon slot |
| R | Reload selected weapon pool |
| J | Mission journal |
| M | City map |
| K | Save campaign |
| Esc | Pause / resume |
| Enter | Start new game or continue saved campaign |

Drive to the gold mission marker, press E to leave the vehicle, walk close to the marker with WASD, then press E to complete the job. Mission payouts add cash and reputation. A save is stored locally in the browser; CONTINUE restores mission progress, cash, reputation, health and armor. The journal shows all eight mission states.

## Implemented

- Existing procedural city, HUD, traffic, pedestrians, police response, minimap and four deterministic screenshot staging routes.
- On-foot movement and firing; entering a nearby traffic vehicle raises wanted level.
- Eight-step campaign list with objective text, marker, payouts, reputation and locked/available/active/completed states. Jobs use a shared drive-to/interact loop.
- Local campaign save/load and title screen; pause/journal overlays, wanted stars, map overlay, five ammo pools and weapon slot cycling.

## Limitations

This remains a compact canvas game, not a full open-world campaign. Mission beats share a simple destination interaction; story dialogue is limited to notification text. Enemy gang AI, weapon-specific firing, vehicle upgrades/shops, distinct vehicle handling, procedural audio, weather/day-night progression, collectibles, and a fully navigable settings/controls menu are not implemented. Traffic vehicles move, so nearby vehicle entry is opportunistic. Settings labels are presentation only. Wanted decay and police pursuit are lightweight.

All visuals are drawn with Canvas. No runtime network or third-party dependencies are used.
