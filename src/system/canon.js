const { v4: uuidv4 } = require("uuid");

class CanonService {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  listDocuments() {
    const results = this.db.exec(
      "SELECT * FROM canon_documents ORDER BY uploaded_at DESC"
    );
    if (!results.length) return [];
    return this._rowsToObjects(results[0]);
  }

  getDocument(id) {
    const stmt = this.db.prepare("SELECT * FROM canon_documents WHERE id = ?");
    stmt.bind([id]);
    let doc = null;
    if (stmt.step()) {
      doc = stmt.getAsObject();
    }
    stmt.free();
    return doc;
  }

  addDocument(doc) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO canon_documents (id, filename, content, file_type, file_size)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        doc.filename || "untitled.md",
        doc.content || "",
        doc.file_type || "text",
        doc.file_size || (doc.content || "").length,
      ]
    );
    if (this.saveFn) this.saveFn();
    return this.getDocument(id);
  }

  deleteDocument(id) {
    this.db.run("DELETE FROM canon_documents WHERE id = ?", [id]);
    if (this.saveFn) this.saveFn();
    return { ok: true };
  }

  getAllCanonText() {
    const docs = this.listDocuments();
    return docs.map((d) => `--- ${d.filename} ---\n${d.content}`).join("\n\n");
  }

  _rowsToObjects(result) {
    const { columns, values } = result;
    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }
}

module.exports = { CanonService };
