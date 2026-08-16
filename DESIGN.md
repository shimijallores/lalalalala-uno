# UNO DUEL Design

## Scene

Two friends are playing from separate rooms at night. The screen is a dark teal tabletop; the cards are the bright physical objects that carry most of the color and energy.

## Visual Direction

The interface uses a loud tabletop register without turning the game into a dashboard. The supplied `Table_3.png` asset anchors the board, `Banner.png` gives the landing screen its oversized physical artifact, and the card assets are rendered at real clickable sizes. Charcoal surfaces, teal lines, white card borders, black outlines, and a hot-pink UNO action create a recognizable hierarchy.

## Tokens

Tokens live in `src/styles/tokens.css` and use OKLCH values. The visual system is intentionally full-palette for the game surface: teal is the table and connection accent, yellow is the primary call to action, pink is UNO and celebration, and red/blue/green/yellow retain the semantic card colors.

## Typography

Controls and status copy use the system sans stack for fast, familiar reading. The display face is limited to the UNO DUEL mark, room drama, and winner moment through a system-available heavy condensed fallback.

## Layout

- Landing: asymmetric asset-led split on desktop, stacked on small screens.
- Lobby: invite information beside a two-seat table state.
- Game: opponent zone, center piles, and local hand with structural mobile reflow.
- Mobile hand: horizontal scrolling, active card minimum approximately 52 by 75 pixels, piles stay visible.

## Interaction

All state-changing controls wait for an authoritative server response. Pending commands disable repeated interactions, stale responses trigger a fresh player-specific view, and reconnecting keeps the last board visible while pausing commands.

## Motion

Motion is reserved for accepted or meaningful state: landing float, card lift, pile press, lobby entry, color picker, and winner celebration. `prefers-reduced-motion` collapses the effects to short or instant transitions.
