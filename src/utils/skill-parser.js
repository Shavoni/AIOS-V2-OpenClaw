function parseSkillFrontmatter(content) {
  const frontmatter = {};
  let body = content;

  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (match) {
    const yamlBlock = match[1];
    body = match[2];

    for (const line of yamlBlock.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      // Strip quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value === "true") value = true;
      else if (value === "false") value = false;
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: body.trim() };
}

function parseMetaJson(content) {
  if (typeof content === "string") {
    content = JSON.parse(content);
  }
  return {
    ownerId: content.ownerId || "",
    slug: content.slug || "",
    version: content.version || "0.0.0",
    publishedAt: content.publishedAt || null,
  };
}

module.exports = { parseSkillFrontmatter, parseMetaJson };
