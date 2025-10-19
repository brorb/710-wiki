import { promises as fs } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import YAML from "yaml"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, "..")
const CONTENT_DIR = path.join(ROOT_DIR, "Content")
const CHECK_MODE = process.argv.includes("--check")

const TAB_PATTERN = /\t/g

const LIST_EMBED_PATTERN = /^([ \t]*-\s+)([^"'\n][^\n]*)$/
const KEY_VALUE_PATTERN = /^([ \t]*[^:#\n]+:\s*)([^\n]+)$/

const needsEmbedQuotes = (raw) => /!?\[\[[^\]]+\]\]/.test(raw.trimStart())

const escapeForDoubleQuotes = (value) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\\"')

async function collectMarkdownFiles(dir) {
  const results = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(fullPath)
      results.push(...nested)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      results.push(fullPath)
    }
  }
  return results
}

function sanitizeFrontmatter(frontmatter) {
  const lines = frontmatter.split(/\r?\n/)
  const sanitized = lines.map((line) => {
    if (!line.includes("\t")) {
      return line
    }
    return line.replace(TAB_PATTERN, "  ")
  })

  for (let i = 0; i < sanitized.length; i++) {
    const line = sanitized[i]
    if (!line.trim()) continue

    const listMatch = sanitized[i].match(LIST_EMBED_PATTERN)
    if (listMatch) {
      const [, prefix, rest] = listMatch
      const trimmedRest = rest.trim()
      if (trimmedRest && !trimmedRest.startsWith("\"") && !trimmedRest.startsWith("'") && needsEmbedQuotes(trimmedRest)) {
        sanitized[i] = `${prefix}"${escapeForDoubleQuotes(trimmedRest)}"`
        continue
      }
    }

    const keyMatch = sanitized[i].match(KEY_VALUE_PATTERN)
    if (keyMatch) {
      const [, prefix, remainder] = keyMatch
      const trimmedRemainder = remainder.trim()
      if (
        trimmedRemainder &&
        !trimmedRemainder.startsWith("\"") &&
        !trimmedRemainder.startsWith("'") &&
        needsEmbedQuotes(trimmedRemainder)
      ) {
        sanitized[i] = `${prefix}"${escapeForDoubleQuotes(trimmedRemainder)}"`
      }
    }
  }

  return sanitized.join("\n")
}

function normalizeFrontmatter(frontmatter) {
  const sanitized = sanitizeFrontmatter(frontmatter)
  const doc = YAML.parseDocument(sanitized, { prettyErrors: true })

  if (doc.errors.length > 0) {
    const errorMessages = doc.errors.map((err) => err.message).join("\n")
    throw new Error(errorMessages)
  }

  doc.options = {
    ...doc.options,
    indent: 2,
    lineWidth: 0,
  }

  return doc.toString().trimEnd()
}

async function processFile(filePath, results) {
  const raw = await fs.readFile(filePath, "utf8")
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/) // frontmatter must be at top
  if (!match) {
    return
  }

  const [block, frontmatterContent] = [match[0], match[1]]
  let normalized

  try {
    normalized = normalizeFrontmatter(frontmatterContent)
  } catch (error) {
    results.failed.push({ filePath, message: error.message })
    return
  }

  const normalizedBlock = `---\n${normalized}\n---\n`
  const rest = raw.slice(block.length)
  const candidate = normalizedBlock + rest

  if (candidate !== raw) {
    if (CHECK_MODE) {
      results.modified.push(filePath)
    } else {
      await fs.writeFile(filePath, candidate)
      results.fixed.push(filePath)
    }
  }
}

async function main() {
  const files = await collectMarkdownFiles(CONTENT_DIR)
  const results = { fixed: [], modified: [], failed: [] }

  for (const file of files) {
    await processFile(file, results)
  }

  if (results.failed.length > 0) {
    for (const failure of results.failed) {
      console.error(`Frontmatter parse failure in ${path.relative(ROOT_DIR, failure.filePath)}:\n${failure.message}\n`)
    }
    process.exitCode = 1
    return
  }

  if (CHECK_MODE) {
    if (results.modified.length > 0) {
      console.error("Frontmatter needs formatting in:\n" + results.modified.map((file) => `  - ${path.relative(ROOT_DIR, file)}`).join("\n"))
      process.exitCode = 1
    } else {
      console.log("Frontmatter format check passed.")
    }
    return
  }

  if (results.fixed.length > 0) {
    console.log("Normalized frontmatter in:")
    for (const file of results.fixed) {
      console.log(`  - ${path.relative(ROOT_DIR, file)}`)
    }
  } else {
    console.log("Frontmatter already normalized.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
