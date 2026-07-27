import { getCodexChatGptOfflineFallbackModel } from '@shared/utils/codexChatGptSunsetModels';
import { describe, expect, it } from 'vitest';

import {
  createStaticCodexModelCatalogModels,
  getStaticCodexDefaultLaunchModel,
} from '../codexModelCatalogFallback';

describe('createStaticCodexModelCatalogModels', () => {
  it('marks GPT-5.5 as the offline default while still listing older models', () => {
    const models = createStaticCodexModelCatalogModels();

    expect(models.map((model) => model.launchModel)).toContain('gpt-5.5');
    expect(models.find((model) => model.isDefault)?.launchModel).toBe('gpt-5.5');
    expect(getStaticCodexDefaultLaunchModel()).toBe('gpt-5.5');
    expect(getStaticCodexDefaultLaunchModel()).toBe(getCodexChatGptOfflineFallbackModel());
  });
});
