# The Ashen Oath - Living Roadmap

> Product goal: a portrait-first, choice-driven dark fantasy visual novel. It should feel like walking through an illustrated world where every promise, lie, and act of mercy can return later with a cost.

## How we use this document

- This is the project's source of truth for priorities and progress.
- We work on one small, testable task at a time. A task moves to done only after it works in the live browser preview.
- We update this document whenever a milestone changes status or we deliberately change scope.
- We protect the core: atmosphere, distinct characters, meaningful choices, and a smooth mobile reading experience matter more than extra systems.

## Product principles

1. **World before interface.** Each scene is a full-screen monochrome environmental panel. The player should feel the weather, architecture, distance, and tension before reading a word.
2. **Choices, not morality points.** Choices represent competing motives and imperfect information. We do not label options as good, evil, optimal, or plus-five trust.
3. **Consequences have memory.** Important actions affect people, evidence, faction pressure, access, and later scenes - not merely the next line of dialogue.
4. **Characters are people, not quest dispensers.** Every major character has a public goal, a private fear, a self-deception, and a breaking point.
5. **Mobile is the primary screen.** Portrait layout, one-thumb controls, legible type, fast resume, and calm interruption handling are requirements, not polish.
6. **Original work only.** We may learn from great grim fantasy and narrative games, but we do not copy their characters, plots, dialogue, factions, or visual identities.

## Current status

**Current milestone:** 0.2 - Immersive visual-novel reader  
**Playable preview:** https://qtval.github.io/ashen-oath-web/  
**Current chapter:** The Carrion Road - the checkpoint opening

Completed so far:

- Browser-first repository and live GitHub Pages preview
- JSON-driven branching story reader with local saves and restart
- Opening checkpoint narrative prototype with hidden state and endings
- First full-screen monochrome atmospheric-panel direction

## Milestone 0.2 - Immersive visual-novel reader

**Purpose:** Make the basic interaction feel like a visual novel rather than a website.

- [x] Full-bleed scene layout with choices as a minimal overlay
- [x] Touch-friendly choice targets and local save/restart
- [x] First atmospheric checkpoint panel integrated as a visual reference
- [ ] Confirm the full-screen layout on a real phone and a narrow desktop window
- [ ] Add a gentle scene transition that respects reduced-motion settings
- [ ] Add tap-to-continue pacing for narration before choices appear
- [ ] Add a compact Settings screen: text size, reduced motion, restart confirmation
- [ ] Add an accessible Chronicle that shows only facts the current protagonist knows

**Done when:** the opening is comfortable to read and control on a phone, visually atmospheric, accessible, and stable after refresh or resume.

## Milestone 0.3 - Chapter One script and consequence design

**Purpose:** Turn the checkpoint prototype into a coherent 20-30 minute chapter.

- [ ] Write the Chapter One beat sheet: 15-20 scenes, each with purpose, location, choice, and consequence
- [ ] Define Garren Vale's voice, contradiction, and arc for this chapter
- [ ] Finalize Captain Meret, Tavin, and Sella Venn: goals, secrets, loyalties, and breaking points
- [ ] Establish the Red Hollow mystery and the sealed-letter evidence trail
- [ ] Replace placeholder routes with deliberate branches and reconvergences
- [ ] Ensure each route contains at least one delayed consequence
- [ ] Write 3-5 distinct Chapter One endings that state the cost, not a win/lose result
- [ ] Add automated validation for broken links, missing art references, and invalid requirements

**Done when:** a first-time player can finish in 20-30 minutes, understands the immediate conflict, and wants to replay to see consequences they missed.

## Milestone 0.4 - Art and sound vertical slice

**Purpose:** Make Chapter One feel like a finished interactive graphic novel.

- [ ] Create an art bible: ink treatment, grayscale range, camera distance, weather, architecture, and no-protagonist-close-up rules
- [ ] Create a shot list for every Chapter One scene
- [ ] Produce a separate environment-first monochrome panel for each key scene
- [ ] Add subtle panel motion: rain, fog, embers, or camera drift only where it strengthens the scene
- [ ] Add an atmospheric sound palette: rain, wheels, wood, distant bells, crowd murmur, silence
- [ ] Add a small adaptive music set for tension, discovery, betrayal, and aftermath
- [ ] Add captions and independent volume controls

**Done when:** Chapter One can be played with sound on or off and still lands emotionally; art, text, and sound tell the same story.

## Milestone 0.5 - One-hour playable vertical slice

**Purpose:** Prove that the game can hold attention beyond one chapter.

- [ ] Expand from Chapter One into roughly one hour of connected play
- [ ] Add the ruined chapel / Red Hollow follow-up arc
- [ ] Introduce the first faction conflict and a consequence from the checkpoint decision
- [ ] Add evidence, relationship, and promise records to the Chronicle
- [ ] Add at least one scene where a past small choice changes dialogue or access unexpectedly
- [ ] Add complete save migration and a clean new-game flow
- [ ] Conduct a small outside playtest and record confusion, drop-off, and favourite moments

**Done when:** players understand the game's identity, stay engaged for an hour, and can describe a decision that felt personally theirs.

## Milestone 0.6 - Quality and production readiness

**Purpose:** Make the vertical slice reliable enough to share widely.

- [ ] Test portrait layouts across common phone widths and text-size settings
- [ ] Test offline loading, refresh, interrupted sessions, corrupted saves, and new saves
- [ ] Add loading, missing-art, and missing-story fallback states
- [ ] Improve performance: image compression, lazy loading, and transition memory limits
- [ ] Add content notes and accessibility review
- [ ] Establish a release checklist, version number, and changelog discipline

**Done when:** the web build is stable, usable, and understandable without developer help.

## Milestone 0.7 - Android test build

**Purpose:** Package the stable web game for physical Android testing.

- [ ] Choose the packaging path after the web slice is proven (likely Capacitor)
- [ ] Create Android project and signing plan; never store keys in the repository
- [ ] Test touch, Android back behaviour, safe areas, performance, save persistence, and audio focus
- [ ] Produce an internal APK/AAB test build
- [ ] Prepare store assets: icon, screenshots, feature graphic, description, privacy policy, content rating

**Done when:** the same vertical slice works reliably on real Android phones and is ready for closed testing.

## Milestone 0.8 - Closed test and launch preparation

**Purpose:** Validate that strangers understand and enjoy the game.

- [ ] Recruit closed-test players who were not involved in development
- [ ] Track completion, choice use, return sessions, technical failures, and feedback
- [ ] Prioritize fixes by player impact, not feature novelty
- [ ] Finalize pricing or monetization only after the core game is enjoyable
- [ ] Prepare a first public release scope that does not promise more than we can support

**Done when:** the game has a stable, enjoyable, honest first release plan.

## Explicitly deferred

These are not current work:

- Combat systems
- Open-world map exploration
- Multiplayer, accounts, or cloud saves
- Ads, battle passes, or aggressive monetization
- Character creator
- Multiple playable protagonists before Garren's first arc works
- iOS release until Android and the web slice are proven

## Immediate next task

**Finish Milestone 0.2's real-phone layout check, then create the Chapter One beat sheet.**

That beat sheet will be the bridge from a good-looking prototype to a deliberate, playable chapter.
