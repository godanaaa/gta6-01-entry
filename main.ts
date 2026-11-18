// Assemble the offline game and its captures into the requested dossier folder.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });

const packagedShots = join(outDir, 'screenshots');
mkdirSync(packagedShots, { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, packagedShots, { recursive: true });

const gateLimits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
const manifest = buildDossier(outDir, gateLimits);
writeFileSync(join(outDir, 'dossier.json'), manifest);
