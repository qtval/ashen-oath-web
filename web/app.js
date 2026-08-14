const SAVE_KEY = "ashen-oath-web-save-v1";
const PREFERENCES_KEY = "ashen-oath-web-preferences-v1";
const TEXT_SIZES = ["normal", "large", "extra-large"];
const app = document.querySelector("#app");
let chapter;
let state;
let preferences = loadPreferences();

const freshState = () => ({ version: 1, nodeId: null, values: {}, history: [] });

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "null");
    return {
      version: 1,
      textSize: TEXT_SIZES.includes(saved?.textSize) ? saved.textSize : "normal",
      reducedMotion: saved?.reducedMotion === true,
    };
  } catch {
    return { version: 1, textSize: "normal", reducedMotion: false };
  }
}

function persistPreferences() {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

function applyPreferences() {
  document.documentElement.dataset.textSize = preferences.textSize;
  document.documentElement.classList.toggle("reduce-motion", preferences.reducedMotion);
}

applyPreferences();

function canChoose(choice) {
  const requiredStateMatches = !choice.requires
    || Object.entries(choice.requires).every(([key, expected]) => state.values[key] === expected);
  const alternativeStateMatches = !choice.requires_any
    || choice.requires_any.some((requirements) => Object.entries(requirements).every(
      ([key, expected]) => state.values[key] === expected,
    ));
  return requiredStateMatches && alternativeStateMatches;
}

function nodeText(node) {
  const summaryGroups = chapter.ending_summary_groups?.[node.id];
  const rememberedText = (node.conditional_text || [])
    .filter((fragment) => canChoose(fragment)
      && (!summaryGroups || summaryGroups.includes(fragment.group)))
    .map(({ text }) => text);
  return [node.text, ...rememberedText]
    .map((text, index) => `<p class="text${index === 0 ? "" : " remembered"}">${text}</p>`)
    .join("");
}

function chronicleContent() {
  const visitedNodes = new Set([
    state.nodeId,
    ...state.history.flatMap(({ from, to }) => [from, to]),
  ]);
  const sections = (chapter.chronicle?.sections || []).map((section) => {
    const entries = section.entries.filter((entry) => {
      const visitMatches = !entry.available_from
        || entry.available_from.some((nodeId) => visitedNodes.has(nodeId));
      return visitMatches && canChoose(entry);
    });
    if (entries.length === 0) return "";
    return `<section class="chronicle-section" aria-labelledby="chronicle-${section.id}">
      <h3 id="chronicle-${section.id}">${section.title}</h3>
      <ul>${entries.map(({ text }) => `<li>${text}</li>`).join("")}</ul>
    </section>`;
  }).join("");
  return sections || `<p class="chronicle-empty">${chapter.chronicle?.empty_text || "Nothing recorded yet."}</p>`;
}

function applyEffects(effects = {}) {
  for (const [key, value] of Object.entries(effects)) {
    state.values[key] = typeof value === "number" ? (Number(state.values[key]) || 0) + value : value;
  }
}

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved?.version === 1 && saved.nodeId && chapter.nodes.some((node) => node.id === saved.nodeId)) return saved;
  } catch {
    // A damaged or obsolete save starts a clean game.
  }
  const next = freshState();
  next.nodeId = chapter.nodes[0].id;
  return next;
}

