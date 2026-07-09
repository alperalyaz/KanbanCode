import {
  getOpenCodeModelAdvisoryBadgeLabel,
  localizeOpenCodeModelAdvisoryReason,
} from '@renderer/components/team/dialogs/openCodeModelAdvisoryCopy';
import { describe, expect, it } from 'vitest';

const t = ((key: string) => {
  switch (key) {
    case 'modelSelector.advisory.pingNotConfirmed':
      return 'Ping onaylanmadı';
    case 'modelSelector.advisory.compatibilityPending':
      return 'Uyumlu, derin doğrulama beklemede';
    case 'modelSelector.advisory.note':
      return 'Not';
    default:
      return key;
  }
}) as Parameters<typeof localizeOpenCodeModelAdvisoryReason>[1];

describe('openCodeModelAdvisoryCopy', () => {
  it('localizes compatibility-pending advisories', () => {
    expect(
      localizeOpenCodeModelAdvisoryReason('compatible, deep verification pending', t)
    ).toBe('Uyumlu, derin doğrulama beklemede');
    expect(getOpenCodeModelAdvisoryBadgeLabel('compatible, deep verification pending', t)).toBe(
      'Uyumlu, derin doğrulama beklemede'
    );
  });

  it('localizes ping-not-confirmed advisories', () => {
    expect(localizeOpenCodeModelAdvisoryReason('ping not confirmed', t)).toBe('Ping onaylanmadı');
    expect(getOpenCodeModelAdvisoryBadgeLabel('ping not confirmed', t)).toBe('Ping onaylanmadı');
  });

  it('passes through unknown advisory reasons', () => {
    expect(localizeOpenCodeModelAdvisoryReason('custom advisory detail', t)).toBe(
      'custom advisory detail'
    );
    expect(getOpenCodeModelAdvisoryBadgeLabel('custom advisory detail', t)).toBe('Not');
  });
});
