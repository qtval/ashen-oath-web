# The Ashen Oath - Web Prototype

> A grim, choice-driven medieval narrative game where truth can be more dangerous than war.

This is the browser-first prototype for **The Ashen Oath**. It is deliberately small: a portrait-friendly interactive story reader and the opening checkpoint chapter. The purpose is to make the narrative satisfying before we add final artwork, sound, or an Android package.

## Play it

Open the project through any simple local web server, then visit the address it gives you. Do not double-click `index.html`: browsers block the story file from loading that way.

If Python is installed, run this from the project folder:

```text
python -m http.server 8000
```

Then open `http://localhost:8000`.

The game is designed for a phone-sized portrait window, but also works on desktop.

## What is playable today

- A branching opening chapter: **The Carrion Road**
- Twenty-six narrative scenes and five endings
- Choices with hidden flags, traits, relationships, and delayed consequences
- Automatic local progress saving, plus manual save and restart controls
- A black-and-white, environment-first visual placeholder system

## Project structure

```text
index.html                  Entry point
web/app.js                  Story reader and save logic
web/styles.css              Portrait-first interface styling
data/chapters/chapter_01.json  Chapter One narrative data
data/schemas/chapter_01_state.json  Chapter One state vocabulary and invariants
docs/PROJECT_CONTEXT.md      Permanent product and scope handoff
docs/ROADMAP.md             Product roadmap
scripts/validate-story.mjs  Story graph and asset validation
```

Story prose and choices belong in `data/`; the reader should remain generic. This keeps the content portable when we later package the web app for Android.

Read [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) before planning or implementing product work. It is the permanent handoff for the game's identity, story foundation, platform rule, visual direction, and scope constraints.

## Validate the project

Run the story validator before committing story-data changes:

```text
node scripts/validate-story.mjs
```

It checks schema basics, node IDs, choice destinations, state keys and values, requirements, reachability, ending paths, reconvergence declarations, and panel files. Run the validator's regression tests and the repository text check with:

```text
node --test scripts/validate-story.test.mjs
node scripts/check-text-encoding.mjs
```

## Roadmap

1. Validate the reader and publish a browser preview.
2. Add scene pacing, transitions, settings, and an accessible Chronicle.
3. Grow Chapter One into a 20-30 minute polished vertical slice with original grim political fantasy storytelling.
4. Add separate monochrome environment panels, sound, and music.
5. Package the stable web game for Android testing and, later, Google Play.

## Rights

The code is available under the MIT License. The story, characters, setting, and future artwork/audio are reserved by the project owner; they may not be reused without permission.
