import {
  CODEX_CHATGPT_FALLBACK_MODEL,
  isCodexChatGptSunsetModel,
  remapCodexModelForChatGptAccount,
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
      CODEX_CHATGPT_FALLBACK_MODEL
    );
    expect(remapCodexModelForChatGptAccount('gpt-5.5', 'gpt-5.4')).toBe('gpt-5.5');
  });
});
