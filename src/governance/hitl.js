const HITL_MODES = {
  INFORM: "INFORM",
  DRAFT: "DRAFT",
  ESCALATE: "ESCALATE",
};

function higherMode(a, b) {
  const order = { INFORM: 0, DRAFT: 1, ESCALATE: 2 };
  return (order[a] || 0) >= (order[b] || 0) ? a : b;
}

module.exports = { HITL_MODES, higherMode };
