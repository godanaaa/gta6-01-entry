// Package the locally playable Vespera City build and its separately captured previews.
// No runtime assets are fetched: this entry only prepares the dossier directory.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const gameSource = join(projectRoot, 'game');
const imageSource = join(projectRoot, 'screenshots');

mkdirSync(destination, { recursive: true });
cpSync(gameSource, join(destination, 'game'), { recursive: true });

const imageDestination = join(destination, 'screenshots');
mkdirSync(imageDestination, { recursive: true });
if (existsSync(imageSource)) cpSync(imageSource, imageDestination, { recursive: true });

const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
const dossier = buildDossier(destination, limits);
writeFileSync(join(destination, 'dossier.json'), dossier);
