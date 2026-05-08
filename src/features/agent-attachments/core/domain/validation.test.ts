import { resolveAgentAttachmentCapability } from './capabilities';
import { validateAttachmentForCapability, validateImageOptimizationInput } from './validation';

import type { AgentAttachmentPayload } from './types';

function fakeImageAttachment(
  overrides: Partial<AgentAttachmentPayload> = {}
): AgentAttachmentPayload {
  return {
    schemaVersion: 1,
    id: 'att_1',
    originalName: 'red-square.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    kind: 'image',
    source: 'composer',
    order: 1,
    storage: { originalArtifactId: 'art_original_1', optimizedArtifactId: 'art_optimized_1' },
    image: { width: 64, height: 64, optimizedWidth: 64, optimizedHeight: 64, optimization: 'none' },
    warnings: [],
    ...overrides,
  };
}

describe('agent attachment validation', () => {
  it('accepts a small png optimization input', () => {
    expect(
      validateImageOptimizationInput({
        mimeType: 'image/png',
        sizeBytes: 1000,
        width: 64,
        height: 64,
      })
    ).toEqual({ ok: true, warnings: [] });
  });

  it('rejects unsupported image optimization input', () => {
    const result = validateImageOptimizationInput({
      mimeType: 'image/gif',
      sizeBytes: 1000,
      width: 64,
      height: 64,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('attachment_type_unsupported');
  });

  it('blocks known non-vision OpenCode models', () => {
    const capability = resolveAgentAttachmentCapability({
      providerId: 'opencode',
      model: 'openrouter/z-ai/glm-5.1',
    });
    const result = validateAttachmentForCapability({
      attachment: fakeImageAttachment(),
      capability,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('attachment_model_unsupported');
  });

  it('allows known vision OpenCode models', () => {
    const capability = resolveAgentAttachmentCapability({
      providerId: 'opencode',
      model: 'openrouter/moonshotai/kimi-k2.6',
    });
    expect(
      validateAttachmentForCapability({ attachment: fakeImageAttachment(), capability })
    ).toEqual({
      ok: true,
      warnings: [],
    });
  });
});
