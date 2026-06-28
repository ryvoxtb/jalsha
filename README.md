# IPTV HLS M3U8 Proxy Server

This is a simple Node.js IPTV Proxy Server built using Express and Axios. It intercepts an HLS stream (m3u8 and video segments), updates the playlist files with the proxy host, and streams it seamlessly to prevent CORS issues or external IP blocks.

## Features
- Bypasses CORS restrictions.
- Automatically handles sub-playlists and tracking for streams.
- Dynamically rewrites media segments (`.ts`, `.mp4`, `.fmp4`, `init`).

## Files Structure
- `server.js` - Main entry point of the server.
- `package.json` - Lists project dependencies and startup scripts.
- `.gitignore` - Prevents node_modules from being pushed to GitHub.

## Local Installation & Run
1. Clone or download this repository.
2. Open terminal/command prompt in the project directory.
3. Install dependencies:
   ```bash
   npm install
