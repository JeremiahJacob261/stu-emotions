const storageKey = "student-emotion-coach:v1";
const chatLog = document.querySelector("#chatLog");
const form = document.querySelector("#composer");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearButton");
const topSignals = document.querySelector("#topSignals");
const allSignals = document.querySelector("#allSignals");
const riskBadge = document.querySelector("#riskBadge");

let turns = loadTurns();
render();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) {
    return;
  }

  const turn = {
    id: crypto.randomUUID(),
    studentMessage: message,
    assistantMessage: "",
    nextSteps: [],
    emotions: [],
    topEmotions: [],
    riskLevel: "none",
    pending: true
  };

  turns.push(turn);
  input.value = "";
  setPending(true);
  persist();
  render();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        history: buildHistory(turn.id)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    Object.assign(turn, {
      assistantMessage: data.assistantMessage,
      nextSteps: data.nextSteps || [],
      emotions: data.emotions || [],
      topEmotions: data.topEmotions || [],
      riskLevel: data.riskLevel || "none",
      pending: false
    });
  } catch (error) {
    Object.assign(turn, {
      assistantMessage: "",
      nextSteps: [],
      pending: false,
      error: error instanceof Error ? error.message : "Something went wrong."
    });
  } finally {
    setPending(false);
    persist();
    render();
  }
});

clearButton.addEventListener("click", () => {
  turns = [];
  persist();
  render();
  input.focus();
});

function buildHistory(activeId) {
  return turns
    .filter((turn) => turn.id !== activeId && !turn.pending && !turn.error)
    .flatMap((turn) => [
      { role: "student", content: turn.studentMessage },
      { role: "assistant", content: turn.assistantMessage }
    ])
    .filter((item) => item.content)
    .slice(-8);
}

function render() {
  if (turns.length === 0) {
    chatLog.innerHTML = '<div class="empty-state">Start with one honest sentence.</div>';
  } else {
    chatLog.innerHTML = turns.map(renderTurn).join("");
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  renderSignals(getLatestCompleteTurn());
}

function renderTurn(turn) {
  const assistant = turn.pending
    ? '<div class="bubble assistant loading">Checking the emotional signal...</div>'
    : turn.error
      ? `<div class="bubble assistant">${escapeHtml(turn.error)}</div>`
      : `<div class="bubble assistant">${escapeHtml(turn.assistantMessage)}</div>${renderSteps(turn.nextSteps)}`;

  return `
    <article class="turn">
      <div class="bubble student">${escapeHtml(turn.studentMessage)}</div>
      ${renderMiniBars(turn.topEmotions)}
      ${assistant}
    </article>
  `;
}

function renderMiniBars(emotions) {
  if (!Array.isArray(emotions) || emotions.length === 0) {
    return "";
  }

  const rows = emotions.slice(0, 5).map(renderScoreRow).join("");
  return `<div class="turn-meta"><div class="mini-bars">${rows}</div></div>`;
}

function renderSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return "";
  }

  return `<ol class="next-steps">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`;
}

function renderSignals(turn) {
  if (!turn || !Array.isArray(turn.emotions) || turn.emotions.length === 0) {
    riskBadge.textContent = "none";
    riskBadge.className = "risk-badge";
    topSignals.innerHTML = '<span class="muted">No signal yet</span>';
    allSignals.innerHTML = "";
    return;
  }

  riskBadge.textContent = turn.riskLevel || "none";
  riskBadge.className = `risk-badge ${turn.riskLevel || ""}`.trim();

  const top = Array.isArray(turn.topEmotions) && turn.topEmotions.length > 0
    ? turn.topEmotions
    : turn.emotions.slice(0, 3);

  topSignals.innerHTML = top
    .map((emotion) => `<span class="signal-chip">${escapeHtml(emotion.label)} ${formatScore(emotion.score)}</span>`)
    .join("");

  allSignals.innerHTML = turn.emotions.map(renderScoreRow).join("");
}

function renderScoreRow(emotion) {
  const score = clampScore(emotion.score);
  return `
    <div class="score-row">
      <span>${escapeHtml(emotion.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="--score: ${score}%"></span></span>
      <span>${formatScore(score)}</span>
    </div>
  `;
}

function getLatestCompleteTurn() {
  return [...turns].reverse().find((turn) => !turn.pending && !turn.error && turn.emotions?.length);
}

function setPending(pending) {
  sendButton.disabled = pending;
  input.disabled = pending;
}

function loadTurns() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(turns.slice(-12)));
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(number * 10) / 10));
}

function formatScore(value) {
  return `${clampScore(value).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
