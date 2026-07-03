/**
 * Runtime pricing bootstrap for the renderer.
 *
 * The main process refreshes model pricing from LiteLLM (daily, cached in
 * userData). The renderer bundles its own copy of the pricing module, so it
 * pulls the current overrides once at startup and then listens for refresh
 * events. Without the bridge (tests, standalone) bundled pricing stays active.
 */

import { applyPricingOverrides } from '@shared/utils/pricing';

export function initializeRuntimePricing(): void {
  const pricingApi = window.electronAPI?.pricing;
  if (!pricingApi) {
    return;
  }

  void pricingApi
    .getRuntimeOverrides()
    .then((overrides) => {
      if (overrides) {
        applyPricingOverrides(overrides);
      }
    })
    .catch(() => {
      // Bundled pricing remains in effect.
    });

  pricingApi.onRuntimeUpdated((models) => {
    applyPricingOverrides(models);
  });
}
