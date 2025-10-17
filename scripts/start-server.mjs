#!/usr/bin/env node
import { spawn } from "child_process"

const port = process.env.PORT ?? "3000"
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx"
const args = ["serve", "quartz-site/public", "-l", port]

const child = spawn(npxCommand, args, {
  stdio: "inherit",
  shell: false,
})

const handleExit = (signal) => {
  if (child.exitCode === null) {
    child.kill(signal)
  }
}

process.on("SIGINT", handleExit)
process.on("SIGTERM", handleExit)

child.on("exit", (code) => {
  process.exit(code ?? 0)
})
