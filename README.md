# Catch the Water

A responsive browser game prototype inspired by charity: water's mission to expand access to clean water. Built with plain HTML, CSS, and JavaScript.

## Play

- Choose **Play** to start a round. An original chill-house loop and synthesized water-catch and thunder effects use the browser's Web Audio API. Use **Sound** to mute or unmute them.
- Move with the left/right arrows, A/D, or the on-screen controls. Press **Space** or **Dash** for a short burst in your last horizontal direction; it recharges every 5 seconds.
- Catch regular drops for points and avoid polluted drops, which subtract 1 point if caught. A missed regular drop ends the round; polluted drops can be ignored.
- Activate **Thunderstorm** once per round for 10 seconds of visual heavy rain and protection from losing. Polluted drops disappear and stop spawning during the storm. The rain does not add score.
- Choose **Play again** to start another round, or **Reset** to return to the start screen.
- The timer tracks the current round. Your best score is saved in this browser.

## Run locally

Open `index.html` in a modern browser. No build tools or packages are required.

## Publish with GitHub Pages

1. Open the repository's **Settings** tab.
2. Choose **Pages** from the sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and `/(root)`, then save.
5. After GitHub Pages finishes publishing, open the URL shown in Settings → Pages. Test that link in a private browser window.

## Game rules

- Catch a regular water drop to add 1 point.
- Catch a polluted drop to subtract 1 point; the score cannot go below 0.
- A missed regular drop ends the round; polluted drops may be ignored.
- Drops fall at a fixed speed and spawn every 2 seconds.
- Polluted drops appear at a 1:7 ratio to regular drops (1 polluted drop for every 7 regular drops).
- The sky completes a continuous day-to-night-to-day cycle every 2 minutes, including between rounds.
- Each drop is placed within the bucket's reachable horizontal range, based on movement speed, time to the bucket, and a short reaction buffer.

## Prototype scope

The prototype uses charity: water palette colors for blue and yellow, with green ground and a dark polluted-drop variation. Background music and effects are synthesized with the browser's Web Audio API; there are no external audio files.