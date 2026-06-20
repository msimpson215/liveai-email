#!/usr/bin/env node
/**
 * Reads all PDFs in docs/business-brains/ and writes extracted text to docs/business-brains/extracted/
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFParse } from 'pdf-parse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'docs', 'business-brains')
const outDir = path.join(srcDir, 'extracted')

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const pdfs = fs.readdirSync(srcDir).filter(f => f.toLowerCase().endsWith('.pdf'))
if (!pdfs.length) {
  console.log('No PDFs in docs/business-brains/ yet.')
  process.exit(0)
}

for (const file of pdfs) {
  const filePath = path.join(srcDir, file)
  const parser = new PDFParse({ data: fs.readFileSync(filePath) })
  const data = await parser.getText()
  const base = path.basename(file, path.extname(file))
  const out = path.join(outDir, `${base}.txt`)
  fs.writeFileSync(out, data.text.trim() + '\n')
  console.log(`OK ${file} (${data.text.length} chars)`)
  await parser.destroy()
}

console.log(`\nExtracted ${pdfs.length} PDF(s) → docs/business-brains/extracted/`)
