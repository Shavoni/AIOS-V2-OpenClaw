const { MessageHandler } = require("./message-handler");
const { createChatRoutes } = require("./routes");
const { setupSocket } = require("./socket");

module.exports = { MessageHandler, createChatRoutes, setupSocket };
