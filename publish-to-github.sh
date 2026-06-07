#!/bin/zsh
set -e

cd "$(dirname "$0")"

if ! git status >/dev/null 2>&1; then
  git init
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin https://github.com/pohlk888/siph-laser-coupling-video.git
fi

git add index.html styles.css app.js README.md .gitignore

if git diff --cached --quiet; then
  echo "No simulator file changes to publish."
  exit 0
fi

message="$1"
if [ -z "$message" ]; then
  message="Update SiPh simulator $(date '+%Y-%m-%d %H:%M')"
fi

git commit -m "$message"
git branch -M main
git push -u origin main

echo "Published to GitHub."
