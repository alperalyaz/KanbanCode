import {
  setStoredCreateTeamModel,
  setStoredCreateTeamProvider,
} from '@renderer/services/createTeamPreferences';

export function saveOpenCodeModelForNewTeams(modelId: string): void {
  setStoredCreateTeamProvider('opencode');
  setStoredCreateTeamModel('opencode', modelId);
}
