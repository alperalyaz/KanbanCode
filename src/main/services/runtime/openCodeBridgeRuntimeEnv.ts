import { getErrorMessage } from '@shared/utils/errorHandling';

import {
  applyOpenCodeRuntimeBinaryEnv,
  OPENCODE_LEGACY_BINARY_PATH_ENV,
  OPENCODE_RUNTIME_BINARY_PATH_ENV,
} from './openCodeRuntimeBinaryEnv';

export interface EnsureOpenCodeBridgeRuntimeBinaryEnvOptions {
  targetEnv: NodeJS.ProcessEnv;
  bridgeEnv?: NodeJS.ProcessEnv;
  resolveVerifiedAppManagedOpenCodeRuntimeBinaryPath: () => Promise<string | null>;
  onWarning?: (message: string) => void;
}

export async function ensureOpenCodeBridgeRuntimeBinaryEnv({
  targetEnv,
  bridgeEnv = targetEnv,
  resolveVerifiedAppManagedOpenCodeRuntimeBinaryPath,
  onWarning,
}: EnsureOpenCodeBridgeRuntimeBinaryEnvOptions): Promise<void> {
  if (
    targetEnv[OPENCODE_RUNTIME_BINARY_PATH_ENV]?.trim() ||
    targetEnv[OPENCODE_LEGACY_BINARY_PATH_ENV]?.trim()
  ) {
    applyOpenCodeRuntimeBinaryEnv(targetEnv, null);
    return;
  }

  try {
    const appManagedOpenCodeBinary = await resolveVerifiedAppManagedOpenCodeRuntimeBinaryPath();
    applyOpenCodeRuntimeBinaryEnv(targetEnv, appManagedOpenCodeBinary);
    if (
      targetEnv !== bridgeEnv &&
      targetEnv[OPENCODE_RUNTIME_BINARY_PATH_ENV] &&
      !bridgeEnv[OPENCODE_RUNTIME_BINARY_PATH_ENV]
    ) {
      applyOpenCodeRuntimeBinaryEnv(bridgeEnv, targetEnv[OPENCODE_RUNTIME_BINARY_PATH_ENV]);
    }
  } catch (error) {
    onWarning?.(
      `[OpenCode] Runtime adapter bundled OpenCode binary unresolved: ${getErrorMessage(error)}`
    );
  }
}
