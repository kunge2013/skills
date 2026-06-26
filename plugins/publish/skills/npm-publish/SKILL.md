---
name: npm-publish
description: Publish npm packages with full troubleshooting for 2FA, token types, registry mirrors, and cross-platform issues. Use when the user asks to publish a package to npm, fix npm publish errors, or set up npm authentication.
---

# npm Publish Skill

Publish Node.js packages to npm registry with complete error handling and troubleshooting.

## When to Use

- User asks to publish a package to npm
- User encounters npm publish errors (401, 403, 404)
- User needs to configure npm authentication
- User needs to set up npm tokens with correct permissions

## Pre-flight Checklist

Before publishing, verify ALL of the following:

1. **package.json exists** with required fields:
   - `name` — package name (check availability: `curl -s https://registry.npmjs.org/<name> | head -5`)
   - `version` — semver version
   - `main` or `bin` — entry point
   - `files` — whitelist of files to include (recommended)
   - `license` — MIT, ISC, etc.
   - `description` — short description
   - `keywords` — for discoverability

2. **Registry is official npm** (NOT a mirror):
   ```bash
   npm config get registry
   # MUST be: https://registry.npmjs.org/
   ```

3. **Auth token is configured** with correct permissions

4. **.npmignore or files field** — ensure only necessary files are published

## Step-by-Step Publishing Flow

### Step 1: Check and Fix Registry

```bash
# Check current registry
npm config get registry

# If it shows a mirror (huawei/taobao/cnpm), switch to official:
npm config set registry https://registry.npmjs.org/

# Common mirrors that will FAIL for publishing:
# - https://mirrors.huaweicloud.com/repository/npm/
# - https://registry.npmmirror.com/
# - https://registry.npm.taobao.org/
```

**IMPORTANT**: Mirror registries (华为云/淘宝/cnpm) only support READ operations. Publishing MUST go to the official registry.

### Step 2: Generate npm Token

Go to https://www.npmjs.com/settings/<username>/tokens

**Token Type Selection Guide:**

| Token Type | Can Publish | Needs 2FA Bypass | Use Case |
|------------|-------------|------------------|----------|
| Classic - Automation | ✗ NO | N/A | CI read-only |
| Classic - Publish | ✓ YES | Only if 2FA enabled | Simple publish |
| Granular (recommended) | ✓ YES | Must enable bypass | Fine-grained control |

**For accounts with 2FA enabled (most accounts), you MUST:**
1. Choose **Granular Token**
2. Set permissions to **Read and publish**
3. **Enable "Bypass 2FA for publishing"** ← CRITICAL, without this you get 403

### Step 3: Configure Auth Token

Create `.npmrc` in project root:

```bash
echo "//registry.npmjs.org/:_authToken=npm_YOUR_TOKEN_HERE" > .npmrc
```

**SECURITY**: Add `.npmrc` to `.gitignore` and `.npmignore`:
```bash
echo ".npmrc" >> .gitignore
echo ".npmrc" >> .npmignore
```

### Step 4: Verify Authentication

```bash
npm whoami
# Should output your npm username
```

If empty or error → token is invalid, regenerate.

### Step 5: Dry Run (Recommended)

```bash
npm pack --dry-run
# Shows what files will be included in the package
# Verify no secrets, no unnecessary files
```

### Step 6: Publish

```bash
npm publish --access public
```

For scoped packages (`@scope/name`):
```bash
npm publish --access public
# --access public is REQUIRED for scoped packages (default is restricted)
```

### Step 7: Verify

```bash
curl -s https://registry.npmjs.org/<package-name> | head -5
# Or
npm info <package-name>
```

## Error Troubleshooting

### E401 - Unauthorized

```
npm error code E401
npm error 401 Unauthorized - GET https://registry.npmjs.org/-/whoami
```

**Causes & Fixes:**
1. Token expired → Regenerate at npmjs.com/settings/tokens
2. Token invalid (typo) → Check `.npmrc` content
3. Token was revoked → Generate new token
4. Wrong registry in `.npmrc` → Ensure `//registry.npmjs.org/:_authToken=...`

### E403 - Forbidden

```
npm error code E403
npm error 403 Forbidden - PUT https://registry.npmjs.org/<pkg>
```

**Variant 1: "You may not perform that action with these credentials"**
- Token type is Automation (read-only) → Regenerate as Publish or Granular token

**Variant 2: "Two-factor authentication or granular access token with bypass 2fa enabled is required"**
- Account has 2FA but token doesn't bypass it
- Fix: Regenerate Granular Token with "Bypass 2FA for publishing" enabled

**Variant 3: "Package name too similar to existing packages"**
- npm name squatting protection
- Fix: Choose a different package name or use scoped name `@scope/name`

### E404 - Not Found

```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/<pkg>
```

**Causes & Fixes:**
1. Token doesn't have publish permission → Regenerate with publish access
2. Publishing to wrong registry → Check `npm config get registry`
3. Scoped package without org membership → Use `--access public`

### ENEEDAUTH - Need Auth

```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in to https://mirrors.xxx.com/
```

**Cause**: Registry is set to a mirror that requires auth.
**Fix**: Switch to official registry:
```bash
npm config set registry https://registry.npmjs.org/
```

## Windows-Specific Issues

### npm commands produce no output

Some Windows shell environments swallow npm output.

**Fix**: Call npm via Node directly:
```bash
node "/path/to/nodejs/node_modules/npm/bin/npm-cli.js" publish --access public
```

Common paths:
- `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`
- `/d/Program Files/nodejs/node_modules/npm/bin/npm-cli.js` (Git Bash)

### npm install creates no node_modules

Same shell issue. Use direct invocation:
```bash
node "/path/to/nodejs/node_modules/npm/bin/npm-cli.js" install
```

## Version Bumping

```bash
# Patch: 0.1.0 → 0.1.1 (bug fixes)
npm version patch

# Minor: 0.1.0 → 0.2.0 (new features, backwards compatible)
npm version minor

# Major: 0.1.0 → 1.0.0 (breaking changes)
npm version major

# Then publish
npm publish --access public
```

## Complete Example Session

```bash
# 1. Verify registry
npm config set registry https://registry.npmjs.org/

# 2. Create .npmrc with token
echo "//registry.npmjs.org/:_authToken=npm_xxxxx" > .npmrc

# 3. Verify auth
npm whoami
# → kungeskills

# 4. Check package contents
npm pack --dry-run

# 5. Publish
npm publish --access public
# → + kungeskill@0.1.0

# 6. Verify on registry
curl -s https://registry.npmjs.org/kungeskill | head -5
```

## Checklist Before Every Publish

- [ ] `npm config get registry` → `https://registry.npmjs.org/`
- [ ] `npm whoami` → shows username
- [ ] `package.json` version is bumped
- [ ] `.npmrc` has valid token (Granular + bypass 2FA)
- [ ] `.npmrc` is in `.gitignore` (never commit tokens)
- [ ] `npm pack --dry-run` → no secrets, no junk files
- [ ] `npm publish --access public`
