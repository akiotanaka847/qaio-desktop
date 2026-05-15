#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: ./scripts/release.sh <version>}"

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be semver (e.g., 0.2.0)"
  exit 1
fi

echo "Releasing Qaio v$VERSION..."

# 1. Bump all versions
./scripts/version.sh "$VERSION"

# 2. Update CHANGELOG
echo "TODO: Update CHANGELOG.md with v$VERSION changes"

# 3. Commit
git add -A
git commit -m "release: v$VERSION"

# 4. Tag
git tag -a "v$VERSION" -m "Qaio v$VERSION"

# 5. Push
git push origin main --tags

# 6. Publish npm packages
echo "Publishing npm packages..."
for pkg in core chat board layout workspace skills connections events routines review memory; do
  (cd "ui/$pkg" && npm publish --access public)
done

# 7. Publish Rust crates (in dependency order)
echo "Publishing Rust crates..."
for crate in qaio-db qaio-events qaio-terminal-manager qaio-scheduler qaio-channels qaio-memory qaio-skills; do
  (cd "engine/$crate" && cargo publish)
  sleep 15  # crates.io rate limit
done
# qaio-tauri lives in app/ (Tauri adapter, not part of Engine)
(cd "app/qaio-tauri" && cargo publish)

# 8. Create GitHub release
echo "Creating GitHub release..."
gh release create "v$VERSION" \
  --title "Qaio v$VERSION" \
  --generate-notes

echo "Released Qaio v$VERSION"
