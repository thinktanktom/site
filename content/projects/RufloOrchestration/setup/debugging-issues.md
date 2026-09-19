# Setup & Debugging — Issues Encountered

Three issues had to be diagnosed and resolved before the stack was cleanly operational. None of them were prominently documented by the project itself.

---

## Issue 1 — Claude Models Not Appearing in the UI

Once the chat UI was reachable, the model selector was empty. The cause: the MCP bridge does not auto-discover models from API providers. Models have to be explicitly registered in a `KNOWN_MODELS` array in the bridge's own source:

```js
// src/ruvocal/mcp-bridge/index.js
const KNOWN_MODELS = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4",
  // add others here as needed
];
```

This isn't called out prominently anywhere in the documentation — the UI loads and runs fine without it, it just silently shows no models to select from, which reads more like a configuration problem elsewhere than a missing registration step.

---

## Issue 2 — Stale Shell Variables Silently Overriding `.env`

This was the most time-consuming issue of the entire setup. Docker Compose was picking up placeholder API keys (`sk-or-your-key-here`) even though the correct keys were present in the `.env` file. Models were registered, the UI was reachable — but every API call failed.

The root cause was stale `export` statements left in `~/.bashrc` from an earlier, abandoned configuration attempt. Docker Compose resolves environment variables in a fixed order — **(1) shell environment → (2) `.env` file → (3) `docker-compose.yml` defaults** — and a shell-level export wins over the `.env` file with no warning that it's doing so.

```bash
# Diagnosis
printenv | grep OPENROUTER
# Output: OPENROUTER_API_KEY=sk-or-your-key-here  ← stale export from ~/.bashrc

# Fix
# remove the export lines from ~/.bashrc, then:
source ~/.bashrc
docker compose up -d --force-recreate
```

The general lesson: if a containerized app is reading the wrong value for something that's correctly set in `.env`, check the shell environment before anything else — `printenv | grep <key>` is the first diagnostic step, not the last.

---

## Issue 3 — Chat UI Hitting HuggingFace's Servers

Before the full Docker stack was adopted, ruvocal was run directly under PM2 during earlier testing. `.env.local` was configured to route model calls through OpenRouter, but the UI kept responding with a HuggingFace rate-limit message instead of a model response.

The cause: the SvelteKit build had baked HuggingFace URLs in at compile time. Setting environment variables after the build had no effect, because the built JavaScript already contained the hardcoded endpoint. The fix was to set `.env.local` correctly *first*, then rebuild:

```bash
npm run build
pm2 restart chat-ui
```

Two additional variables were needed to fully disable HuggingFace's own auth flow:

```env
USE_USER_TOKEN=false
OPENID_CLIENT_ID=
```

In the Docker Compose stack this class of problem doesn't recur — `PUBLIC_ORIGIN`, model URLs, and API keys are injected at container start via `entrypoint.sh` using the `DOTENV_LOCAL` mechanism, not baked in at build time. That's one of the reasons the deployment standardized on Docker Compose rather than running ruvocal directly.

---

## The Short List

If you're setting up something similar, these are the traps worth knowing about up front:

1. `npm install -g ruflo@latest` won't generate the config file the docs describe — go straight to Docker Compose.
2. The Docker Compose file lives at `ruflo/ruflo/`, not the repo root.
3. Models must be manually added to `KNOWN_MODELS` in `mcp-bridge/index.js` — they don't auto-discover.
4. Stale `export` lines in `~/.bashrc` silently override `.env` values with no warning.
5. A SvelteKit-based chat UI bakes URLs in at compile time — set `.env.local` before building, not after.
