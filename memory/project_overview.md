---
name: project_overview
description: Coordinator Please game — Papers Please meets 1995 stunt industry, built with Phaser 3 + TypeScript + Vite
type: project
---

"Coordinator Please" is a Papers Please-style document checking / social deduction game set in the 1995 stunt industry.

**Tech stack:** Phaser 3 + TypeScript + Vite (no external art assets — pixel art via code)
**Architecture:** Data-driven with tunable balance config, separated into types/config/data/systems/scenes/ui
**Build phases:** 7 phases from core loop to full polish (per GDD v5.0)
**Game scope:** 7 nights, ~30 min total playtime, 4-8 visitors per night

**Why:** User wants a "really robust game that we can make adjustments for" — emphasis on tunability and modularity.

**How to apply:** Keep all game numbers in balance config. Keep night definitions data-driven. Systems should be pure logic (no rendering). Scenes handle display only.
