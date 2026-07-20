import {
  getCodexChatGptOfflineFallbackModel,
  isCodexChatGptSunsetModel,
  pickCodexChatGptSafeModel,
  remapCodexModelForChatGptAccount,
  resolveCodexChatGptLaunchModel,
} from '@shared/utils/codexChatGptSunsetModels';
import { describe, expect, it } from 'vitest';

describe('codexChatGptSunsetModels', () => {
  it('detects ChatGPT-sunset Codex models', () => {
    expect(isCodexChatGptSunsetModel('gpt-5.3-codex')).toBe(true);
    expect(isCodexChatGptSunsetModel('GPT-5.3-Codex')).toBe(true);
    expect(isCodexChatGptSunsetModel('gpt-5.2')).toBe(true);
    expect(isCodexChatGptSunsetModel('gpt-5.5')).toBe(false);
    expect(isCodexChatGptSunsetModel('gpt-5.4')).toBe(false);
  });

  it('remaps sunset models to a ChatGPT-safe fallback', () => {
    expect(remapCodexModelForChatGptAccount('gpt-5.3-codex', 'gpt-5.4')).toBe('gpt-5.4');
    expect(remapCodexModelForChatGptAccount('gpt-5.3-codex', 'gpt-5.3-codex')).toBe(
      getCodexChatGptOfflineFallbackModel()
    );
    expect(remapCodexModelForChatGptAccount('gpt-5.5', 'gpt-5.4')).toBe('gpt-5.5');
  });

  it('picks the first ChatGPT-safe model when the config default is sunset', () => {
    expect(pickCodexChatGptSafeModel(['gpt-5.3-codex', 'gpt-5.5', 'gpt-5.4'])).toBe('gpt-5.5');
    expect(pickCodexChatGptSafeModel(['gpt-5.3-codex', 'gpt-5.2'])).toBe(
      getCodexChatGptOfflineFallbackModel()
    );
    expect(pickCodexChatGptSafeModel([null, undefined, ''], 'gpt-5.4')).toBe('gpt-5.4');
  });

  it('follows the live catalog default instead of a forever-pinned model id', () => {
    expect(
      resolveCodexChatGptLaunchModel({
        selectedModel: 'default',
        catalogDefault: 'gpt-5.9',
        catalogModels: [
          { id: 'gpt-5.3-codex', launchModel: 'gpt-5.3-codex' },
          { id: 'gpt-5.9', launchModel: 'gpt-5.9' },
          { id: 'gpt-5.8', launchModel: 'gpt-5.8' },
        ],
      })
    ).toBe('gpt-5.9');

    expect(
      resolveCodexChatGptLaunchModel({
        catalogDefault: 'gpt-5.3-codex',
        catalogModels: [
          { id: 'gpt-5.3-codex', launchModel: 'gpt-5.3-codex' },
          { id: 'gpt-5.8', launchModel: 'gpt-5.8' },
        ],
        unavailableModelIds: ['gpt-5.8'],
      })
    ).toBe(getCodexChatGptOfflineFallbackModel());
  });
});
