import * as agentTeamsControllerModule from 'agent-teams-controller';

const { createController } = agentTeamsControllerModule;

export function getController(teamName: string, claudeDir?: string) {
  return createController({
    teamName,
    ...(claudeDir ? { claudeDir } : {}),
  });
}
