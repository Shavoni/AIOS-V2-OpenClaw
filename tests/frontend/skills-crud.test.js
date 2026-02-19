/**
 * Skills CRUD — Frontend API client tests
 */

describe("Skills API Client CRUD", () => {
  let api, fetchMock, state;

  beforeEach(() => {
    state = { set: jest.fn(), get: jest.fn(() => []) };
    fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "test", name: "Test" }) })
    );
    global.fetch = fetchMock;

    // Minimal API client that mirrors the real one
    api = {
      state,
      _post: (url, body) => fetch(url, { method: "POST", body: JSON.stringify(body) }).then(r => r.json()),
      _put: (url, body) => fetch(url, { method: "PUT", body: JSON.stringify(body) }).then(r => r.json()),
      _delete: (url) => fetch(url, { method: "DELETE" }).then(r => r.json()),
      _get: (url) => fetch(url).then(r => r.json()),
      fetchSkills: jest.fn(() => Promise.resolve([])),

      async createSkill(data) {
        const result = await this._post("/api/skills", data);
        await this.fetchSkills();
        return result;
      },
      async updateSkill(id, data) {
        const result = await this._put(`/api/skills/${encodeURIComponent(id)}`, data);
        await this.fetchSkills();
        return result;
      },
      async deleteSkill(id) {
        const result = await this._delete(`/api/skills/${encodeURIComponent(id)}`);
        await this.fetchSkills();
        return result;
      },
    };
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("createSkill calls POST /api/skills", async () => {
    await api.createSkill({ id: "new-skill", name: "New Skill" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/skills",
      expect.objectContaining({ method: "POST" })
    );
    expect(api.fetchSkills).toHaveBeenCalled();
  });

  test("updateSkill calls PUT /api/skills/:id", async () => {
    await api.updateSkill("my-skill", { name: "Updated" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/skills/my-skill",
      expect.objectContaining({ method: "PUT" })
    );
    expect(api.fetchSkills).toHaveBeenCalled();
  });

  test("deleteSkill calls DELETE /api/skills/:id", async () => {
    await api.deleteSkill("old-skill");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/skills/old-skill",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(api.fetchSkills).toHaveBeenCalled();
  });
});
