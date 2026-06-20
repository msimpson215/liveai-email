#!/usr/bin/env node
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
execSync('node scripts/unzip-brains.js', { cwd: path.join(dir, '..'), stdio: 'inherit' })
execSync('node scripts/extract-pdf-brains.js', { cwd: path.join(dir, '..'), stdio: 'inherit' })
