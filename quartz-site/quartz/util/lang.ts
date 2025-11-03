export function capitalize(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1)
}

export function classNames(
  ...classes: Array<string | undefined | null | false>
): string {
  return classes.filter((cls) => typeof cls === "string" && cls.length > 0).join(" ")
}
