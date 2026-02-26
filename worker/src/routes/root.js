import { CORS } from '../cors.js';

const DEST    = 'https://github.com/TheCodeArtist/aoe2-battlesim';
const DELAY_S = 5;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="${DELAY_S}; url=${DEST}">
  <title>aoe2-battlesim</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh;
           margin: 0; background: #0d1117; color: #e6edf3; }
    a    { color: #58a6ff; }
    p    { font-size: 1.1rem; }
  </style>
</head>
<body>
  <p>No endpoint specified. Redirecting to the project repository in ${DELAY_S} seconds…</p>
  <p><a href="${DEST}">${DEST}</a></p>
</body>
</html>`;

export function handleRoot() {
  return new Response(HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=UTF-8', ...CORS },
  });
}
