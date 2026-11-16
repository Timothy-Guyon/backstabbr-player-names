# Handoff: Backstabbr Player Names (from a Claude Cowork session, 2026-11-13)

## Goal
Timmy plays Diplomacy on backstabbr.com with friends and loses track of who plays which country.
Tool: everywhere a country name appears on a game page, show the player next to it, e.g. "France (Yonk)",
with optional custom nicknames per player. Must be ONE build artifact that works on desktop
(Chrome/Edge/Firefox via Tampermonkey/Violentmonkey) and mobile (iOS Safari via the Userscripts app,
Android Firefox + Violentmonkey). Mobile Chrome is out of scope (no add-on support).

## Current state
- `backstabbr-player-names.user.js` is the source of truth. `@grant none`, plain JS, no build step.
  Tested by injection on a live game page: all 7 countries labelled, settings panel works.
- The earlier MV3 extension (chrome-extension-legacy/) was removed on 2026-11-16 after Timmy uninstalled it.

## How it works
- Runs on `https://(www.)backstabbr.com/game/*`. Game id = `/game/<slug>/<id>`.
- Players come from `GET /game/<slug>/<id>/ajax/info` (HTML fragment, works for signed-out observers).
  Its "Players" list is `<li><a href="/member/...">Player#1234</a> — <i class="Germany fas fa-square"></i> Germany</li>`.
  Country = the non-`fa*` class on the `<i>`. Usernames end in a `#1234` discriminator, which is stripped for display.
- Countries are parsed from that list (not hardcoded), so variant maps should work.
- Page JS globals (e.g. `unitsByPlayer`) have country names but NOT usernames; `/api/game/<id>` exists but wasn't inspected.
- Text nodes matching `\b(Country)\b` are wrapped in `<span class="bsx-country" data-bsx-label="Tim">`;
  the label renders via CSS `::after`, so the element's textContent stays unchanged (safer for site JS).
- MutationObserver (100 ms debounce) re-annotates dynamic content. Skips script/style/inputs/select/svg/
  contenteditable, our own UI, and the Info tab player list (already shows names).
- Storage: `localStorage` on backstabbr.com, keys `bsx:nicknames` ({username: nick}, global across games),
  `bsx:enabled`, `bsx:players:<gameId>` (cache for instant render). Per-browser, no sync (accepted tradeoff).
- UI: floating "Names" button bottom-right opens a panel with one nickname input per country (16px inputs to avoid iOS zoom).

## Suggested next steps
1. Put it in a git repo (or a Gist) and add `@updateURL` / `@downloadURL` pointing at the raw file so every
   device auto-updates when `@version` is bumped.
2. Real-device check in Userscripts on iOS Safari and in Tampermonkey on desktop Chrome
   (Chrome needs "Allow User Scripts" on in Tampermonkey's extension details).
3. Check the press/chat and game-history views for country mentions and layout (only the main game page with
   Orders/Info tabs was checked).
4. Optional ideas Timmy hasn't decided on: matching adjectives ("French", "German"...) in chat; whether the floating
   button gets in the way on phones.
