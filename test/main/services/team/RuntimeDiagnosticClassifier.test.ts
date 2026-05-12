import { describe, expect, it } from 'vitest';

import {
  classifyRuntimeDiagnostic,
  selectRuntimeDiagnosticClassification,
} from '../../../../src/main/services/team/runtime/RuntimeDiagnosticClassifier';

describe('RuntimeDiagnosticClassifier', () => {
  it('selects disk-full errors over aborted and empty OpenCode noise', () => {
    const selected = selectRuntimeDiagnosticClassification([
      'Latest assistant message msg_1 failed with MessageAbortedError - Aborted',
      'empty_assistant_turn',
      "OpenCode message bridge failed: ENOSPC: no space left on device, open '/tmp/.auth.json.tmp'",
    ]);

    expect(selected).toMatchObject({
      reasonCode: 'filesystem_error',
      normalizedMessage: 'Local disk is full (ENOSPC). Free disk space and retry OpenCode delivery.',
      actionRequired: true,
      generic: false,
    });
  });

  it('selects quota errors over empty assistant turns', () => {
    const selected = selectRuntimeDiagnosticClassification([
      'empty_assistant_turn',
      'Latest assistant message msg_2 failed with APIError - Insufficient credits. Add more using https://openrouter.ai/settings/credits',
    ]);

    expect(selected).toMatchObject({
      reasonCode: 'quota_exhausted',
      normalizedMessage:
        'Insufficient credits. Add more using https://openrouter.ai/settings/credits',
      actionRequired: true,
    });
  });

  it('selects auth errors over bridge timeouts', () => {
    const selected = selectRuntimeDiagnosticClassification([
      'OpenCode bridge command timed out',
      'authentication_failed: invalid API key',
    ]);

    expect(selected).toMatchObject({
      reasonCode: 'auth_error',
      normalizedMessage: 'authentication_failed: invalid API key',
      actionRequired: true,
    });
  });

  it('classifies OpenCode bridge outcome timeouts as backend delivery state', () => {
    expect(
      classifyRuntimeDiagnostic('opencode_prompt_acceptance_unknown_after_bridge_timeout')
    ).toMatchObject({
      reasonCode: 'backend_error',
      normalizedMessage: 'OpenCode bridge outcome unknown after timeout, retrying/observing.',
      generic: true,
      actionRequired: false,
    });
  });

  it('keeps pure empty assistant turns as generic backend fallback', () => {
    expect(classifyRuntimeDiagnostic('empty_assistant_turn')).toMatchObject({
      reasonCode: 'backend_error',
      normalizedMessage: 'empty_assistant_turn',
      generic: true,
      actionRequired: false,
    });
  });

  it('keeps protocol proof failures above generic runtime noise', () => {
    const selected = selectRuntimeDiagnosticClassification([
      'OpenCode bridge command timed out',
      'visible_reply_missing_task_refs',
    ]);

    expect(selected).toMatchObject({
      reasonCode: 'protocol_proof_missing',
      normalizedMessage: 'visible_reply_missing_task_refs',
      generic: true,
      actionRequired: false,
    });
  });
});
