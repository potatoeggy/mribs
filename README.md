# Scribble Fighters

Draw your champion, bring it to life, and fight!

A web-based game where players draw creatures on a canvas, AI (GPT-4o Vision) analyzes the drawings to determine combat abilities, and the scribbles come to life to battle each other in real-time.

## Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key (optional for development - uses fallback configs without it)

### 1. Install dependencies

```bash
# Install client dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### 2. Configure environment

```bash
# Copy and edit the env file
cp .env.local.example .env.local
# Add your OPENAI_API_KEY to .env.local
```

### 3. Start the game server

```bash
cd server
npm run dev
```

### 4. Start the web app (in another terminal)

```bash
npm run dev
```

### 5. Play!

1. Open http://localhost:3000
2. Click "Create Room"
3. Share the room code with a friend (or open another browser tab)
4. Both players ready up
5. Draw your champion! Add "+fire", "+fly", arrows, etc.
6. AI analyzes your drawing and assigns combat abilities
7. Battle using trackpad/mouse gestures!

## How to Play

### Drawing Phase
- Draw your creature on the canvas
- Add attack shapes (fireballs, swords, etc.) near your creature  
- Write text annotations: "+fire", "+fly", "+shield"
- Draw arrows from attacks to your creature
- Ink is limited - be strategic!

### Battle Phase (Gesture Controls)
- **Click & drag**: Move your creature
- **Tap**: Fire projectile
- **Swipe left/right**: Melee attack
- **Draw circle**: Activate shield
- **Swipe up**: Fly / jump

## Live Commentator (LiveAvatar)

During battles, a live AI commentator speaks play-by-play using HeyGen's LiveAvatar. To enable it:

1. Get an API key from [LiveAvatar](https://app.liveavatar.com) (or use your HeyGen key)
2. Add to `.env.local`:
   ```
   LIVEAVATAR_API_KEY=your-key
   # or HEYGEN_API_KEY=your-heygen-key (fallback)
   ```

The commentator auto-picks an avatar and voice. To customize (e.g. Toronto accent), pass `avatarId` and `voiceId` to `LiveCommentator`—fetch options from `/api/liveavatar/avatars` and `/api/liveavatar/voices`.

## Tech Stack

- **Next.js 14** - Web framework
- **Phaser 3** - Battle rendering
- **Colyseus** - Real-time multiplayer
- **Matter.js** - Physics simulation
- **OpenAI GPT-4o** - Drawing analysis
- **Tailwind CSS** - Styling
