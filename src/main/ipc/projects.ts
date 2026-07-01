/**
 * IPC Handlers for Project Operations.
 *
 * Handlers:
 * - get-projects: List all projects
 * - get-repository-groups: List projects grouped by git repository
 * - get-worktree-sessions: List sessions for a specific worktree
 */

import {
  PROJECT_LIST_FILES,
  // eslint-disable-next-line boundaries/element-types -- IPC channel constants are shared between main and preload by design
} from '@preload/constants/ipcChannels';
import { createLogger } from '@shared/utils/logger';
import { type IpcMain, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

import { FileSearchService } from '../services/editor';
import { setCurrentMainOp } from '../services/infrastructure/EventLoopLagMonitor';
import { type Project, type RepositoryGroup, type Session } from '../types';

import { validateProjectId } from './guards';
import { createIpcWrapper } from './ipcWrapper';

import type { ServiceContextRegistry } from '../services';
import type { QuickOpenFile } from '@shared/types/editor';
import type { IpcResult } from '@shared/types/ipc';

const logger = createLogger('IPC:projects');

const fileSearchService = new FileSearchService();
const wrapListFiles = createIpcWrapper('IPC:projects');

const MISSING_PROJECT_PATH_ERROR_CODES = new Set(['ENOENT', 'ENOTDIR']);

function getFileSystemErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function isMissingProjectPathError(error: unknown): boolean {
  return MISSING_PROJECT_PATH_ERROR_CODES.has(getFileSystemErrorCode(error) ?? '');
}

// Service registry - set via initialize
let registry: ServiceContextRegistry;

/**
 * Initializes project handlers with service registry.
 */
export function initializeProjectHandlers(contextRegistry: ServiceContextRegistry): void {
  registry = contextRegistry;
}

/**
 * Registers all project-related IPC handlers.
 */
export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-projects', handleGetProjects);
  ipcMain.handle('get-repository-groups', handleGetRepositoryGroups);
  ipcMain.handle('get-worktree-sessions', handleGetWorktreeSessions);
  ipcMain.handle(PROJECT_LIST_FILES, handleProjectListFiles);

  logger.info('Project handlers registered');
}

/**
 * Removes all project IPC handlers.
 */
export function removeProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler('get-projects');
  ipcMain.removeHandler('get-repository-groups');
  ipcMain.removeHandler('get-worktree-sessions');
  ipcMain.removeHandler(PROJECT_LIST_FILES);

  logger.info('Project handlers removed');
}

// =============================================================================
// Handler Implementations
// =============================================================================

/**
 * Handler for 'get-projects' IPC call.
 * Lists all projects from ~/.claude/projects/
 */
async function handleGetProjects(_event: IpcMainInvokeEvent): Promise<Project[]> {
  setCurrentMainOp('projects:getProjects');
  const startedAt = Date.now();
  const watchdogMs = 10_000;
  const watchdog = setTimeout(() => {
    logger.warn(`get-projects still running after ${watchdogMs}ms`);
  }, watchdogMs);
  try {
    const { projectScanner } = registry.getActive();
    const projects = await projectScanner.scan();
    return projects;
  } catch (error) {
    logger.error('Error in get-projects:', error);
    return [];
  } finally {
    clearTimeout(watchdog);
    const ms = Date.now() - startedAt;
    if (ms >= 1500) {
      logger.warn(`get-projects slow ms=${ms}`);
    }
    setCurrentMainOp(null);
  }
}

/**
 * Handler for 'get-repository-groups' IPC call.
 * Lists all projects grouped by git repository.
 * Worktrees of the same repo are grouped together.
 */
async function handleGetRepositoryGroups(_event: IpcMainInvokeEvent): Promise<RepositoryGroup[]> {
  setCurrentMainOp('projects:getRepositoryGroups');
  const startedAt = Date.now();
  const watchdogMs = 10_000;
  const watchdog = setTimeout(() => {
    logger.warn(`get-repository-groups still running after ${watchdogMs}ms`);
  }, watchdogMs);
  try {
    const { projectScanner } = registry.getActive();
    const groups = await projectScanner.scanWithWorktreeGrouping();
    return groups;
  } catch (error) {
    logger.error('Error in get-repository-groups:', error);
    return [];
  } finally {
    clearTimeout(watchdog);
    const ms = Date.now() - startedAt;
    if (ms >= 2000) {
      logger.warn(`get-repository-groups slow ms=${ms}`);
    }
    setCurrentMainOp(null);
  }
}

/**
 * Handler for 'get-worktree-sessions' IPC call.
 * Lists all sessions for a specific worktree within a repository group.
 */
async function handleGetWorktreeSessions(
  _event: IpcMainInvokeEvent,
  worktreeId: string
): Promise<Session[]> {
  try {
    const validatedProject = validateProjectId(worktreeId);
    if (!validatedProject.valid) {
      logger.error(
        `get-worktree-sessions rejected: ${validatedProject.error ?? 'Invalid worktreeId'}`
      );
      return [];
    }

    const { projectScanner } = registry.getActive();
    const sessions = await projectScanner.listWorktreeSessions(validatedProject.value!);
    return sessions;
  } catch (error) {
    logger.error(`Error in get-worktree-sessions for ${worktreeId}:`, error);
    return [];
  }
}

/**
 * List project files by explicit path (for @file mentions).
 * Independent of editor state.
 */
async function handleProjectListFiles(
  _event: IpcMainInvokeEvent,
  projectPath: string
): Promise<IpcResult<QuickOpenFile[]>> {
  return wrapListFiles('project:listFiles', async () => {
    if (typeof projectPath !== 'string' || projectPath.length === 0) {
      throw new Error('projectPath is required');
    }
    const normalized = path.resolve(projectPath);
    const stat = await fs.stat(normalized).catch((error: unknown) => {
      if (isMissingProjectPathError(error)) {
        return null;
      }
      throw error;
    });
    if (!stat?.isDirectory()) {
      return [];
    }
    return fileSearchService.listFiles(normalized);
  });
}
