// Cross-team message protocol constants.
// Mirror of src/shared/constants/crossTeam.ts — keep in sync.

const CROSS_TEAM_PREFIX_TAG = 'Cross-team from';
const CROSS_TEAM_SOURCE = 'cross_team';
const CROSS_TEAM_SENT_SOURCE = 'cross_team_sent';

function formatCrossTeamPrefix(from, chainDepth) {
  return `[${CROSS_TEAM_PREFIX_TAG} ${from} | depth:${chainDepth}]`;
}

function formatCrossTeamText(from, chainDepth, text) {
  return `${formatCrossTeamPrefix(from, chainDepth)}\n${text}`;
}

module.exports = {
  CROSS_TEAM_PREFIX_TAG,
  CROSS_TEAM_SOURCE,
  CROSS_TEAM_SENT_SOURCE,
  formatCrossTeamPrefix,
  formatCrossTeamText,
};
