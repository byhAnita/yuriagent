#!/usr/bin/env bash
# deploy.sh - build and publish the hand-test site to GitHub Pages.
#
#   bash deploy.sh                  # validate, build, publish
#   SKIP_CHECKS=1 bash deploy.sh    # skip lint+tests (only when iterating fast)
#   BASE_URL=/yuriagent/ bash deploy.sh   # absolute base, if a host wants one
#
# WHAT THIS PUBLISHES, AND WHY IT IS NOT THE RELEASE
#
# The site is the hand-test build (CLAUDE.md section 17). The game is designed
# for a 390x844 phone and spent six milestones being played only on a desktop;
# this exists so it can be tested on the device it is for. `main` plus a tag is
# still what players get.
#
# WHY A BRANCH AND NOT GITHUB ACTIONS
#
# The Actions route needs three server-side things to line up - Pages enabled,
# a `pages: write` token, and a `github-pages` environment whose branch policy
# permits the branch. GitHub creates that policy hardcoded to `main`, so
# deploying `dev` failed at environment resolution in two seconds, before step
# one, with nothing in the log saying why. Pushing a branch needs none of that.
#
# `.github/workflows/pages.yml` still runs lint + tests + build on every push -
# that part was always green and is worth keeping. It just does not deploy.

set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-gh-pages}"
BASE="${BASE_URL:-./}"

REMOTE=$(git remote get-url origin)
SOURCE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
SHA=$(git rev-parse --short HEAD)

# Deploying a dirty tree publishes something no commit describes, which makes a
# bug report impossible to line up against the source. Warn, do not block: an
# untracked scratch file is not a reason to refuse.
if [ -n "$(git status --porcelain)" ]; then
  echo "!!  Working tree is dirty. The site will not match commit ${SHA}."
  echo ""
fi

if [ "${SKIP_CHECKS:-0}" != "1" ]; then
  echo "=== [1/4] Validate ==="
  npm run lint
  npm test
else
  echo "=== [1/4] Validate - SKIPPED ==="
fi

echo ""
echo "=== [2/4] Build (base=${BASE}) ==="
rm -rf dist
BASE_URL="$BASE" npm run build

# Jekyll is on by default for branch-served Pages and quietly drops anything
# whose name starts with an underscore. Vite does not emit such files today;
# this costs one empty file and removes a whole class of "it works locally"
# surprise if that ever changes.
touch dist/.nojekyll

echo ""
echo "=== [3/4] Check the build is complete ==="
# The whole dist/ is published, not a hand-picked list of JS and CSS. This
# project's PWA needs its manifest, its worker and its portraits, and a copy
# rule that names file types silently drops them - which is exactly how a
# deployed build ends up unable to install and missing every face.
missing=0
for f in index.html manifest.webmanifest sw.js favicon.svg; do
  if [ ! -f "dist/$f" ]; then echo "    MISSING dist/$f"; missing=1; fi
done
for d in assets portraits icons; do
  if [ ! -d "dist/$d" ]; then echo "    MISSING dist/$d/"; missing=1; fi
done
if [ "$missing" = "1" ]; then
  echo "Refusing to publish an incomplete build."
  exit 1
fi
echo "    $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"

echo ""
echo "=== [4/4] Publish to ${BRANCH} ==="
# A throwaway repo inside dist/, force-pushed. The branch is build output and
# has no history worth keeping - every commit would be a full copy of the
# bundle, and the source history already lives on ${SOURCE_BRANCH}.
#
# dist/ is gitignored, so this .git never confuses the real repo.
rm -rf dist/.git
git -C dist init -q
# Build output is bytes, not source: line endings must survive the round trip
# untouched, and on Windows the default would rewrite them and print a warning
# per file about it.
git -C dist config core.autocrlf false
git -C dist checkout -q -b "$BRANCH"
git -C dist add -A
git -C dist -c user.name="$(git config user.name)" \
             -c user.email="$(git config user.email)" \
             commit -q -m "deploy: ${SOURCE_BRANCH}@${SHA}"
git -C dist push -q -f "$REMOTE" "$BRANCH:$BRANCH"
rm -rf dist/.git

OWNER_REPO=$(echo "$REMOTE" | sed -E 's#.*github\.com[:/]##; s#\.git$##')
USER=${OWNER_REPO%%/*}
REPO=${OWNER_REPO##*/}

echo ""
echo "Published ${SOURCE_BRANCH}@${SHA} to ${BRANCH}."
echo ""
echo "    https://${USER}.github.io/${REPO}/"
echo "    https://${USER}.github.io/${REPO}/?debug=1     <- with the mobile console"
echo ""
echo "First time only: Settings -> Pages -> Source: Deploy from a branch"
echo "                 Branch: ${BRANCH} / (root)"
