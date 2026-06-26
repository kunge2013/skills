#!/usr/bin/env bash
# [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
#
# publish.sh — Bump version and publish kungeskill to npm
#
# Usage:
#   ./scripts/publish.sh          # patch bump (0.3.1 → 0.3.2)
#   ./scripts/publish.sh minor    # minor bump (0.3.1 → 0.4.0)
#   ./scripts/publish.sh major    # major bump (0.3.1 → 1.0.0)
#   ./scripts/publish.sh 1.2.3    # explicit version

# [AGC:START] tool=Cc author=fangkun
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# --- Pre-flight checks ---

# 1. Verify registry
REGISTRY=$(npm config get registry)
if [[ "$REGISTRY" != "https://registry.npmjs.org/" ]]; then
  echo "⚠ Registry is set to: $REGISTRY"
  echo "  Switching to official npm registry..."
  npm config set registry https://registry.npmjs.org/
fi

# 2. Verify auth
WHOAMI=$(npm whoami 2>/dev/null || true)
if [[ -z "$WHOAMI" ]]; then
  echo "✗ Not authenticated. Check .npmrc token."
  echo "  See: https://www.npmjs.com/settings/<username>/tokens"
  exit 1
fi
echo "✓ Authenticated as: $WHOAMI"

# 3. Current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "  Current version: $CURRENT_VERSION"

# --- Version bump ---

BUMP_TYPE="${1:-patch}"

case "$BUMP_TYPE" in
  patch|minor|major)
    echo "  Bumping: $BUMP_TYPE"
    npm version "$BUMP_TYPE" --no-git-tag-version --quiet
    ;;
  [0-9]*)
    echo "  Setting version: $BUMP_TYPE"
    npm version "$BUMP_TYPE" --no-git-tag-version --quiet
    ;;
  *)
    echo "✗ Invalid argument: $BUMP_TYPE"
    echo "  Usage: $0 [patch|minor|major|x.y.z]"
    exit 1
    ;;
esac

NEW_VERSION=$(node -p "require('./package.json').version")
echo "  New version: $NEW_VERSION"

# --- Dry run ---

echo ""
echo "--- Package contents ---"
npm pack --dry-run 2>&1 | grep "npm notice" | head -20
echo ""

# --- Publish ---

read -r -p "Publish kungeskill@$NEW_VERSION? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted. Rolling back version..."
  npm version "$CURRENT_VERSION" --no-git-tag-version --quiet
  exit 0
fi

npm publish --access public

echo ""
echo "✓ Published kungeskill@$NEW_VERSION"
echo "  https://www.npmjs.com/package/kungeskill"
# [AGC:END]
