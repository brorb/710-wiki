#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import yaml from "yaml"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const repoRoot = path.resolve(__dirname, "..")
const contentDir = path.join(repoRoot, "Content")
const defaultCanvasPath = "static/canvas/html"

const normalizeHandle = (value) => {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.replace(/\.html?$/i, "")
}

const normalizeCanvasPath = (value) => {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "")
}

const splitCanvasReference = (raw) => {
  const segments = raw.split("/").filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    return { handle: null, subPath: null }
  }

  const fileName = segments.pop()
  const handle = normalizeHandle(fileName)
  const subPath = segments.length > 0 ? segments.join("/") : null
  return { handle, subPath }
}

const pickCanvasReference = (frontmatter = {}) => {
  for (const key of ["canvas", "canvasSlug", "canvasFile"]) {
    const value = frontmatter[key]
    if (typeof value !== "string") {
      continue
    }

    const normalized = value.trim()
    if (!normalized) {
      continue
    }

    const { handle, subPath } = splitCanvasReference(normalized)
    if (handle) {
      return { handle, subPath }
    }
  }

  return null
}

const mapToRepoPath = (relativeDir) => {
  if (!relativeDir) {
    return null
  }

  if (relativeDir.startsWith("static/")) {
    return path.join("quartz-site", "quartz", relativeDir)
  }

  return relativeDir
}

const readFrontmatter = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8")
  if (!content.startsWith("---")) {
    return null
  }

  const endIndex = content.indexOf("\n---", 3)
  if (endIndex === -1) {
    return null
  }

  const rawFrontmatter = content.slice(3, endIndex + 1)
  try {
    return yaml.parse(rawFrontmatter)
  } catch {
    return null
  }
}

const walkMarkdownFiles = (dir, acc = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, acc)
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      acc.push(fullPath)
    }
  }
  return acc
}

const canvasIssues = []
const filesWithCanvas = []

if (!fs.existsSync(contentDir)) {
  console.error(`Content directory not found at ${contentDir}`)
  process.exit(1)
}

for (const filePath of walkMarkdownFiles(contentDir)) {
  const frontmatter = readFrontmatter(filePath) ?? undefined
  const reference = pickCanvasReference(frontmatter)
  if (!reference) {
    continue
  }

  const fmCanvasPath = normalizeCanvasPath(frontmatter?.canvasPath) ?? reference.subPath ?? null
  const relativeDir = fmCanvasPath ?? defaultCanvasPath
  const repoRelativeDir = mapToRepoPath(relativeDir) ?? defaultCanvasPath
  const absoluteDir = path.join(repoRoot, repoRelativeDir)
  const htmlFile = path.join(absoluteDir, `${reference.handle}.html`)

  filesWithCanvas.push({ filePath, htmlFile, relativeDir, handle: reference.handle })

  if (!fs.existsSync(htmlFile)) {
    canvasIssues.push({
      note: path.relative(repoRoot, filePath),
      expected: path.relative(repoRoot, htmlFile),
    })
  }
}

if (canvasIssues.length > 0) {
  console.error("Canvas validation failed:")
  for (const issue of canvasIssues) {
    console.error(` • ${issue.note} references a canvas, but ${issue.expected} is missing.`)
  }
  process.exit(1)
}

if (filesWithCanvas.length > 0) {
  console.log(`Canvas validation passed for ${filesWithCanvas.length} note(s).`)
} else {
  console.log("No canvas-enabled notes found.")
}
