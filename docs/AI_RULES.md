## AI Guidelines

These rules define how AI assistants and tools should interact with this repo.

### Coding style and reviews
- Prefer clear, readable code over clever one-liners.
- Use explicit names for variables and functions; avoid abbreviations.
- Handle errors explicitly; do not swallow exceptions.
- Keep changes minimal and scoped; avoid drive-by refactors.

### Security
- Never log secrets or full credentials. Redact sensitive fields.
- Store secrets in environment variables only. Do not commit .env files.
- For authentication, prefer strong hashing (bcrypt/Argon2). MD5 is legacy-only for compatibility.
- Use parameterized SQL for all queries.

### Authentication in this repo
- Login is verified in SQL with `WHERE login = ? AND password = MD5(?) AND status = 1` for legacy DB compatibility.
- On success, the server issues an HMAC-signed session cookie (`session`) valid for 7 days.
- Routes are protected via `middleware.ts`, which redirects unauthenticated users to `/login`.
- Environment: `SESSION_SECRET` must be set. Generate with `openssl rand -base64 32`.

### AI usage patterns
- Keep messages concise; prioritize actionable steps and smart defaults.
- When changing code, perform edits via appropriate tools and run linters.
- Prefer summarizing impact over narrating search process.
- Propose incremental migrations (e.g., MD5 → bcrypt) with safe rollouts.

### Documentation updates
- Update README when adding endpoints, env vars, or user-facing flows.
- Add short rationale for security-impacting changes.


