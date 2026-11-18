// Assemble the local game bundle and place its review dossier alongside the bundle.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const bundleDestination = process.env.MAKEFUN_OUTPUT_DIR || '/output';
// Resolve every artifact from one root so custom output directories stay self-contained.
function bundlePath(...segments: string[]) {
  return join(bundleDestination, ...segments);
}

const dossierRules = {
  text_max_bytes: 163840,
  screenshots: {
    max: 4,
    max_bytes: 262144,
  },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const localGame = join(projectRoot, 'game');
const localCaptures = join(projectRoot, 'screenshots');
const bundledGame = bundlePath('game');
const bundledCaptures = bundlePath('screenshots');
const dossierPath = bundlePath('dossier.json');

// Create the destination tree before adding the static game and capture folders.
mkdirSync(bundleDestination, { recursive: true });
cpSync(localGame, bundledGame, { recursive: true });
mkdirSync(bundledCaptures, { recursive: true });

// A build can run before captures exist; include them automatically when present.
if (existsSync(localCaptures)) {
  cpSync(localCaptures, bundledCaptures, { recursive: true });
}

// Let the supplied kit inspect the complete output tree and serialize its report.
const dossierJson = buildDossier(bundleDestination, dossierRules);
writeFileSync(dossierPath, dossierJson);
