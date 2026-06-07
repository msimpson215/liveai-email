#!/bin/bash
set -e
cd "$(dirname "$0")"
git init -b main
git add -A
git commit -m "SiteEye360 site" || true
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/msimpson215/siteeye360.git"
git push -u origin main --force
