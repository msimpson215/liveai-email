#!/usr/bin/env node
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dir, '..')
execSync('node scripts/unzip-brains.js', { cwd: root, stdio: 'inherit' })
execSync('node scripts/extract-pdf-brains.js', { cwd: root, stdio: 'inherit' })
execSync('node scripts/extract-docx-brains.js', { cwd: root, stdio: 'inherit' })
