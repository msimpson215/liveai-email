#!/usr/bin/env node
/**
 * Extract text from all .docx under docs/business-brains/ → extracted/
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mammoth from 'mammoth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', 'docs', 'business-brains')
const outDir = path.join(srcDir, 'extracted')

function findDocx(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'extracted' || entry.name === 'unzipped') continue
      findDocx(full, list)
    } else if (/\.docx?$/i.test(entry.name)) {
      list.push(full)
    }
  }
  return list
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const files = findDocx(srcDir)
if (!files.length) {
  console.log('No docx files found.')
  process.exit(0)
}

for (const filePath of files) {
  const rel = path.relative(srcDir, filePath).replace(/[/\\]/g, '__')
  const base = rel.replace(/\.docx?$/i, '')
  const out = path.join(outDir, `${base}.txt`)
  try {
    const { value } = await mammoth.extractRawText({ path: filePath })
    fs.writeFileSync(out, value.trim() + '\n')
    console.log(`OK ${rel} (${value.length} chars)`)
  } catch (err) {
    console.log(`SKIP ${rel}: ${err.message}`)
  }
}

console.log(`\nExtracted ${files.length} docx → docs/business-brains/extracted/`)
