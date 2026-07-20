import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@features/localization/renderer', () => ({
  useAppTranslation: () => ({
    t: (key: string) => {
      if (key === 'actions.showMore') return 'Show more';
      if (key === 'actions.showLess') return 'Show less';
      return key;
    },
  }),
}));

import { ExpandableContent } from '@renderer/components/ui/ExpandableContent';

describe('ExpandableContent', () => {
  const originalScrollHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollHeight'
  );

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return 320;
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    }
  });

  it('starts expanded when defaultExpanded is true and content is tall', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        React.createElement(
          ExpandableContent,
          { defaultExpanded: true, collapsedHeight: 40 },
          React.createElement('div', null, 'long user message')
        )
      );
    });

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    const buttons = [...host.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(buttons).toContain('Show less');
    expect(buttons).not.toContain('Show more');

    await act(async () => {
      root.unmount();
    });
  });

  it('starts collapsed by default for tall content', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        React.createElement(
          ExpandableContent,
          { collapsedHeight: 40 },
          React.createElement('div', null, 'agent chatter')
        )
      );
    });

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    const buttons = [...host.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(buttons).toContain('Show more');
    expect(buttons).not.toContain('Show less');

    await act(async () => {
      root.unmount();
    });
  });
});
