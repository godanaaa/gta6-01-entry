// Assemble the offline game bundle and write the review dossier beside it.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repositoryDirectory = fileURLToPath(new URL('.', import.meta.url));
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const bundleLimits = {
  text_max_bytes: 163840,
  screenshots: {
    max: 4,
    max_bytes: 262144,
  },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const sourceGameDirectory = join(repositoryDirectory, 'game');
const sourceScreenshotDirectory = join(repositoryDirectory, 'screenshots');
const targetGameDirectory = join(outputDirectory, 'game');
const targetScreenshotDirectory = join(outputDirectory, 'screenshots');
const targetDossierFile = join(outputDirectory, 'dossier.json');

// Prepare the output location before copying any of the local bundle assets.
mkdirSync(outputDirectory, { recursive: true });
cpSync(sourceGameDirectory, targetGameDirectory, { recursive: true });
mkdirSync(targetScreenshotDirectory, { recursive: true });

// Captures are optional while developing, but are copied whenever present.
if (existsSync(sourceScreenshotDirectory)) {
  cpSync(sourceScreenshotDirectory, targetScreenshotDirectory, { recursive: true });
}

// The kit helper inspects the finished bundle and serializes its dossier data.
const dossierContents = buildDossier(outputDirectory, bundleLimits);
writeFileSync(targetDossierFile, dossierContents);
