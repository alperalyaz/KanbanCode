import type { AgentAttachmentCapability, AgentAttachmentCapabilityTarget } from './types';

const DEFAULT_IMAGE_BYTES_PER_PROVIDER = 4 * 1024 * 1024;
const DEFAULT_IMAGE_BYTES_TOTAL = 8 * 1024 * 1024;

function supported(displayText: string): AgentAttachmentCapability {
  return {
    supportsImages: true,
    supportedImageMimeTypes: ['image/png', 'image/jpeg'],
    maxImages: 5,
    maxBytesPerImage: DEFAULT_IMAGE_BYTES_PER_PROVIDER,
    maxBytesTotal: DEFAULT_IMAGE_BYTES_TOTAL,
    reason: 'known_provider_support',
    displayText,
  };
}

function unsupported(
  reason: AgentAttachmentCapability['reason'],
  displayText: string
): AgentAttachmentCapability {
  return {
    supportsImages: false,
    supportedImageMimeTypes: [],
    maxImages: 0,
    maxBytesPerImage: 0,
    maxBytesTotal: 0,
    reason,
    displayText,
  };
}

export function canonicalizeOpenCodeModel(input: { providerId: string; model?: string | null }): {
  providerId: string;
  model: string;
} {
  const providerId = input.providerId.trim().toLowerCase();
  const model = (input.model ?? '')
    .trim()
    .toLowerCase()
    .replace(/^openrouter\//, '')
    .replace(/^openai\//, '');
  return { providerId, model };
}

export function resolveAgentAttachmentCapability(
  target: AgentAttachmentCapabilityTarget
): AgentAttachmentCapability {
  const providerId = target.providerId.trim().toLowerCase();

  if (providerId === 'anthropic') {
    return supported('Claude can receive image attachments through structured image blocks.');
  }

  if (providerId === 'codex') {
    return supported('Codex can receive image attachments through the native image channel.');
  }

  if (providerId === 'opencode') {
    const { model } = canonicalizeOpenCodeModel(target);
    if (model === 'gpt-5.4-mini') {
      return {
        ...supported('OpenCode model openai/gpt-5.4-mini is verified for image attachments.'),
        reason: 'known_vision_model',
      };
    }
    if (model === 'moonshotai/kimi-k2.6' || model === 'z-ai/glm-4.5v') {
      return {
        ...supported(`OpenCode model ${model} is verified for image attachments.`),
        reason: 'known_vision_model',
      };
    }
    if (model === 'z-ai/glm-5.1') {
      return unsupported(
        'known_non_vision_model',
        'This OpenCode model is not verified for image attachments. Choose a vision-capable model or remove the image.'
      );
    }
    return unsupported(
      'unknown_model',
      'This OpenCode model has unknown image support. Image delivery is blocked for reliability.'
    );
  }

  return unsupported(
    'unsupported_provider',
    'Selected provider does not support image attachments through this delivery path.'
  );
}
