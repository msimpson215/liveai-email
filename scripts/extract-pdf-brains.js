#!/usr/bin/env node
/**
 * Reads all PDFs under docs/business-brains/ (including unzipped/) and writes text to extracted/
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFParse } from 'pdf-parse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', 'docs', 'business-brains')
const outDir = path.join(srcDir, 'extracted')

function findPdfs(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'extracted') continue
      findPdfs(full, list)
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      list.push(full)
    }
  }
  return list
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const pdfs = findPdfs(srcDir)
if (!pdfs.length) {
  console.log('No PDFs found under docs/business-brains/ yet.')
  process.exit(0)
}

for (const filePath of pdfs) {
  const rel = path.relative(srcDir, filePath).replace(/[/\\]/g, '__')
  const base = rel.replace(/\.pdf$/i, '')
  const parser = new PDFParse({ data: fs.readFileSync(filePath) })
  const data = await parser.getText()
  fs.writeFileSync(path.join(outDir, `${base}.txt`), data.text.trim() + '\n')
  console.log(`OK ${rel} (${data.text.length} chars)`)
  await parser.destroy()
}

console.log(`\nExtracted ${pdfs.length} PDF(s) → docs/business-brains/extracted/`)
