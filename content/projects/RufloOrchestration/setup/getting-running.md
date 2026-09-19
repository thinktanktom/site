# Setup & Debugging — Getting Ruflo Running

## The Documented Path Doesn't Work

Ruflo's documentation describes installation as:

```bash
npm install -g ruflo@latest
ruflo init
```

Running this produced `inflight` and `npmlog` deprecation warnings and, more importantly, did not generate the `claude-flow.config.json` file the documentation says `init` will create. The config file simply wasn't there afterward.

That was the signal that the published npm package had drifted meaningfully from the actual GitHub repository. Rather than trying to patch around a stale package, the setup pivoted to cloning the repo directly and running it via Docker Compose — the method the project's own infrastructure actually exercises.

---

## The Repo Doesn't Match Its Own Docs Either

Once inside the cloned repo, several more mismatches surfaced between what the documentation describes and what's actually there:

| Docs say | Actually at |
|---|---|
| `scripts/` | `src/scripts/` |
| `src/chat-ui/` | `src/ruvocal/` (a separate fork) |
| Config directory exists after init | Must be created manually |
| Docker Compose at repo root | Nested at `ruflo/ruflo/docker-compose.yml` |
| `OPENAI_BASE_URL` baked in at build time | Injected at runtime via `entrypoint.sh` using `DOTENV_LOCAL` |

The most consequential of these: the chat UI is not a stock install of anything — it's ruvocal, a fork with its own build and runtime behavior. That distinction directly caused one of the three issues in [Issues Encountered](/projects/RufloOrchestration/setup/debugging-issues).

---

## Auth Choice: Caddy Basic Auth, Not Google OIDC

Ruflo's documentation points toward Google OIDC for authenticating the chat UI. That was deliberately not used here.

OIDC requires registering an OAuth application with Google Cloud, configuring callback URLs, and maintaining that registration over time. For a single-client deployment, that's meaningfully more infrastructure than the threat model justifies. Caddy basic auth is faster to stand up, easier to hand credentials over for, and carries no external dependency. If the deployment ever needed to scale to more than one user, that decision would be worth revisiting — it was not the right tradeoff for this deployment's actual shape.

For the subdomain itself, DuckDNS was used rather than a paid domain. Once the subdomain resolves, Caddy provisions and auto-renews its Let's Encrypt certificate with no further TLS configuration required.
