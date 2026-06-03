import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const zhLocaleDirectory = path.join(
  process.cwd(),
  'src/features/localization/renderer/locales/zh'
);

const zhLocaleFiles = readdirSync(zhLocaleDirectory)
  .filter((fileName) => fileName.endsWith('.json'))
  .sort();

describe('zh locale brand terms', () => {
  it('keeps Claude untranslated in Chinese locale copy', () => {
    for (const fileName of zhLocaleFiles) {
      const contents = readFileSync(path.join(zhLocaleDirectory, fileName), 'utf8');

      expect(contents, `${fileName} should use Claude instead of 克劳德`).not.toContain(
        '克劳德'
      );
    }
  });
});
