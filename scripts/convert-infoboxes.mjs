#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
import { globby } from "globby"

const workspaceRoot = process.cwd()
const contentDir = path.join(workspaceRoot, "Content")

const createInfoboxBlock = (infobox) => {
  if (!infobox || typeof infobox !== "object") {
    return null
  }

  const sections = []

  const normalize = (value) => (typeof value === "string" ? value.trim() : "")

  const title = normalize(infobox.title)
  if (title) {
    sections.push(`Title: ${title}`)
  }

  const image = infobox.image && typeof infobox.image === "object" ? infobox.image : {}
  const imageSrc = normalize(image.src)
  const imageAlt = normalize(image.alt)
  const imageCaption = normalize(image.caption)

  if (imageSrc) {
    sections.push(`Image: ${imageSrc}`)
  }
  if (imageAlt) {
    sections.push(`Alt: ${imageAlt}`)
  }
  if (imageCaption) {
    sections.push(`Caption: ${imageCaption}`)
  }

  const items = Array.isArray(infobox.items) ? infobox.items : []
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      continue
    }

    const label = normalize(rawItem.label)
    if (!label) {
      continue
    }

    const rawValue = rawItem.value
    const asArray = Array.isArray(rawValue)
      ? rawValue
      : rawValue === undefined || rawValue === null
        ? []
        : [rawValue]

    const values = asArray
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry)))
      .filter((entry) => entry.length > 0)

    if (values.length === 0) {
      continue
    }

    if (values.length === 1) {
      sections.push(`${label}: ${values[0]}`)
    } else {
      sections.push(`${label}:`)
      for (const value of values) {
        sections.push(`- ${value}`)
      }
    }
  }

  if (sections.length === 0) {
    return null
  }

  return `\u0060\u0060\u0060infobox\n${sections.join("\n")}\n\u0060\u0060\u0060\n`
}

const normalizeNewlines = (value) => value.replace(/\r\n?/g, "\n")
const sanitizeForMatter = (value) => normalizeNewlines(value).replace(/\t/g, "  ")

const main = async () => {
  const files = await globby("**/*.md", { cwd: contentDir })
  const updated = []

  for (const relativePath of files) {
    const absolutePath = path.join(contentDir, relativePath)
  const raw = await fs.readFile(absolutePath, "utf8")
    const normalized = sanitizeForMatter(raw)
    let parsed
    try {
      parsed = matter(normalized)
    } catch (error) {
      console.error(`Failed to parse ${relativePath}: ${error.message}`)
      continue
    }
    const { data, content } = parsed
    const infobox = data?.infobox

    if (!infobox || typeof infobox !== "object") {
      continue
    }

    if (/```infobox/.test(content)) {
      // Already migrated
      delete data.infobox
  const output = matter.stringify(content, data)
  await fs.writeFile(absolutePath, normalizeNewlines(output), "utf8")
      updated.push(relativePath)
      continue
    }

    const infoboxBlock = createInfoboxBlock(infobox)
    if (!infoboxBlock) {
      delete data.infobox
  const output = matter.stringify(content, data)
  await fs.writeFile(absolutePath, normalizeNewlines(output), "utf8")
      updated.push(relativePath)
      continue
    }

    delete data.infobox

    const trimmedContent = content.trimStart()
    const body = trimmedContent.length > 0 ? `\n\n${trimmedContent}` : ""
    const newContent = `${infoboxBlock}${body}`
    const output = matter.stringify(newContent, data)
    await fs.writeFile(absolutePath, normalizeNewlines(output), "utf8")
    updated.push(relativePath)
  }

  if (updated.length > 0) {
    console.log(`Updated ${updated.length} file(s).`)
  } else {
    console.log("No infobox frontmatter entries found.")
  }
}

await main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
