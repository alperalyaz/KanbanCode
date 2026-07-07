/**
 * Generate the Microsoft Store (appx/MSIX) tile assets from the app logo.
 *
 * Without these, electron-builder's `appx` target falls back to its generic
 * default tiles — so the Store listing and Start-menu tile would NOT show the
 * KanbanCode logo. This script renders the branded tiles into `build/appx/`,
 * where electron-builder picks them up during `pnpm dist:win`.
 *
 * Usage (run locally, needs the `sharp` dependency):
 *   pnpm add -D sharp        # if not already installed
 *   node scripts/generate-appx-assets.mjs
 *   pnpm dist:win
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceLogo = path.join(rootDir, 'resources/icons/png/1024x1024.png');
const outDir = path.join(rootDir, 'build/appx');

// Tile background — matches build.appx.backgroundColor in package.json.
const BACKGROUND = { r: 0, g: 0, b: 0, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Square tiles: logo centered on the tile with a margin so it isn't edge-to-edge.
 * `logoFraction` is how much of the tile the logo occupies (rest is padding).
 */
async function square(name, size, logoFraction = 0.66, background = TRANSPARENT) {
  const inner = Math.round(size * logoFraction);
  const logo = await sharp(sourceLogo)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, name));
}

/** Wide/splash tiles: logo centered on a wider canvas. */
async function wide(name, width, height, logoFraction = 0.5, background = BACKGROUND) {
  const inner = Math.round(Math.min(width, height) * logoFraction);
  const logo = await sharp(sourceLogo)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, name));
}

async function main() {
  await mkdir(outDir, { recursive: true });

  // Core tiles electron-builder maps into the appx manifest.
  await square('Square44x44Logo.png', 44, 0.72); // app list / taskbar
  await square('Square71x71Logo.png', 71, 0.66); // small tile
  await square('Square150x150Logo.png', 150, 0.62); // medium tile
  await square('Square310x310Logo.png', 310, 0.6); // large tile
  await square('StoreLogo.png', 50, 0.78); // Store listing icon
  await square('BadgeLogo.png', 24, 0.9, TRANSPARENT); // badge (monochrome-ish)
  await wide('Wide310x150Logo.png', 310, 150, 0.62); // wide tile
  await wide('SplashScreen.png', 620, 300, 0.5); // splash

  // eslint-disable-next-line no-console
  console.log(`Generated appx tile assets in ${path.relative(rootDir, outDir)}/`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate appx assets:', error);
  process.exit(1);
});
