# Tea Room

Tea Room is a Vercel-ready Next.js virtual office demo built with react-three-fiber. Visitors can enter a name, choose a character, move around the office with the arrow keys, switch actions (stand/sit/lay down), and share short proximity-based chat bubbles.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Notes

- Open the site in multiple browsers/tabs to simulate multiple visitors in the same room.
- Chat bubbles are only visible when avatars are close together.
- The camera follows the local avatar once movement goes beyond a small view constraint.
- Presence syncing uses a lightweight Next.js API route, so it works across browser sessions.
