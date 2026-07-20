# The Ashen Oath - Project Context

This document is the permanent handoff for product identity, scope, and working constraints. Read it before planning or implementing product work. Use `docs/ROADMAP.md` for milestone status and immediate priorities.

## Project identity

**The Ashen Oath** is a browser-first, choice-driven dark medieval fantasy visual novel.

The player should feel that they inhabit a hostile illustrated world where every promise, lie, compromise, and act of mercy may return later with a cost.

The core experience depends on:

- Distinct characters with strong voices, conflicting motives, and self-deception
- Morally complicated decisions without good/evil labels
- Political pressure grounded in personal needs, fear, ambition, loyalty, and resentment
- Hidden consequences affecting relationships, knowledge, evidence, promises, access, faction pressure, survival, and endings
- Concise prose, tension, bleak intimacy, and occasional dark humor
- Original writing and visual identity; do not copy an existing author, game, character, plot, faction, dialogue, or artwork

## Platform rule

Finish the complete game in the browser first.

All mobile-specific work is deferred until the browser game is complete, externally tested, polished, and content-locked. Until then, do not work on Android packaging, APK or AAB generation, Google Play, signing, native wrappers, phone-specific adaptation, or store assets.

Browser layouts should remain robust and accessible across sensible viewport sizes, but mobile packaging and phone-specific product work are not current scope.

## Visual direction

- Full-screen, hand-drawn black-and-white artwork
- Environment-first compositions with much more environment than faces
- Characters generally distant, silhouetted, obscured, viewed from behind, or outside the frame
- Ink, charcoal, cross-hatching, rain, fog, mud, smoke, worn timber, and severe medieval architecture
- A separate clean image for each panel
- No dialogue, choices, captions, or interface text embedded in artwork

## Story foundation

Garren Vale is a former military interrogator returning from a failed war. Evidence suggests that his regiment was deliberately sacrificed at Red Hollow.

At a rain-soaked checkpoint, he encounters:

- Captain Meret, the disciplined checkpoint authority
- Tavin, a deserter and possible witness
- Sella Venn, a sharp merchant caught in the same trap

The central question is:

> If revealing the truth would begin another war, is the truth still worth protecting?

Garren is not a chosen one, hidden monarch, or invincible warrior. He becomes important because of what he knows, whom he trusts, what evidence survives, and what he is willing to become.

## First-time story clarity

The story may preserve mystery, distrust, and hidden consequences, but it must not rely on player confusion. A first-time player should understand, without outside lore:

- where the current situation is happening and what physically changed;
- who is present, what each person immediately wants, and why the decision cannot simply wait;
- the known risk or compromise in every choice, even when its delayed consequence remains hidden;
- how newly introduced names, factions, documents, and places connect to the current human problem; and
- the causal trail from Red Hollow's evidence to the threatened war and the danger faced by checkpoint civilians.

Introduce necessary context through concrete action, material conditions, character need, or concise narration. Avoid stacking unexplained proper nouns, evidence terms, or political facts in one passage. When location or time context is needed, present it in the reader outside the artwork; never embed explanatory text in a panel image.

Intentional uncertainty concerns whom to trust, what a person conceals, and which cost will return later. Basic geography, immediate motivation, evidence custody, and cause-and-effect must remain understandable.

Before story lock, outside players unfamiliar with the project must be able to explain Garren's immediate goal and former work, the competing needs of Meret, Tavin, and Sella, the essential Red Hollow evidence trail, why disclosure could renew the war, and what they knowingly risked in their major choices.

## Current story-design target

Before expanding or polishing more dialogue, create a Chapter One beat sheet of approximately 15-20 purposeful scenes forming a coherent 20-30 minute chapter.

For every scene, record:

- Scene identifier and location
- Dramatic purpose
- Characters present and what each wants
- Information revealed or concealed
- Player choice or dramatic pressure
- Immediate consequence
- Delayed consequence or remembered state
- Branch destination or reconvergence
- Required environmental panel
- How Garren changes or reveals himself

The beat sheet must:

- Establish Garren's Chapter One arc
- Finalize the roles, motives, secrets, and breaking points of Meret, Tavin, and Sella
- Clarify the Red Hollow evidence trail
- Produce 3-5 endings defined by cost rather than victory or defeat
- Preserve meaningful consequences when branches reconverge

## Working method

Work on exactly one small, coherent, non-mobile task at a time.

Before implementation:

- Inspect this document, `README.md`, `docs/ROADMAP.md`, current story data, and the playable browser build
- Check for existing work and identify the smallest unfinished roadmap task
- Preserve unrelated working features

After implementation:

- Validate the story data when it changes
- Run available tests
- Inspect player-facing changes when applicable
- Commit and push verified work
- Update `docs/ROADMAP.md` only when work is genuinely complete

At handoff, report what was completed, which files changed, what was tested, whether GitHub is synchronized, and the exact next recommended task.

## Scope guardrails

- Browser game first; mobile-specific work remains deferred
- Environment and consequence design before dialogue expansion or polish
- No moral scoring labels
- No copied prose, plots, characters, factions, or visual identities
- No scope expansion without discussing it with the project owner
