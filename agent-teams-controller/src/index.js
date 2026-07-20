const controller = require('./controller.js');
const mcpToolCatalog = require('./mcpToolCatalog.js');
const memberMessagingProtocol = require('./internal/memberMessagingProtocol.js');

module.exports = {
  ...controller,
  ...mcpToolCatalog,
  createMemberMessagingProtocol: memberMessagingProtocol.createMemberMessagingProtocol,
  isCodexMember: memberMessagingProtocol.isCodexMember,
  isOpenCodeMember: memberMessagingProtocol.isOpenCodeMember,
};
