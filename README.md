# Catch the Water

A responsive browser game prototype inspired by charity: water's mission to expand access to clean water. Built with plain HTML, CSS, and JavaScript.

## Play

- Choose **Play** to start a round.
- Move the bucket with the left and right arrow keys, A and D, or the on-screen arrow buttons.
- Catch each falling water drop to increase your score.
- A drop reaching the ground ends the round.
- Choose **Play again** to start over, or **Reset** to return to the start screen.
- The timer tracks how long the current round lasts. Your best score is saved in this browser.

## Run locally

Open `index.html` in a modern browser. No build tools or packages are required.

## Publish with GitHub Pages

1. Open the repository's **Settings** tab.
2. Choose **Pages** from the sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and `/(root)`, then save.
5. After GitHub Pages finishes publishing, open the URL shown in Settings → Pages. Test that link in a private browser window.

## Game rules

- Catch a blue water drop to add 1 point.
- Catch a polluted drop to subtract 1 point; the score cannot go below 0.
- A missed drop ends the round.
- Drops fall at a fixed speed and spawn every 2 seconds.
- Polluted drops appear at a 1:7 ratio to regular drops (1 polluted drop for every 7 regular drops).
- The sky completes a day-to-night-to-day cycle every 2 minutes.
- Each drop is placed within the bucket's reachable horizontal range, based on movement speed, time to the bucket, and a short reaction buffer.

## Prototype scope

The prototype uses charity: water palette colors for blue and yellow, with green ground and a dark polluted-drop variation.