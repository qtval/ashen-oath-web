const SAVE_KEY = "ashen-oath-web-save-v1";
const app = document.querySelector("#app");
let chapter;
let state;

const freshState = () => ({ version: 1, nodeId: null, values: {}, history: [] });

function canChoose(choice) {
  const requiredStateMatches = !choice.requires
    || Object.entries(choice.requires).every(([key, expected]) => state.values[key] === expected);
  const alternativeStateMatches = !choice.requires_any
    || choice.requires_any.some((requirements) => Object.entries(requirements).every(
      ([key, expected]) => state.values[key] === expected,
    ));
  return requiredStateMatches && alternativeStateMatches;
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
  // CSS resolves image URLs relative to web/styles.css, hence the parent path.
  const artPath = node.panel_image || "../assets/panels/checkpoint-rain-v1.png";
  const choices = (node.choices || []).map((choice, index) => {
    const available = canChoose(choice);
    return `<button class="choice" data-choice="${index}" type="button" ${available ? "" : "disabled"}>${choice.text}${available ? "" : " <em>(not available)</em>"}</button>`;
  }).join("");

  app.innerHTML = `
    <section id="story" class="story" tabindex="-1" style="--scene-image: url('${artPath}')">
      <div class="scene-shade" aria-hidden="true"></div>
      <header class="topbar">
        <p class="eyebrow">The Ashen Oath &middot; Chapter One</p>
        <nav class="utility" aria-label="Game controls">
          <button id="save" type="button">Save</button>
          <button id="restart" type="button">Restart</button>
        </nav>
      </header>
      <div class="story-content">
        <article class="dialogue">
          <p class="speaker">${node.speaker || "Narration"}</p>
          <p class="text">${node.text}</p>
        </article>
        ${ending
          ? `<section class="ending" aria-label="Ending"><h1>${node.ending}</h1><p>The road continues, but this chapter ends here.</p><button class="restart" id="ending-restart" type="button">Begin again</button></section>`
          : `<div class="choices" role="group" aria-label="Choices">${choices}</div>`}
      </div>
      <footer class="footer"><span>${chapter.chapter}</span><span>Decision ${state.history.length + 1}</span></footer>
    </section>`;

  document.querySelector("#save")?.addEventListener("click", () => {
    persist();
    announce("Progress saved.");
  });
  document.querySelectorAll("#restart, #ending-restart").forEach((button) => button.addEventListener("click", restart));
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

