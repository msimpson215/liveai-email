#!/usr/bin/env node
/**
 * Unzips any .zip in docs/business-brains/ into docs/business-brains/unzipped/
 * Skips zips already extracted (same folder name exists with content).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', 'docs', 'business-brains')
const outDir = path.join(srcDir, 'unzipped')

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const zips = fs.readdirSync(srcDir).filter(f => f.toLowerCase().endsWith('.zip'))
if (!zips.length) {
  console.log('No zip files in docs/business-brains/ yet.')
  process.exit(0)
}

for (const zip of zips) {
  const dest = path.join(outDir, path.basename(zip, path.extname(zip)))
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  execSync(`unzip -o ${JSON.stringify(path.join(srcDir, zip))} -d ${JSON.stringify(dest)}`, {
    stdio: 'inherit'
  })
  console.log(`OK unzipped ${zip} → unzipped/${path.basename(dest)}/`)
}

console.log(`\nUnzipped ${zips.length} archive(s). Run: npm run extract-pdfs`)
