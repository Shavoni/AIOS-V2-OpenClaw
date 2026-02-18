describe("MessageStore", () => {
  let db, store;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);

    const { MessageStore } = require("../../src/memory/store");
    store = new MessageStore(db, () => {});
  });

  afterAll(() => {
    if (db) db.close();
  });

  test("creates a session", () => {
    const session = store.createSession("Test Chat", "main");
    expect(session.id).toBeTruthy();
    expect(session.title).toBe("Test Chat");
    expect(session.profile).toBe("main");
  });

  test("lists sessions", () => {
    const sessions = store.listSessions();
    expect(sessions.length).toBeGreaterThan(0);
  });

  test("adds and retrieves messages", () => {
    const session = store.createSession("Msg Test", "main");
    store.addMessage(session.id, "user", "Hello");
    store.addMessage(session.id, "assistant", "Hi there");
    const messages = store.getMessages(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  test("deletes a session", () => {
    const session = store.createSession("Delete Me", "main");
    store.deleteSession(session.id);
    const sessions = store.listSessions();
    const found = sessions.find(s => s.id === session.id);
    expect(found).toBeUndefined();
  });

  test("getRecentMessages respects token budget", () => {
    const session = store.createSession("Budget Test", "main");
    for (let i = 0; i < 50; i++) {
      store.addMessage(session.id, "user", "Message " + i + " with some content to fill tokens");
    }
    const recent = store.getRecentMessages(session.id, 100);
    expect(recent.length).toBeLessThan(50);
    expect(recent.length).toBeGreaterThan(0);
  });

  test("adds audit log entries", () => {
    expect(() => {
      store.addAuditLog({
        sessionId: "test",
        action: "chat",
        intentDomain: "General",
        riskSignals: [],
        hitlMode: "INFORM",
        provider: "test",
        model: "test-model",
      });
    }).not.toThrow();
  });
});
