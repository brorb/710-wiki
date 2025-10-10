let cachedVersion: string | null = null

export function getAssetVersion(): string {
  if (cachedVersion) {
    return cachedVersion
  }

  const envVersion = process.env.QUARTZ_ASSET_VERSION
  if (envVersion && envVersion.trim().length > 0) {
    cachedVersion = envVersion.trim()
    return cachedVersion
  }

  cachedVersion = Date.now().toString()
  return cachedVersion
}
