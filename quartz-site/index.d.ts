declare module "*.scss" {
  const content: string
  export = content
}

// dom custom event
interface CustomEventMap {
  prenav: CustomEvent<{}>
  nav: CustomEvent<{ url: FullSlug }>
  themechange: CustomEvent<{ theme: "light" | "dark" }>
  readermodechange: CustomEvent<{ mode: "on" | "off" }>
}

type ContentIndex = Record<
  import("./quartz/util/path").FullSlug,
  import("./quartz/plugins/emitters/contentIndex").SerializedContentDetails
>
declare const fetchData: Promise<ContentIndex>
