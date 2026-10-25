# SpeakWise — Personal English Coach MVP

A free, mobile-first PWA prototype for personal English speaking and writing.

## Features
- Daily, workplace, presentation and interview practice scenarios
- Browser speech recognition (when supported) and spoken replies
- Example-based speaking feedback
- **Speak & Correct popup:** dictate or type a chat message, formal message or email; apply basic cleanup; copy the result into WhatsApp, Gmail or any other app
- Local session history and progress
- PWA manifest and service worker for an installable cached app shell

## Important limitations
This is a front-end prototype, not yet a connected generative-AI assistant. Replies, corrections and text polishing are based on sample/rule-based logic; they are not comprehensive grammar checking or full AI rewriting. Browser speech recognition support varies and may send audio to a browser/provider speech service; it may not work offline. Speech synthesis uses browser/device voices.

## Run locally
For microphone recognition, serve over HTTPS or localhost (opening `index.html` as a file may not work):
1. Install Node.js if needed.
2. From this folder run `npx serve .` (or another static web server).
3. Open the URL printed by the server in Chrome on Android or a desktop browser.

## Deploy for phone use
1. Upload this folder to a GitHub repository.
2. Enable GitHub Pages, or import the repository into Vercel.
3. Open the HTTPS URL in Chrome on Android.
4. Chrome menu → **Install app** or **Add to Home screen**.

## Next step: connect real AI safely
Use a serverless backend to call the model provider. Store API keys in server-side environment variables; never put an API key in `app.js` or browser code. Check current provider pricing and free-tier limits before enabling it.

## Files
- `index.html` — screens and Speak & Correct popup
- `styles.css` — mobile UI and popup styling
- `app.js` — speech controls, demo feedback, text cleanup, copy, local history
- `manifest.webmanifest` — install metadata
- `sw.js` — cached app shell
- `icon.svg` — app icon
