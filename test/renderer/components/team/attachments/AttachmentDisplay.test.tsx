import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { AttachmentDisplay } from '@renderer/components/team/attachments/AttachmentDisplay';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@features/localization/renderer', () => ({
  useAppTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@renderer/components/team/editor/FileIcon', () => ({
  FileIcon: ({ fileName }: { fileName: string }) => React.createElement('span', null, fileName),
}));

describe('AttachmentDisplay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders persisted non-image attachments as plain tiles without an editor-open action', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const getAttachments = vi.fn().mockResolvedValue([
      {
        id: 'att-1',
        data: Buffer.from('verification').toString('base64'),
        mimeType: 'text/markdown',
        filePath: '/app/data/attachments/team-a/msg-1/att-1--verification.md',
      },
    ]);
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { teams: { getAttachments } },
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <AttachmentDisplay
          teamName="team-a"
          messageId="msg-1"
          attachments={[
            {
              id: 'att-1',
              filename: 'verification.md',
              mimeType: 'text/markdown',
              size: 12,
            },
          ]}
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const tile = host.querySelector('[title="verification.md"]');
    expect(tile).not.toBeNull();
    expect(tile?.tagName).toBe('DIV');
    expect(host.querySelector('button[aria-label="Open verification.md"]')).toBeNull();
  });
});
