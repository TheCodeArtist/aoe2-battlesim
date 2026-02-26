import { CORS } from '../cors.js';

const DEST    = 'https://github.com/TheCodeArtist/aoe2-battlesim';
const DELAY_S = 30

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="${DELAY_S}; url=${DEST}">
  <title>aoe2-battlesim</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
           display: flex; flex-direction: column; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #ffffff; color: #24292f; text-align: center; }
    a    { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1   { margin-bottom: 0.5rem; }
    p    { font-size: 1.1rem; margin: 0.5rem 0; }
    .container { max-width: 600px; padding: 2rem; }
    .docs { margin-top: 2rem; border-top: 1px solid #d0d7de; padding-top: 1.5rem; }
    .doc-links { display: flex; gap: 1rem; justify-content: center; margin: 2rem 0; flex-wrap: wrap; }
    .doc-card { 
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 1.5rem; border: 1px solid #d0d7de; border-radius: 6px; 
      text-decoration: none; color: inherit; width: 220px; transition: all 0.2s;
      background: #f6f8fa;
    }
    .doc-card:hover { border-color: #0969da; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .doc-title { font-weight: 600; color: #0969da; margin-bottom: 0.5rem; font-size: 1.05rem; }
    .doc-desc { font-size: 0.9rem; color: #57606a; line-height: 1.4; }
    .mcp-badges { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin: 1.5rem 0; }
    .mcp-badges a { text-decoration: none; transition: opacity 0.2s; }
    .mcp-badges a:hover { opacity: 0.8; }
    .mcp-badges img { height: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>aoe2-battlesim</h1>
    <p>Age of Empires II Battle Simulator API</p>
    
    <div class="mcp-badges">
      <a href="cursor://anysphere.cursor-deeplink/mcp/install?name=aoe2-battlesim&config=eyJ1cmwiOiJodHRwczovL2FvZTItYmF0dGxlc2ltLnRoZWNvZGVhcnRpc3Qud29ya2Vycy5kZXYvbWNwIn0=">
        <img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" />
      </a>
      <a href="vscode:mcp/install?%7B%22name%22%3A%22aoe2-battlesim%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Faoe2-battlesim.thecodeartist.workers.dev%2Fmcp%22%7D">
        <img src="https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install in VS Code" style="height: 32px;" />
      </a>
    </div>

    <div class="docs">
      <h2>API Documentation</h2>
      <div class="doc-links">
        <a href="/docs" class="doc-card">
          <span class="doc-title">Interactive Swagger UI</span>
          <span class="doc-desc">Explore and test endpoints visually</span>
        </a>
        <a href="/openapi.json" class="doc-card">
          <span class="doc-title">OpenAPI 3.0 Spec</span>
          <span class="doc-desc">Raw JSON definition</span>
        </a>
      </div>
    </div>

    <div style="margin-top: 3rem; border-top: 1px solid #d0d7de; padding-top: 2rem; color: #57606a;">
      <p>Redirecting to the project repository in <span id="countdown">${DELAY_S}</span> seconds…</p>
      <p><a href="${DEST}">${DEST}</a></p>
    </div>
  </div>

  <script>
    let seconds = ${DELAY_S};
    const countdown = document.getElementById('countdown');
    const interval = setInterval(() => {
      seconds--;
      if (seconds >= 0) countdown.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(interval);
        // Meta refresh will handle it, but JS backup is good
        window.location.href = "${DEST}";
      }
    }, 1000);
  </script>
</body>
</html>`;

export function handleRoot() {
  return new Response(HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=UTF-8', ...CORS },
  });
}
