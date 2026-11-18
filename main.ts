// NIGHTFALL: DISTRICT ZERO — the pack step.
//
// This file is the entrypoint the scorer runs with `node main.ts`. It takes
// the game as it sits in this repository — the playable files under game/
// and the renders under screenshots/ — lays them out in the output
// directory, and asks the vendored make.fun library to describe that
// layout as a dossier. Nothing here fetches anything from the network and
// nothing here changes the game itself; it only packs it.
//
// The output directory comes from MAKEFUN_OUTPUT_DIR and falls back to
// /output, the directory the platform mounts for the entry.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory this file lives in: the root of the entry repository.
const repositoryRoot = dirname(fileURLToPath(import.meta.url));

// Where the packed entry goes. The platform sets MAKEFUN_OUTPUT_DIR; a
// local run can point it anywhere, and /output is the default.
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the gate hands the dossier builder. They match the bounty's
// gate.json: the text budget, the screenshot count and size, and the
// limits on how many files game/ may hold, how large they may be in
// total, and how long a path may run.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Lay one directory of the repository out inside the output directory,
// copying it wholesale. When the source directory is absent, the
// destination is still created empty, so the dossier builder always
// finds the folder it expects.
function layOutDirectory(sourceDir: string, destinationDir: string): void {
  if (!existsSync(sourceDir)) {
    mkdirSync(destinationDir, { recursive: true });
    return;
  }
  cpSync(sourceDir, destinationDir, { recursive: true });
}

// Pack the entry, step by step.
function packEntry(): void {
  // Start from a clean slate for the destination itself.
  mkdirSync(outputRoot, { recursive: true });

  // The game, then its renders.
  layOutDirectory(join(repositoryRoot, 'game'), join(outputRoot, 'game'));
  layOutDirectory(join(repositoryRoot, 'screenshots'), join(outputRoot, 'screenshots'));

  // The dossier describes exactly what was laid out, and the scorer
  // rebuilds it from the same files to check it matches.
  const dossier = buildDossier(outputRoot, dossierCaps);
  writeFileSync(join(outputRoot, 'dossier.json'), dossier);
}

packEntry();