function render() {
  const node = chapter.nodes.find((item) => item.id === state.nodeId);
  if (!node) return renderError("The story could not find its next scene.");

  const ending = Boolean(node.ending);
  const chronicle = chronicleContent();
  const textSizeOptions = [
    ["normal", "Normal"],
    ["large", "Large"],
    ["extra-large", "Extra large"],
  ].map(([value, label]) => `<option value="${value}" ${preferences.textSize === value ? "selected" : ""}>${label}</option>`).join("");
  // CSS resolves image URLs relative to web/styles.css, hence the parent path.
  const artPath = node.panel_image || "../assets/panels/checkpoint-rain-v2.png";
  const speaker = chapter.narration_nodes?.includes(node.id) ? "" : node.speaker;
  const choices = (node.choices || []).map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => canChoose(choice))
    .map(({ choice, index }) => `<button class="choice" data-choice="${index}" type="button">${choice.text}</button>`)
    .join("");

  app.innerHTML = `
    <section id="story" class="story" tabindex="-1" style="--scene-image: url('${artPath}')">
      <div class="scene-shade" aria-hidden="true"></div>
      <header class="topbar">
        <p class="eyebrow">The Ashen Oath &middot; Chapter One</p>
        <nav class="utility" aria-label="Game controls">
          <button id="chronicle" type="button">Chronicle</button>
          <button id="settings" type="button">Settings</button>
          <button id="save" type="button">Save</button>
          <button id="restart" type="button">Restart</button>
        </nav>
      </header>
      <div class="story-content">
        ${ending ? `<section class="ending" aria-label="Ending"><h1>${node.ending}</h1>` : ""}
        <article class="dialogue">
          <p class="speaker">${speaker || "Narration"}</p>
          ${nodeText(node)}
        </article>
        ${ending
          ? `<p class="ending-close">The road continues, but this chapter ends here.</p><button class="restart" id="ending-restart" type="button">Begin again</button></section>`
          : `<div class="continue-prompt"><button class="continue" id="continue" type="button" aria-controls="choices" aria-expanded="false">Continue <span aria-hidden="true">\u2192</span></button></div>
            <div class="choices" id="choices" role="group" aria-label="Choices" hidden>${choices}</div>`}
      </div>
      <footer class="footer"><span>${chapter.chapter}</span><span>Decision ${state.history.length + 1}</span></footer>
      <dialog class="game-dialog" id="settings-dialog" aria-labelledby="settings-title" aria-describedby="settings-description">
        <form method="dialog" class="dialog-panel">
          <div class="dialog-heading">
            <p class="dialog-kicker">Reader</p>
            <h2 id="settings-title">Settings</h2>
            <p id="settings-description">Adjust how the chapter is presented. Story progress is saved separately.</p>
          </div>
          <label class="setting-control" for="text-size">
            <span>Text size</span>
            <select id="text-size" name="text-size">${textSizeOptions}</select>
          </label>
          <label class="setting-toggle" for="reduced-motion">
            <input id="reduced-motion" name="reduced-motion" type="checkbox" ${preferences.reducedMotion ? "checked" : ""} />
            <span><strong>Reduce motion</strong><small>Stops panel drift and interface transitions. Your device preference is also respected.</small></span>
          </label>
          <div class="dialog-actions"><button class="dialog-action" value="done">Done</button></div>
        </form>
      </dialog>
      <dialog class="game-dialog chronicle-dialog" id="chronicle-dialog" aria-labelledby="chronicle-title" aria-describedby="chronicle-description">
        <form method="dialog" class="dialog-panel">
          <div class="dialog-heading">
            <p class="dialog-kicker">Current knowledge</p>
            <h2 id="chronicle-title">Chronicle</h2>
            <p id="chronicle-description">Only what Garren has learned during this run is recorded here.</p>
          </div>
          <div class="chronicle-content">${chronicle}</div>
          <div class="dialog-actions"><button class="dialog-action" value="done">Done</button></div>
        </form>
      </dialog>
      <dialog class="game-dialog" id="restart-dialog" aria-labelledby="restart-title" aria-describedby="restart-description">
        <form method="dialog" class="dialog-panel">
          <div class="dialog-heading">
            <p class="dialog-kicker">Current run</p>
            <h2 id="restart-title">Begin again?</h2>
            <p id="restart-description">Your current Chapter One progress will be replaced. Reader settings will remain unchanged.</p>
          </div>
          <div class="dialog-actions">
            <button class="dialog-action" value="cancel">Keep playing</button>
            <button class="dialog-action danger" id="confirm-restart" value="restart">Restart chapter</button>
          </div>
        </form>
      </dialog>
    </section>`;

  const settingsDialog = document.querySelector("#settings-dialog");
  const chronicleDialog = document.querySelector("#chronicle-dialog");
  const restartDialog = document.querySelector("#restart-dialog");
  document.querySelector("#chronicle")?.addEventListener("click", () => chronicleDialog?.showModal());
  document.querySelector("#settings")?.addEventListener("click", () => settingsDialog?.showModal());
  document.querySelector("#text-size")?.addEventListener("change", (event) => {
    if (!TEXT_SIZES.includes(event.target.value)) return;
    preferences = { ...preferences, textSize: event.target.value };
    persistPreferences();
    applyPreferences();
  });
  document.querySelector("#reduced-motion")?.addEventListener("change", (event) => {
    preferences = { ...preferences, reducedMotion: event.target.checked };
    persistPreferences();
    applyPreferences();
  });
  document.querySelector("#save")?.addEventListener("click", () => {
    persist();
    announce("Progress saved.");
  });
  document.querySelector("#restart")?.addEventListener("click", () => {
    if (state.history.length === 0 || ending) return restart();
    restartDialog?.showModal();
  });
  document.querySelector("#ending-restart")?.addEventListener("click", restart);
  document.querySelector("#confirm-restart")?.addEventListener("click", (event) => {
    event.preventDefault();
    restartDialog?.close();
    restart();
  });
  const story = document.querySelector("#story");
  const continueButton = document.querySelector("#continue");
  const choicesElement = document.querySelector("#choices");
  const revealChoices = () => {
    if (!continueButton || !choicesElement || !choicesElement.hidden) return;
    choicesElement.hidden = false;
    continueButton.hidden = true;
    continueButton.setAttribute("aria-expanded", "true");
    choicesElement.querySelector(".choice:not(:disabled)")?.focus();
  };
  continueButton?.addEventListener("click", revealChoices);
  story?.addEventListener("keydown", (event) => {
    if (event.target !== story || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    revealChoices();
  });
  document.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => choose(Number(button.dataset.choice))));
}

function choose(index) {
  const node = chapter.nodes.find((item) => item.id === state.nodeId);
  const choice = node?.choices?.[index];
  if (!choice || !canChoose(choice)) return;
  applyEffects(choice.effects);
  state.history.push({ from: node.id, choice: choice.text, to: choice.next });
  state.nodeId = choice.next;
  persist();
  render();
  document.querySelector("#story")?.focus();
}

function restart() {
  state = freshState();
  state.nodeId = chapter.nodes[0].id;
  persist();
  render();
}

function announce(message) {
  const live = document.createElement("div");
  live.setAttribute("role", "status");
  live.textContent = message;
  live.style.position = "absolute";
  live.style.left = "-9999px";
  document.body.append(live);
  setTimeout(() => live.remove(), 1200);
}

function renderError(message) {
  app.innerHTML = `<section class="status-screen"><p>${message}</p></section>`;
}

fetch(document.body.dataset.story || "data/chapters/chapter_01.json")
  .then((response) => {
    if (!response.ok) throw new Error("Story request failed");
    return response.json();
  })
  .then((data) => {
    chapter = data;
    state = loadState();
    render();
  })
  .catch(() => renderError("The story could not be loaded. Open it through a local web server or GitHub Pages."));

