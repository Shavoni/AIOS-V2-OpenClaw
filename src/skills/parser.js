const matter = require("gray-matter");

function parseSkillMd(content, id) {
  const { data, content: body } = matter(content);

  return {
    id,
    name: data.name || id,
    description: data.description || "",
    version: data.version || "1.0.0",
    author: data.author || "",
    tags: data.tags || [],
    capabilities: extractCapabilities(body),
    commands: extractCommands(body),
    body: body.trim(),
    metadata: data,
  };
}

function extractCapabilities(body) {
  const caps = [];
  const section = body.match(/##\s*Capabilities\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (section) {
    const lines = section[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*[-*]\s+(.+)/);
      if (match) caps.push(match[1].trim());
    }
  }
  return caps;
}

function extractCommands(body) {
  const cmds = [];
  const matches = body.matchAll(/`([^`]+)`/g);
  for (const m of matches) {
    if (m[1].startsWith("/") || m[1].includes(" ")) {
      cmds.push(m[1]);
    }
  }
  return [...new Set(cmds)];
}

module.exports = { parseSkillMd, extractCapabilities, extractCommands };
