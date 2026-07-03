/**
 * IPC Handlers for runtime model pricing.
 *
 * Handlers:
 * - pricing:getRuntimeOverrides: Returns the runtime-refreshed pricing map (or null)
 *
 * Events (main -> renderer):
 * - pricing:runtimeUpdated: Emitted after a successful background pricing refresh
 */

import { createLogger } from '@shared/utils/logger';
import { BrowserWindow, type IpcMain } from 'electron';

import type { PricingRefreshService } from '../services/infrastructure/PricingRefreshService';

const logger = createLogger('IPC:pricing');

export const PRICING_GET_RUNTIME_OVERRIDES = 'pricing:getRuntimeOverrides';
export const PRICING_RUNTIME_UPDATED = 'pricing:runtimeUpdated';

let pricingRefreshService: PricingRefreshService | null = null;
let unsubscribeUpdates: (() => void) | null = null;

export function initializePricingHandlers(service: PricingRefreshService): void {
  pricingRefreshService = service;
  unsubscribeUpdates?.();
  unsubscribeUpdates = service.onUpdated((models) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(PRICING_RUNTIME_UPDATED, models);
      }
    }
  });
}

export function registerPricingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(PRICING_GET_RUNTIME_OVERRIDES, () => {
    return pricingRefreshService?.getRuntimeOverrides() ?? null;
  });

  logger.info('Pricing handlers registered');
}

export function removePricingHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler(PRICING_GET_RUNTIME_OVERRIDES);
  unsubscribeUpdates?.();
  unsubscribeUpdates = null;
  pricingRefreshService = null;

  logger.info('Pricing handlers removed');
}
