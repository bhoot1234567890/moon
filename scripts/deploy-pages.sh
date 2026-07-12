#!/usr/bin/env bash
# Build the static site and deploy to Cloudflare Pages (moon-portfolio).
# Reused by the pre-push git hook and `npm run deploy`. Local wrangler auth is used.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "==> Building Tailwind CSS"
npm run build:css

echo "==> Assembling dist-pages/"
rm -rf dist-pages && mkdir -p dist-pages
# All media lives in R2 (cdn.chaitanyamalhotra.com); deploy only the static site.
rsync -a \
  --exclude='.git' --exclude='.github' --exclude='.githooks' --exclude='scripts' \
  --exclude='node_modules' --exclude='.wrangler' --exclude='dist-pages' --exclude='dist' \
  --exclude='cdn' --exclude='moon-app' \
  --exclude='package.json' --exclude='package-lock.json' \
  --exclude='tailwind.config.js' --exclude='CNAME' --exclude='.gitignore' \
  --exclude='src/app.css' \
  --exclude='assets/videos' --exclude='assets/podcasts' --exclude='assets/original_text' \
  --exclude='assets/flashcards' --exclude='assets/music' --exclude='assets/models' \
  --exclude='*.md' --exclude='*.tex' --exclude='*.png' --exclude='*.jpg' \
  --exclude='*.mp4' --exclude='*.mp3' --exclude='*.pdf' --exclude='*.glb' --exclude='*.obj' \
  --exclude='*.ttf' --exclude='*.woff' --exclude='*.woff2' \
  --exclude='*.bak' --exclude='*.aux' --exclude='*.log' --exclude='*.out' \
  --exclude='*.fls' --exclude='*.fdb_latexmk' --exclude='*.synctex.gz' \
  --exclude='*.sqlite' --exclude='*.sqlite-shm' --exclude='*.sqlite-wal' \
  --exclude='.DS_Store' \
  ./ dist-pages/

echo "==> Deploying to Cloudflare Pages (moon-portfolio)"
wrangler pages deploy dist-pages --project-name moon-portfolio --branch main --commit-dirty=true
