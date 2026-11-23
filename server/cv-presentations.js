import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'cv2', 'presentations.json')

function slug(value, max = 40) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, max)
}

export function loadPresentations() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'))
}

export function resolvePresentation(query = {}) {
  const data = loadPresentations()
  const byId = Object.fromEntries((data.projects || []).map((project) => [project.id, project]))
  const presets = data.presets || {}
  const view = slug(query.view)
  const f1 = slug(query.f1)
  const f2 = slug(query.f2)

  let ids = []
  let key = 'general'

  if (f1 && f2 && byId[f1] && byId[f2] && f1 !== f2) {
    ids = [f1, f2]
    key = presets[view] ? view : (view || 'custom')
  } else if (view && presets[view] && Array.isArray(presets[view].featured)) {
    ids = presets[view].featured
    key = view
  } else {
    ids = (presets.general && presets.general.featured) || ['axon-ai', 'dna']
    key = 'general'
  }

  const featured = ids.map((id) => byId[id]).filter(Boolean).slice(0, 2)
  const preset = presets[key] || {}
  return {
    view: key,
    name: preset.name || '',
    featured
  }
}

export function presentationInstructions(presentation) {
  if (!presentation || !Array.isArray(presentation.featured) || presentation.featured.length === 0) {
    return ''
  }
  const lines = presentation.featured.map((project, index) => {
    const note = project.ai || project.summary || ''
    return `${index + 1}. ${project.title}${note ? ` — ${note}` : ''}`
  }).join('\n')
  return `
THIS VISITOR'S PRESENTATION:
This person opened a targeted link to the same curriculum vitae — not a different website, and not a different AI. Two projects are featured at the top of the page:
${lines}
If they ask what they should look at, what he is working on now, or where to start, lead with those two. Keep the rest of this file. You still know the full factual career history. Do not invent a different biography. Do not mention presets, configuration, query parameters, or that this page was customized for a named recipient unless they bring that up. Do not say you are a different system for this visitor.
`
}
