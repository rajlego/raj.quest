# raj.quest Cloudflare Worker

URL redirect and Markdown notes service powered by Cloudflare Workers + KV.

## Features

- **Fast redirects**: Sub-10ms redirects globally via edge deployment
- **Markdown notes**: Store and render markdown content
- **Unlisted by default**: Public if you know the key, but never enumerable
- **Password protection**: Protect individual redirects/notes with passwords
- **Bulk editor**: Edit all redirects in a single text-based interface
- **Google authentication**: Admin protected by Cloudflare Access (OAuth)

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create KV Namespace

```bash
npx wrangler kv:namespace create REDIRECTS
npx wrangler kv:namespace create REDIRECTS --preview
```

Copy the namespace IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "REDIRECTS"
id = "YOUR_PRODUCTION_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_NAMESPACE_ID"
```

### 4. Deploy the Worker

```bash
npm run deploy
```

### 5. Set Up Cloudflare Access (Google Login)

This protects `/admin` with Google authentication:

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)

2. **Add Google as a login method:**
   - Navigate to: Settings > Authentication > Login methods
   - Click "Add new" > Google
   - Follow the OAuth setup (requires Google Cloud Console)

3. **Create an Access Application:**
   - Navigate to: Access > Applications > Add an application
   - Select "Self-hosted"
   - Configure:
     - Application name: `raj.quest Admin`
     - Session duration: 24 hours
     - Application domain: `raj.quest`
     - Path: `/admin*`

4. **Add a policy:**
   - Policy name: `Allow Owner`
   - Action: Allow
   - Include rule: Emails > `your@gmail.com`

Now visiting `/admin` will require Google login.

### 6. (Optional) Restrict Admin Emails

Add to `wrangler.toml`:

```toml
[vars]
ALLOWED_ADMIN_EMAILS = "you@gmail.com,other@gmail.com"
```

## Local Development

```bash
npm run dev
```

Note: Cloudflare Access won't protect local dev. The worker will show "Unauthorized" since there's no `CF-Access-Authenticated-User-Email` header.

For local testing, you can temporarily modify `auth.ts` to bypass the check.

## Admin Interface

Visit `raj.quest/admin` (after Google login) to access the bulk editor.

### Redirect Format

```
# Comments start with #

# Simple redirect
github -> https://github.com/username

# Password-protected redirect
resume [mypassword] -> https://example.com/resume.pdf

# Markdown note
about ---
# About Me

This is a **markdown** note.
---

# Password-protected note
private [secret] ---
Private content here.
---
```

### How Passwords Work

- Set a password: `key [password] -> url`
- Once saved, the password is hashed and stored
- The editor shows `[********]` for existing passwords
- To change a password, replace `[********]` with the new password
- To remove a password, remove the `[********]` entirely

## Security Model

| Aspect | Implementation |
|--------|---------------|
| Admin auth | Cloudflare Access (Google OAuth) |
| Record passwords | PBKDF2 with 100k iterations |
| Enumeration | No listing endpoints, consistent 404s |
| Timing attacks | Constant-time password comparison |

**Key points:**
- Redirects are **unlisted**: public if you know the key, but no way to list all keys
- Individual records can be password-protected for extra security
- Admin access requires Google login through Cloudflare Access

## Custom Domain Setup

1. Add raj.quest to Cloudflare (if not already)
2. Go to Workers & Pages > raj-quest > Settings > Triggers
3. Click "Add Custom Domain" > enter `raj.quest`

Or update nameservers at your registrar to point to Cloudflare.

## File Structure

```
worker/
├── src/
│   ├── index.ts        # Main entry, routing
│   ├── auth.ts         # Cloudflare Access auth + password hashing
│   ├── storage.ts      # KV operations, bulk format parsing
│   ├── admin.ts        # Admin UI handlers
│   ├── redirect.ts     # Public redirect/notes handlers
│   └── password-gate.ts # Password protection for records
├── wrangler.toml       # Cloudflare config
├── package.json
└── tsconfig.json
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run tail` | Stream live logs |
