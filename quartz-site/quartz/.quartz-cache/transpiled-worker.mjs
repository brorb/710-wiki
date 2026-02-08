var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// quartz/worker.ts
import sourceMapSupport from "source-map-support";

// quartz.config.ts
import * as path12 from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";

// quartz/plugins/transformers/frontmatter.ts
import matter from "gray-matter";
import remarkFrontmatter from "remark-frontmatter";
import yaml from "js-yaml";
import toml from "toml";

// quartz/util/path.ts
import { slug as slugAnchor } from "github-slugger";

// quartz/util/clone.ts
import rfdc from "rfdc";
var clone = rfdc();

// quartz/util/path.ts
var QUARTZ = "quartz";
function isRelativeURL(s) {
  const validStart = /^\.{1,2}/.test(s);
  const validEnding = !endsWith(s, "index");
  return validStart && validEnding && ![".md", ".html"].includes(getFileExtension(s) ?? "");
}
__name(isRelativeURL, "isRelativeURL");
function sluggify(s) {
  return s.split("/").map(
    (segment) => segment.replace(/\s/g, "-").replace(/&/g, "-and-").replace(/%/g, "-percent").replace(/\?/g, "").replace(/#/g, "")
  ).join("/").replace(/\/$/, "");
}
__name(sluggify, "sluggify");
function slugifyFilePath(fp, excludeExt) {
  fp = stripSlashes(fp);
  let ext = getFileExtension(fp);
  const withoutFileExt = ext ? fp.slice(0, -ext.length) : fp;
  if (excludeExt || [".md", ".html", void 0].includes(ext)) {
    ext = "";
  }
  let slug = sluggify(withoutFileExt);
  if (endsWith(slug, "_index")) {
    slug = slug.replace(/_index$/, "index");
  }
  return slug + ext;
}
__name(slugifyFilePath, "slugifyFilePath");
function simplifySlug(fp) {
  let res = stripSlashes(trimSuffix(fp, "index"), true);
  if (res.length === 0) {
    return "/";
  }
  const segments = res.split("/");
  const last = segments[segments.length - 1] ?? "";
  if (last.includes(".") && !res.endsWith("/")) {
    res = `${res}/`;
  }
  return res;
}
__name(simplifySlug, "simplifySlug");
function transformInternalLink(link) {
  let [fplike, anchor] = splitAnchor(decodeURI(link));
  const folderPath = isFolderPath(fplike);
  let segments = fplike.split("/").filter((x) => x.length > 0);
  let prefix = segments.filter(isRelativeSegment).join("/");
  let fp = segments.filter((seg) => !isRelativeSegment(seg) && seg !== "").join("/");
  const simpleSlug = simplifySlug(slugifyFilePath(fp));
  const joined = joinSegments(stripSlashes(prefix), stripSlashes(simpleSlug));
  const trail = folderPath ? "/" : "";
  const res = _addRelativeToStart(joined) + trail + anchor;
  return res;
}
__name(transformInternalLink, "transformInternalLink");
var _rebaseHastElement = /* @__PURE__ */ __name((el, attr, curBase, newBase) => {
  if (el.properties?.[attr]) {
    if (!isRelativeURL(String(el.properties[attr]))) {
      return;
    }
    const rel = joinSegments(resolveRelative(curBase, newBase), "..", el.properties[attr]);
    el.properties[attr] = rel;
  }
}, "_rebaseHastElement");
function normalizeHastElement(rawEl, curBase, newBase) {
  const el = clone(rawEl);
  _rebaseHastElement(el, "src", curBase, newBase);
  _rebaseHastElement(el, "href", curBase, newBase);
  if (el.children) {
    el.children = el.children.map(
      (child) => normalizeHastElement(child, curBase, newBase)
    );
  }
  return el;
}
__name(normalizeHastElement, "normalizeHastElement");
function pathToRoot(slug) {
  const segments = slug.split("/").filter((x) => x !== "");
  const depth = Math.max(segments.length - 1, 0);
  const needsExtraLevel = segments.at(-1)?.includes(".") ?? false;
  let rootPath = Array.from({ length: depth + (needsExtraLevel ? 1 : 0) }, () => "..").join("/");
  if (rootPath.length === 0) {
    rootPath = ".";
  }
  return rootPath;
}
__name(pathToRoot, "pathToRoot");
function resolveRelative(current, target) {
  const res = joinSegments(pathToRoot(current), simplifySlug(target));
  return res;
}
__name(resolveRelative, "resolveRelative");
function splitAnchor(link) {
  let [fp, anchor] = link.split("#", 2);
  if (fp.endsWith(".pdf")) {
    return [fp, anchor === void 0 ? "" : `#${anchor}`];
  }
  anchor = anchor === void 0 ? "" : "#" + slugAnchor(anchor);
  return [fp, anchor];
}
__name(splitAnchor, "splitAnchor");
function slugTag(tag) {
  return tag.split("/").map((tagSegment) => sluggify(tagSegment)).join("/");
}
__name(slugTag, "slugTag");
function joinSegments(...args) {
  if (args.length === 0) {
    return "";
  }
  let joined = args.filter((segment) => segment !== "" && segment !== "/").map((segment) => stripSlashes(segment)).join("/");
  if (args[0].startsWith("/")) {
    joined = "/" + joined;
  }
  if (args[args.length - 1].endsWith("/")) {
    joined = joined + "/";
  }
  return joined;
}
__name(joinSegments, "joinSegments");
function getAllSegmentPrefixes(tags) {
  const segments = tags.split("/");
  const results = [];
  for (let i = 0; i < segments.length; i++) {
    results.push(segments.slice(0, i + 1).join("/"));
  }
  return results;
}
__name(getAllSegmentPrefixes, "getAllSegmentPrefixes");
function transformLink(src, target, opts) {
  let targetSlug = transformInternalLink(target);
  if (opts.strategy === "relative") {
    return targetSlug;
  } else {
    const folderTail = isFolderPath(targetSlug) ? "/" : "";
    const canonicalSlug = stripSlashes(targetSlug.slice(".".length));
    let [targetCanonical, targetAnchor] = splitAnchor(canonicalSlug);
    if (opts.strategy === "shortest") {
      const matchingFileNames = opts.allSlugs.filter((slug) => {
        const parts = slug.split("/");
        const fileName = parts.at(-1);
        return targetCanonical === fileName;
      });
      if (matchingFileNames.length === 1) {
        const targetSlug2 = matchingFileNames[0];
        return resolveRelative(src, targetSlug2) + targetAnchor;
      }
    }
    return joinSegments(pathToRoot(src), canonicalSlug) + folderTail;
  }
}
__name(transformLink, "transformLink");
function isFolderPath(fplike) {
  return fplike.endsWith("/") || endsWith(fplike, "index") || endsWith(fplike, "index.md") || endsWith(fplike, "index.html");
}
__name(isFolderPath, "isFolderPath");
function endsWith(s, suffix) {
  return s === suffix || s.endsWith("/" + suffix);
}
__name(endsWith, "endsWith");
function trimSuffix(s, suffix) {
  if (endsWith(s, suffix)) {
    s = s.slice(0, -suffix.length);
  }
  return s;
}
__name(trimSuffix, "trimSuffix");
function getFileExtension(s) {
  return s.match(/\.[A-Za-z0-9]+$/)?.[0];
}
__name(getFileExtension, "getFileExtension");
function isRelativeSegment(s) {
  return /^\.{0,2}$/.test(s);
}
__name(isRelativeSegment, "isRelativeSegment");
function stripSlashes(s, onlyStripPrefix) {
  if (s.startsWith("/")) {
    s = s.substring(1);
  }
  if (!onlyStripPrefix && s.endsWith("/")) {
    s = s.slice(0, -1);
  }
  return s;
}
__name(stripSlashes, "stripSlashes");
function _addRelativeToStart(s) {
  if (s === "") {
    s = ".";
  }
  if (!s.startsWith(".")) {
    s = joinSegments(".", s);
  }
  return s;
}
__name(_addRelativeToStart, "_addRelativeToStart");

// quartz/i18n/locales/en-US.ts
var en_US_default = {
  propertyDefaults: {
    title: "Untitled",
    description: "No description provided"
  },
  components: {
    callout: {
      note: "Note",
      abstract: "Abstract",
      info: "Info",
      todo: "Todo",
      tip: "Tip",
      success: "Success",
      question: "Question",
      warning: "Warning",
      failure: "Failure",
      danger: "Danger",
      bug: "Bug",
      example: "Example",
      quote: "Quote"
    },
    backlinks: {
      title: "Backlinks",
      noBacklinksFound: "No backlinks found"
    },
    themeToggle: {
      lightMode: "Light mode",
      darkMode: "Dark mode"
    },
    readerMode: {
      title: "Reader mode"
    },
    explorer: {
      title: "Explorer"
    },
    footer: {
      createdWith: "Created with"
    },
    graph: {
      title: "Graph View"
    },
    recentNotes: {
      title: "Recent Notes",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `See ${remaining} more \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transclude of ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Link to original"
    },
    search: {
      title: "Search",
      searchBarPlaceholder: "Search for something"
    },
    tableOfContents: {
      title: "Table of Contents"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Recent notes",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Last ${count} notes`, "lastFewNotes")
    },
    error: {
      title: "Not Found",
      notFound: "Either this page is private or doesn't exist.",
      home: "Return to Homepage"
    },
    folderContent: {
      folder: "Folder",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item under this folder." : `${count} items under this folder.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Tag Index",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item with this tag." : `${count} items with this tag.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Showing first ${count} tags.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Found ${count} total tags.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/en-GB.ts
var en_GB_default = {
  propertyDefaults: {
    title: "Untitled",
    description: "No description provided"
  },
  components: {
    callout: {
      note: "Note",
      abstract: "Abstract",
      info: "Info",
      todo: "To-Do",
      tip: "Tip",
      success: "Success",
      question: "Question",
      warning: "Warning",
      failure: "Failure",
      danger: "Danger",
      bug: "Bug",
      example: "Example",
      quote: "Quote"
    },
    backlinks: {
      title: "Backlinks",
      noBacklinksFound: "No backlinks found"
    },
    themeToggle: {
      lightMode: "Light mode",
      darkMode: "Dark mode"
    },
    readerMode: {
      title: "Reader mode"
    },
    explorer: {
      title: "Explorer"
    },
    footer: {
      createdWith: "Created with"
    },
    graph: {
      title: "Graph View"
    },
    recentNotes: {
      title: "Recent Notes",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `See ${remaining} more \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transclude of ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Link to original"
    },
    search: {
      title: "Search",
      searchBarPlaceholder: "Search for something"
    },
    tableOfContents: {
      title: "Table of Contents"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Recent notes",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Last ${count} notes`, "lastFewNotes")
    },
    error: {
      title: "Not Found",
      notFound: "Either this page is private or doesn't exist.",
      home: "Return to Homepage"
    },
    folderContent: {
      folder: "Folder",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item under this folder." : `${count} items under this folder.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Tag Index",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item with this tag." : `${count} items with this tag.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Showing first ${count} tags.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Found ${count} total tags.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/fr-FR.ts
var fr_FR_default = {
  propertyDefaults: {
    title: "Sans titre",
    description: "Aucune description fournie"
  },
  components: {
    callout: {
      note: "Note",
      abstract: "R\xE9sum\xE9",
      info: "Info",
      todo: "\xC0 faire",
      tip: "Conseil",
      success: "Succ\xE8s",
      question: "Question",
      warning: "Avertissement",
      failure: "\xC9chec",
      danger: "Danger",
      bug: "Bogue",
      example: "Exemple",
      quote: "Citation"
    },
    backlinks: {
      title: "Liens retour",
      noBacklinksFound: "Aucun lien retour trouv\xE9"
    },
    themeToggle: {
      lightMode: "Mode clair",
      darkMode: "Mode sombre"
    },
    readerMode: {
      title: "Mode lecture"
    },
    explorer: {
      title: "Explorateur"
    },
    footer: {
      createdWith: "Cr\xE9\xE9 avec"
    },
    graph: {
      title: "Vue Graphique"
    },
    recentNotes: {
      title: "Notes R\xE9centes",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Voir ${remaining} de plus \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transclusion de ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Lien vers l'original"
    },
    search: {
      title: "Recherche",
      searchBarPlaceholder: "Rechercher quelque chose"
    },
    tableOfContents: {
      title: "Table des Mati\xE8res"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min de lecture`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Notes r\xE9centes",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Les derni\xE8res ${count} notes`, "lastFewNotes")
    },
    error: {
      title: "Introuvable",
      notFound: "Cette page est soit priv\xE9e, soit elle n'existe pas.",
      home: "Retour \xE0 la page d'accueil"
    },
    folderContent: {
      folder: "Dossier",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 \xE9l\xE9ment sous ce dossier." : `${count} \xE9l\xE9ments sous ce dossier.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\xC9tiquette",
      tagIndex: "Index des \xE9tiquettes",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 \xE9l\xE9ment avec cette \xE9tiquette." : `${count} \xE9l\xE9ments avec cette \xE9tiquette.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Affichage des premi\xE8res ${count} \xE9tiquettes.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Trouv\xE9 ${count} \xE9tiquettes au total.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/it-IT.ts
var it_IT_default = {
  propertyDefaults: {
    title: "Senza titolo",
    description: "Nessuna descrizione"
  },
  components: {
    callout: {
      note: "Nota",
      abstract: "Astratto",
      info: "Info",
      todo: "Da fare",
      tip: "Consiglio",
      success: "Completato",
      question: "Domanda",
      warning: "Attenzione",
      failure: "Errore",
      danger: "Pericolo",
      bug: "Bug",
      example: "Esempio",
      quote: "Citazione"
    },
    backlinks: {
      title: "Link entranti",
      noBacklinksFound: "Nessun link entrante"
    },
    themeToggle: {
      lightMode: "Tema chiaro",
      darkMode: "Tema scuro"
    },
    readerMode: {
      title: "Modalit\xE0 lettura"
    },
    explorer: {
      title: "Esplora"
    },
    footer: {
      createdWith: "Creato con"
    },
    graph: {
      title: "Vista grafico"
    },
    recentNotes: {
      title: "Note recenti",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Vedi ${remaining} altro \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transclusione di ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Link all'originale"
    },
    search: {
      title: "Cerca",
      searchBarPlaceholder: "Cerca qualcosa"
    },
    tableOfContents: {
      title: "Tabella dei contenuti"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} minuti`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Note recenti",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Ultime ${count} note`, "lastFewNotes")
    },
    error: {
      title: "Non trovato",
      notFound: "Questa pagina \xE8 privata o non esiste.",
      home: "Ritorna alla home page"
    },
    folderContent: {
      folder: "Cartella",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 oggetto in questa cartella." : `${count} oggetti in questa cartella.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Etichetta",
      tagIndex: "Indice etichette",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 oggetto con questa etichetta." : `${count} oggetti con questa etichetta.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Prime ${count} etichette.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Trovate ${count} etichette totali.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/ja-JP.ts
var ja_JP_default = {
  propertyDefaults: {
    title: "\u7121\u984C",
    description: "\u8AAC\u660E\u306A\u3057"
  },
  components: {
    callout: {
      note: "\u30CE\u30FC\u30C8",
      abstract: "\u6284\u9332",
      info: "\u60C5\u5831",
      todo: "\u3084\u308B\u3079\u304D\u3053\u3068",
      tip: "\u30D2\u30F3\u30C8",
      success: "\u6210\u529F",
      question: "\u8CEA\u554F",
      warning: "\u8B66\u544A",
      failure: "\u5931\u6557",
      danger: "\u5371\u967A",
      bug: "\u30D0\u30B0",
      example: "\u4F8B",
      quote: "\u5F15\u7528"
    },
    backlinks: {
      title: "\u30D0\u30C3\u30AF\u30EA\u30F3\u30AF",
      noBacklinksFound: "\u30D0\u30C3\u30AF\u30EA\u30F3\u30AF\u306F\u3042\u308A\u307E\u305B\u3093"
    },
    themeToggle: {
      lightMode: "\u30E9\u30A4\u30C8\u30E2\u30FC\u30C9",
      darkMode: "\u30C0\u30FC\u30AF\u30E2\u30FC\u30C9"
    },
    readerMode: {
      title: "\u30EA\u30FC\u30C0\u30FC\u30E2\u30FC\u30C9"
    },
    explorer: {
      title: "\u30A8\u30AF\u30B9\u30D7\u30ED\u30FC\u30E9\u30FC"
    },
    footer: {
      createdWith: "\u4F5C\u6210"
    },
    graph: {
      title: "\u30B0\u30E9\u30D5\u30D3\u30E5\u30FC"
    },
    recentNotes: {
      title: "\u6700\u8FD1\u306E\u8A18\u4E8B",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u3055\u3089\u306B${remaining}\u4EF6 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug}\u306E\u307E\u3068\u3081`, "transcludeOf"),
      linkToOriginal: "\u5143\u8A18\u4E8B\u3078\u306E\u30EA\u30F3\u30AF"
    },
    search: {
      title: "\u691C\u7D22",
      searchBarPlaceholder: "\u691C\u7D22\u30EF\u30FC\u30C9\u3092\u5165\u529B"
    },
    tableOfContents: {
      title: "\u76EE\u6B21"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u6700\u8FD1\u306E\u8A18\u4E8B",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u6700\u65B0\u306E${count}\u4EF6`, "lastFewNotes")
    },
    error: {
      title: "Not Found",
      notFound: "\u30DA\u30FC\u30B8\u304C\u5B58\u5728\u3057\u306A\u3044\u304B\u3001\u975E\u516C\u958B\u8A2D\u5B9A\u306B\u306A\u3063\u3066\u3044\u307E\u3059\u3002",
      home: "\u30DB\u30FC\u30E0\u30DA\u30FC\u30B8\u306B\u623B\u308B"
    },
    folderContent: {
      folder: "\u30D5\u30A9\u30EB\u30C0",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `${count}\u4EF6\u306E\u30DA\u30FC\u30B8`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u30BF\u30B0",
      tagIndex: "\u30BF\u30B0\u4E00\u89A7",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `${count}\u4EF6\u306E\u30DA\u30FC\u30B8`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u306E\u3046\u3061\u6700\u521D\u306E${count}\u4EF6\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\u5168${count}\u500B\u306E\u30BF\u30B0\u3092\u8868\u793A\u4E2D`, "totalTags")
    }
  }
};

// quartz/i18n/locales/de-DE.ts
var de_DE_default = {
  propertyDefaults: {
    title: "Unbenannt",
    description: "Keine Beschreibung angegeben"
  },
  components: {
    callout: {
      note: "Hinweis",
      abstract: "Zusammenfassung",
      info: "Info",
      todo: "Zu erledigen",
      tip: "Tipp",
      success: "Erfolg",
      question: "Frage",
      warning: "Warnung",
      failure: "Fehlgeschlagen",
      danger: "Gefahr",
      bug: "Fehler",
      example: "Beispiel",
      quote: "Zitat"
    },
    backlinks: {
      title: "Backlinks",
      noBacklinksFound: "Keine Backlinks gefunden"
    },
    themeToggle: {
      lightMode: "Heller Modus",
      darkMode: "Dunkler Modus"
    },
    readerMode: {
      title: "Lesemodus"
    },
    explorer: {
      title: "Explorer"
    },
    footer: {
      createdWith: "Erstellt mit"
    },
    graph: {
      title: "Graphansicht"
    },
    recentNotes: {
      title: "Zuletzt bearbeitete Seiten",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} weitere ansehen \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transklusion von ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Link zum Original"
    },
    search: {
      title: "Suche",
      searchBarPlaceholder: "Suche nach etwas"
    },
    tableOfContents: {
      title: "Inhaltsverzeichnis"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} Min. Lesezeit`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Zuletzt bearbeitete Seiten",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Letzte ${count} Seiten`, "lastFewNotes")
    },
    error: {
      title: "Nicht gefunden",
      notFound: "Diese Seite ist entweder nicht \xF6ffentlich oder existiert nicht.",
      home: "Zur Startseite"
    },
    folderContent: {
      folder: "Ordner",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 Datei in diesem Ordner." : `${count} Dateien in diesem Ordner.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Tag-\xDCbersicht",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 Datei mit diesem Tag." : `${count} Dateien mit diesem Tag.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Die ersten ${count} Tags werden angezeigt.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `${count} Tags insgesamt.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/nl-NL.ts
var nl_NL_default = {
  propertyDefaults: {
    title: "Naamloos",
    description: "Geen beschrijving gegeven."
  },
  components: {
    callout: {
      note: "Notitie",
      abstract: "Samenvatting",
      info: "Info",
      todo: "Te doen",
      tip: "Tip",
      success: "Succes",
      question: "Vraag",
      warning: "Waarschuwing",
      failure: "Mislukking",
      danger: "Gevaar",
      bug: "Bug",
      example: "Voorbeeld",
      quote: "Citaat"
    },
    backlinks: {
      title: "Backlinks",
      noBacklinksFound: "Geen backlinks gevonden"
    },
    themeToggle: {
      lightMode: "Lichte modus",
      darkMode: "Donkere modus"
    },
    readerMode: {
      title: "Leesmodus"
    },
    explorer: {
      title: "Verkenner"
    },
    footer: {
      createdWith: "Gemaakt met"
    },
    graph: {
      title: "Grafiekweergave"
    },
    recentNotes: {
      title: "Recente notities",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Zie ${remaining} meer \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Invoeging van ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Link naar origineel"
    },
    search: {
      title: "Zoeken",
      searchBarPlaceholder: "Doorzoek de website"
    },
    tableOfContents: {
      title: "Inhoudsopgave"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => minutes === 1 ? "1 minuut leestijd" : `${minutes} minuten leestijd`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Recente notities",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Laatste ${count} notities`, "lastFewNotes")
    },
    error: {
      title: "Niet gevonden",
      notFound: "Deze pagina is niet zichtbaar of bestaat niet.",
      home: "Keer terug naar de start pagina"
    },
    folderContent: {
      folder: "Map",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item in deze map." : `${count} items in deze map.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Label",
      tagIndex: "Label-index",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item met dit label." : `${count} items met dit label.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Eerste label tonen." : `Eerste ${count} labels tonen.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `${count} labels gevonden.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/ro-RO.ts
var ro_RO_default = {
  propertyDefaults: {
    title: "F\u0103r\u0103 titlu",
    description: "Nici o descriere furnizat\u0103"
  },
  components: {
    callout: {
      note: "Not\u0103",
      abstract: "Rezumat",
      info: "Informa\u021Bie",
      todo: "De f\u0103cut",
      tip: "Sfat",
      success: "Succes",
      question: "\xCEntrebare",
      warning: "Avertisment",
      failure: "E\u0219ec",
      danger: "Pericol",
      bug: "Bug",
      example: "Exemplu",
      quote: "Citat"
    },
    backlinks: {
      title: "Leg\u0103turi \xEEnapoi",
      noBacklinksFound: "Nu s-au g\u0103sit leg\u0103turi \xEEnapoi"
    },
    themeToggle: {
      lightMode: "Modul luminos",
      darkMode: "Modul \xEEntunecat"
    },
    readerMode: {
      title: "Modul de citire"
    },
    explorer: {
      title: "Explorator"
    },
    footer: {
      createdWith: "Creat cu"
    },
    graph: {
      title: "Graf"
    },
    recentNotes: {
      title: "Noti\u021Be recente",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Vezi \xEEnc\u0103 ${remaining} \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Extras din ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Leg\u0103tur\u0103 c\u0103tre original"
    },
    search: {
      title: "C\u0103utare",
      searchBarPlaceholder: "Introduce\u021Bi termenul de c\u0103utare..."
    },
    tableOfContents: {
      title: "Cuprins"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => minutes == 1 ? `lectur\u0103 de 1 minut` : `lectur\u0103 de ${minutes} minute`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Noti\u021Be recente",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Ultimele ${count} noti\u021Be`, "lastFewNotes")
    },
    error: {
      title: "Pagina nu a fost g\u0103sit\u0103",
      notFound: "Fie aceast\u0103 pagin\u0103 este privat\u0103, fie nu exist\u0103.",
      home: "Reveni\u021Bi la pagina de pornire"
    },
    folderContent: {
      folder: "Dosar",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 articol \xEEn acest dosar." : `${count} elemente \xEEn acest dosar.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Etichet\u0103",
      tagIndex: "Indexul etichetelor",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 articol cu aceast\u0103 etichet\u0103." : `${count} articole cu aceast\u0103 etichet\u0103.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Se afi\u0219eaz\u0103 primele ${count} etichete.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Au fost g\u0103site ${count} etichete \xEEn total.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/ca-ES.ts
var ca_ES_default = {
  propertyDefaults: {
    title: "Sense t\xEDtol",
    description: "Sense descripci\xF3"
  },
  components: {
    callout: {
      note: "Nota",
      abstract: "Resum",
      info: "Informaci\xF3",
      todo: "Per fer",
      tip: "Consell",
      success: "\xC8xit",
      question: "Pregunta",
      warning: "Advert\xE8ncia",
      failure: "Fall",
      danger: "Perill",
      bug: "Error",
      example: "Exemple",
      quote: "Cita"
    },
    backlinks: {
      title: "Retroenlla\xE7",
      noBacklinksFound: "No s'han trobat retroenlla\xE7os"
    },
    themeToggle: {
      lightMode: "Mode clar",
      darkMode: "Mode fosc"
    },
    readerMode: {
      title: "Mode lector"
    },
    explorer: {
      title: "Explorador"
    },
    footer: {
      createdWith: "Creat amb"
    },
    graph: {
      title: "Vista Gr\xE0fica"
    },
    recentNotes: {
      title: "Notes Recents",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Vegi ${remaining} m\xE9s \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transcluit de ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Enlla\xE7 a l'original"
    },
    search: {
      title: "Cercar",
      searchBarPlaceholder: "Cerca alguna cosa"
    },
    tableOfContents: {
      title: "Taula de Continguts"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `Es llegeix en ${minutes} min`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Notes recents",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\xDAltimes ${count} notes`, "lastFewNotes")
    },
    error: {
      title: "No s'ha trobat.",
      notFound: "Aquesta p\xE0gina \xE9s privada o no existeix.",
      home: "Torna a la p\xE0gina principal"
    },
    folderContent: {
      folder: "Carpeta",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 article en aquesta carpeta." : `${count} articles en esta carpeta.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Etiqueta",
      tagIndex: "\xEDndex d'Etiquetes",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 article amb aquesta etiqueta." : `${count} article amb aquesta etiqueta.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Mostrant les primeres ${count} etiquetes.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `S'han trobat ${count} etiquetes en total.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/es-ES.ts
var es_ES_default = {
  propertyDefaults: {
    title: "Sin t\xEDtulo",
    description: "Sin descripci\xF3n"
  },
  components: {
    callout: {
      note: "Nota",
      abstract: "Resumen",
      info: "Informaci\xF3n",
      todo: "Por hacer",
      tip: "Consejo",
      success: "\xC9xito",
      question: "Pregunta",
      warning: "Advertencia",
      failure: "Fallo",
      danger: "Peligro",
      bug: "Error",
      example: "Ejemplo",
      quote: "Cita"
    },
    backlinks: {
      title: "Retroenlaces",
      noBacklinksFound: "No se han encontrado retroenlaces"
    },
    themeToggle: {
      lightMode: "Modo claro",
      darkMode: "Modo oscuro"
    },
    readerMode: {
      title: "Modo lector"
    },
    explorer: {
      title: "Explorador"
    },
    footer: {
      createdWith: "Creado con"
    },
    graph: {
      title: "Vista Gr\xE1fica"
    },
    recentNotes: {
      title: "Notas Recientes",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Vea ${remaining} m\xE1s \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transcluido de ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Enlace al original"
    },
    search: {
      title: "Buscar",
      searchBarPlaceholder: "Busca algo"
    },
    tableOfContents: {
      title: "Tabla de Contenidos"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `Se lee en ${minutes} min`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Notas recientes",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\xDAltimas ${count} notas`, "lastFewNotes")
    },
    error: {
      title: "No se ha encontrado.",
      notFound: "Esta p\xE1gina es privada o no existe.",
      home: "Regresa a la p\xE1gina principal"
    },
    folderContent: {
      folder: "Carpeta",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 art\xEDculo en esta carpeta." : `${count} art\xEDculos en esta carpeta.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Etiqueta",
      tagIndex: "\xCDndice de Etiquetas",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 art\xEDculo con esta etiqueta." : `${count} art\xEDculos con esta etiqueta.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Mostrando las primeras ${count} etiquetas.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Se han encontrado ${count} etiquetas en total.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/ar-SA.ts
var ar_SA_default = {
  propertyDefaults: {
    title: "\u063A\u064A\u0631 \u0645\u0639\u0646\u0648\u0646",
    description: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0642\u062F\u064A\u0645 \u0623\u064A \u0648\u0635\u0641"
  },
  direction: "rtl",
  components: {
    callout: {
      note: "\u0645\u0644\u0627\u062D\u0638\u0629",
      abstract: "\u0645\u0644\u062E\u0635",
      info: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
      todo: "\u0644\u0644\u0642\u064A\u0627\u0645",
      tip: "\u0646\u0635\u064A\u062D\u0629",
      success: "\u0646\u062C\u0627\u062D",
      question: "\u0633\u0624\u0627\u0644",
      warning: "\u062A\u062D\u0630\u064A\u0631",
      failure: "\u0641\u0634\u0644",
      danger: "\u062E\u0637\u0631",
      bug: "\u062E\u0644\u0644",
      example: "\u0645\u062B\u0627\u0644",
      quote: "\u0627\u0642\u062A\u0628\u0627\u0633"
    },
    backlinks: {
      title: "\u0648\u0635\u0644\u0627\u062A \u0627\u0644\u0639\u0648\u062F\u0629",
      noBacklinksFound: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0648\u0635\u0644\u0627\u062A \u0639\u0648\u062F\u0629"
    },
    themeToggle: {
      lightMode: "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0646\u0647\u0627\u0631\u064A",
      darkMode: "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064A\u0644\u064A"
    },
    explorer: {
      title: "\u0627\u0644\u0645\u0633\u062A\u0639\u0631\u0636"
    },
    readerMode: {
      title: "\u0648\u0636\u0639 \u0627\u0644\u0642\u0627\u0631\u0626"
    },
    footer: {
      createdWith: "\u0623\u064F\u0646\u0634\u0626 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645"
    },
    graph: {
      title: "\u0627\u0644\u062A\u0645\u062B\u064A\u0644 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A"
    },
    recentNotes: {
      title: "\u0622\u062E\u0631 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u062A\u0635\u0641\u062D ${remaining} \u0623\u0643\u062B\u0631 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0645\u0642\u062A\u0628\u0633 \u0645\u0646 ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u0648\u0635\u0644\u0629 \u0644\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629"
    },
    search: {
      title: "\u0628\u062D\u062B",
      searchBarPlaceholder: "\u0627\u0628\u062D\u062B \u0639\u0646 \u0634\u064A\u0621 \u0645\u0627"
    },
    tableOfContents: {
      title: "\u0641\u0647\u0631\u0633 \u0627\u0644\u0645\u062D\u062A\u0648\u064A\u0627\u062A"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => minutes == 1 ? `\u062F\u0642\u064A\u0642\u0629 \u0623\u0648 \u0623\u0642\u0644 \u0644\u0644\u0642\u0631\u0627\u0621\u0629` : minutes == 2 ? `\u062F\u0642\u064A\u0642\u062A\u0627\u0646 \u0644\u0644\u0642\u0631\u0627\u0621\u0629` : `${minutes} \u062F\u0642\u0627\u0626\u0642 \u0644\u0644\u0642\u0631\u0627\u0621\u0629`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u0622\u062E\u0631 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u0622\u062E\u0631 ${count} \u0645\u0644\u0627\u062D\u0638\u0629`, "lastFewNotes")
    },
    error: {
      title: "\u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F",
      notFound: "\u0625\u0645\u0627 \u0623\u0646 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629 \u062E\u0627\u0635\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.",
      home: "\u0627\u0644\u0639\u0648\u062F\u0647 \u0644\u0644\u0635\u0641\u062D\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629"
    },
    folderContent: {
      folder: "\u0645\u062C\u0644\u062F",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u064A\u0648\u062C\u062F \u0639\u0646\u0635\u0631 \u0648\u0627\u062D\u062F \u0641\u0642\u0637 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F" : `\u064A\u0648\u062C\u062F ${count} \u0639\u0646\u0627\u0635\u0631 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u0627\u0644\u0648\u0633\u0645",
      tagIndex: "\u0645\u0624\u0634\u0631 \u0627\u0644\u0648\u0633\u0645",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u064A\u0648\u062C\u062F \u0639\u0646\u0635\u0631 \u0648\u0627\u062D\u062F \u0641\u0642\u0637 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0648\u0633\u0645" : `\u064A\u0648\u062C\u062F ${count} \u0639\u0646\u0627\u0635\u0631 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0648\u0633\u0645.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0625\u0638\u0647\u0627\u0631 \u0623\u0648\u0644 ${count} \u0623\u0648\u0633\u0645\u0629.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\u064A\u0648\u062C\u062F ${count} \u0623\u0648\u0633\u0645\u0629.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/uk-UA.ts
var uk_UA_default = {
  propertyDefaults: {
    title: "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0438",
    description: "\u041E\u043F\u0438\u0441 \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E"
  },
  components: {
    callout: {
      note: "\u041F\u0440\u0438\u043C\u0456\u0442\u043A\u0430",
      abstract: "\u0410\u0431\u0441\u0442\u0440\u0430\u043A\u0442",
      info: "\u0406\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u044F",
      todo: "\u0417\u0430\u0432\u0434\u0430\u043D\u043D\u044F",
      tip: "\u041F\u043E\u0440\u0430\u0434\u0430",
      success: "\u0423\u0441\u043F\u0456\u0445",
      question: "\u041F\u0438\u0442\u0430\u043D\u043D\u044F",
      warning: "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u0436\u0435\u043D\u043D\u044F",
      failure: "\u041D\u0435\u0432\u0434\u0430\u0447\u0430",
      danger: "\u041D\u0435\u0431\u0435\u0437\u043F\u0435\u043A\u0430",
      bug: "\u0411\u0430\u0433",
      example: "\u041F\u0440\u0438\u043A\u043B\u0430\u0434",
      quote: "\u0426\u0438\u0442\u0430\u0442\u0430"
    },
    backlinks: {
      title: "\u0417\u0432\u043E\u0440\u043E\u0442\u043D\u0456 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F",
      noBacklinksFound: "\u0417\u0432\u043E\u0440\u043E\u0442\u043D\u0438\u0445 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E"
    },
    themeToggle: {
      lightMode: "\u0421\u0432\u0456\u0442\u043B\u0438\u0439 \u0440\u0435\u0436\u0438\u043C",
      darkMode: "\u0422\u0435\u043C\u043D\u0438\u0439 \u0440\u0435\u0436\u0438\u043C"
    },
    readerMode: {
      title: "\u0420\u0435\u0436\u0438\u043C \u0447\u0438\u0442\u0430\u043D\u043D\u044F"
    },
    explorer: {
      title: "\u041F\u0440\u043E\u0432\u0456\u0434\u043D\u0438\u043A"
    },
    footer: {
      createdWith: "\u0421\u0442\u0432\u043E\u0440\u0435\u043D\u043E \u0437\u0430 \u0434\u043E\u043F\u043E\u043C\u043E\u0433\u043E\u044E"
    },
    graph: {
      title: "\u0412\u0438\u0433\u043B\u044F\u0434 \u0433\u0440\u0430\u0444\u0430"
    },
    recentNotes: {
      title: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u0449\u0435 ${remaining} \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0412\u0438\u0434\u043E\u0431\u0443\u0442\u043E \u0437 ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u041F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B"
    },
    search: {
      title: "\u041F\u043E\u0448\u0443\u043A",
      searchBarPlaceholder: "\u0428\u0443\u043A\u0430\u0442\u0438 \u0449\u043E\u0441\u044C"
    },
    tableOfContents: {
      title: "\u0417\u043C\u0456\u0441\u0442"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} \u0445\u0432 \u0447\u0438\u0442\u0430\u043D\u043D\u044F`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438: ${count}`, "lastFewNotes")
    },
    error: {
      title: "\u041D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      notFound: "\u0426\u044F \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430 \u0430\u0431\u043E \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0430, \u0430\u0431\u043E \u043D\u0435 \u0456\u0441\u043D\u0443\u0454.",
      home: "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438\u0441\u044F \u043D\u0430 \u0433\u043E\u043B\u043E\u0432\u043D\u0443 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443"
    },
    folderContent: {
      folder: "\u0422\u0435\u043A\u0430",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u0423 \u0446\u0456\u0439 \u0442\u0435\u0446\u0456 1 \u0435\u043B\u0435\u043C\u0435\u043D\u0442." : `\u0415\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432 \u0443 \u0446\u0456\u0439 \u0442\u0435\u0446\u0456: ${count}.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u041C\u0456\u0442\u043A\u0430",
      tagIndex: "\u0406\u043D\u0434\u0435\u043A\u0441 \u043C\u0456\u0442\u043A\u0438",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 \u0435\u043B\u0435\u043C\u0435\u043D\u0442 \u0437 \u0446\u0456\u0454\u044E \u043C\u0456\u0442\u043A\u043E\u044E." : `\u0415\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432 \u0437 \u0446\u0456\u0454\u044E \u043C\u0456\u0442\u043A\u043E\u044E: ${count}.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u041F\u043E\u043A\u0430\u0437 \u043F\u0435\u0440\u0448\u0438\u0445 ${count} \u043C\u0456\u0442\u043E\u043A.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\u0412\u0441\u044C\u043E\u0433\u043E \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043C\u0456\u0442\u043E\u043A: ${count}.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/ru-RU.ts
var ru_RU_default = {
  propertyDefaults: {
    title: "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F",
    description: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442"
  },
  components: {
    callout: {
      note: "\u0417\u0430\u043C\u0435\u0442\u043A\u0430",
      abstract: "\u0420\u0435\u0437\u044E\u043C\u0435",
      info: "\u0418\u043D\u0444\u043E",
      todo: "\u0421\u0434\u0435\u043B\u0430\u0442\u044C",
      tip: "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430",
      success: "\u0423\u0441\u043F\u0435\u0445",
      question: "\u0412\u043E\u043F\u0440\u043E\u0441",
      warning: "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435",
      failure: "\u041D\u0435\u0443\u0434\u0430\u0447\u0430",
      danger: "\u041E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C",
      bug: "\u0411\u0430\u0433",
      example: "\u041F\u0440\u0438\u043C\u0435\u0440",
      quote: "\u0426\u0438\u0442\u0430\u0442\u0430"
    },
    backlinks: {
      title: "\u041E\u0431\u0440\u0430\u0442\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438",
      noBacklinksFound: "\u041E\u0431\u0440\u0430\u0442\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442"
    },
    themeToggle: {
      lightMode: "\u0421\u0432\u0435\u0442\u043B\u044B\u0439 \u0440\u0435\u0436\u0438\u043C",
      darkMode: "\u0422\u0451\u043C\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C"
    },
    readerMode: {
      title: "\u0420\u0435\u0436\u0438\u043C \u0447\u0442\u0435\u043D\u0438\u044F"
    },
    explorer: {
      title: "\u041F\u0440\u043E\u0432\u043E\u0434\u043D\u0438\u043A"
    },
    footer: {
      createdWith: "\u0421\u043E\u0437\u0434\u0430\u043D\u043E \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E"
    },
    graph: {
      title: "\u0412\u0438\u0434 \u0433\u0440\u0430\u0444\u0430"
    },
    recentNotes: {
      title: "\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043E\u0441\u0442\u0430\u0432\u0448${getForm(remaining, "\u0443\u044E\u0441\u044F", "\u0438\u0435\u0441\u044F", "\u0438\u0435\u0441\u044F")} ${remaining} \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u041F\u0435\u0440\u0435\u0445\u043E\u0434 \u0438\u0437 ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u043E\u0440\u0438\u0433\u0438\u043D\u0430\u043B"
    },
    search: {
      title: "\u041F\u043E\u0438\u0441\u043A",
      searchBarPlaceholder: "\u041D\u0430\u0439\u0442\u0438 \u0447\u0442\u043E-\u043D\u0438\u0431\u0443\u0434\u044C"
    },
    tableOfContents: {
      title: "\u041E\u0433\u043B\u0430\u0432\u043B\u0435\u043D\u0438\u0435"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u0432\u0440\u0435\u043C\u044F \u0447\u0442\u0435\u043D\u0438\u044F ~${minutes} \u043C\u0438\u043D.`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u041F\u043E\u0441\u043B\u0435\u0434\u043D${getForm(count, "\u044F\u044F", "\u0438\u0435", "\u0438\u0435")} ${count} \u0437\u0430\u043C\u0435\u0442${getForm(count, "\u043A\u0430", "\u043A\u0438", "\u043E\u043A")}`, "lastFewNotes")
    },
    error: {
      title: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430",
      notFound: "\u042D\u0442\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u0438\u043B\u0438 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442",
      home: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u043D\u0430 \u0433\u043B\u0430\u0432\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443"
    },
    folderContent: {
      folder: "\u041F\u0430\u043F\u043A\u0430",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u0432 \u044D\u0442\u043E\u0439 \u043F\u0430\u043F\u043A\u0435 ${count} \u044D\u043B\u0435\u043C\u0435\u043D\u0442${getForm(count, "", "\u0430", "\u043E\u0432")}`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u0422\u0435\u0433",
      tagIndex: "\u0418\u043D\u0434\u0435\u043A\u0441 \u0442\u0435\u0433\u043E\u0432",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u0441 \u044D\u0442\u0438\u043C \u0442\u0435\u0433\u043E\u043C ${count} \u044D\u043B\u0435\u043C\u0435\u043D\u0442${getForm(count, "", "\u0430", "\u043E\u0432")}`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430${getForm(count, "\u0435\u0442\u0441\u044F", "\u044E\u0442\u0441\u044F", "\u044E\u0442\u0441\u044F")} ${count} \u0442\u0435\u0433${getForm(count, "", "\u0430", "\u043E\u0432")}`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\u0412\u0441\u0435\u0433\u043E ${count} \u0442\u0435\u0433${getForm(count, "", "\u0430", "\u043E\u0432")}`, "totalTags")
    }
  }
};
function getForm(number, form1, form2, form5) {
  const remainder100 = number % 100;
  const remainder10 = remainder100 % 10;
  if (remainder100 >= 10 && remainder100 <= 20) return form5;
  if (remainder10 > 1 && remainder10 < 5) return form2;
  if (remainder10 == 1) return form1;
  return form5;
}
__name(getForm, "getForm");

// quartz/i18n/locales/ko-KR.ts
var ko_KR_default = {
  propertyDefaults: {
    title: "\uC81C\uBAA9 \uC5C6\uC74C",
    description: "\uC124\uBA85 \uC5C6\uC74C"
  },
  components: {
    callout: {
      note: "\uB178\uD2B8",
      abstract: "\uAC1C\uC694",
      info: "\uC815\uBCF4",
      todo: "\uD560\uC77C",
      tip: "\uD301",
      success: "\uC131\uACF5",
      question: "\uC9C8\uBB38",
      warning: "\uC8FC\uC758",
      failure: "\uC2E4\uD328",
      danger: "\uC704\uD5D8",
      bug: "\uBC84\uADF8",
      example: "\uC608\uC2DC",
      quote: "\uC778\uC6A9"
    },
    backlinks: {
      title: "\uBC31\uB9C1\uD06C",
      noBacklinksFound: "\uBC31\uB9C1\uD06C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
    },
    themeToggle: {
      lightMode: "\uB77C\uC774\uD2B8 \uBAA8\uB4DC",
      darkMode: "\uB2E4\uD06C \uBAA8\uB4DC"
    },
    readerMode: {
      title: "\uB9AC\uB354 \uBAA8\uB4DC"
    },
    explorer: {
      title: "\uD0D0\uC0C9\uAE30"
    },
    footer: {
      createdWith: "Created with"
    },
    graph: {
      title: "\uADF8\uB798\uD504 \uBDF0"
    },
    recentNotes: {
      title: "\uCD5C\uADFC \uAC8C\uC2DC\uAE00",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining}\uAC74 \uB354\uBCF4\uAE30 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug}\uC758 \uD3EC\uD568`, "transcludeOf"),
      linkToOriginal: "\uC6D0\uBCF8 \uB9C1\uD06C"
    },
    search: {
      title: "\uAC80\uC0C9",
      searchBarPlaceholder: "\uAC80\uC0C9\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694"
    },
    tableOfContents: {
      title: "\uBAA9\uCC28"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\uCD5C\uADFC \uAC8C\uC2DC\uAE00",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\uCD5C\uADFC ${count} \uAC74`, "lastFewNotes")
    },
    error: {
      title: "Not Found",
      notFound: "\uD398\uC774\uC9C0\uAC00 \uC874\uC7AC\uD558\uC9C0 \uC54A\uAC70\uB098 \uBE44\uACF5\uAC1C \uC124\uC815\uC774 \uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.",
      home: "\uD648\uD398\uC774\uC9C0\uB85C \uB3CC\uC544\uAC00\uAE30"
    },
    folderContent: {
      folder: "\uD3F4\uB354",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `${count}\uAC74\uC758 \uD56D\uBAA9`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\uD0DC\uADF8",
      tagIndex: "\uD0DC\uADF8 \uBAA9\uB85D",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `${count}\uAC74\uC758 \uD56D\uBAA9`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\uCC98\uC74C ${count}\uAC1C\uC758 \uD0DC\uADF8`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\uCD1D ${count}\uAC1C\uC758 \uD0DC\uADF8\uB97C \uCC3E\uC558\uC2B5\uB2C8\uB2E4.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/zh-CN.ts
var zh_CN_default = {
  propertyDefaults: {
    title: "\u65E0\u9898",
    description: "\u65E0\u63CF\u8FF0"
  },
  components: {
    callout: {
      note: "\u7B14\u8BB0",
      abstract: "\u6458\u8981",
      info: "\u63D0\u793A",
      todo: "\u5F85\u529E",
      tip: "\u63D0\u793A",
      success: "\u6210\u529F",
      question: "\u95EE\u9898",
      warning: "\u8B66\u544A",
      failure: "\u5931\u8D25",
      danger: "\u5371\u9669",
      bug: "\u9519\u8BEF",
      example: "\u793A\u4F8B",
      quote: "\u5F15\u7528"
    },
    backlinks: {
      title: "\u53CD\u5411\u94FE\u63A5",
      noBacklinksFound: "\u65E0\u6CD5\u627E\u5230\u53CD\u5411\u94FE\u63A5"
    },
    themeToggle: {
      lightMode: "\u4EAE\u8272\u6A21\u5F0F",
      darkMode: "\u6697\u8272\u6A21\u5F0F"
    },
    readerMode: {
      title: "\u9605\u8BFB\u6A21\u5F0F"
    },
    explorer: {
      title: "\u63A2\u7D22"
    },
    footer: {
      createdWith: "Created with"
    },
    graph: {
      title: "\u5173\u7CFB\u56FE\u8C31"
    },
    recentNotes: {
      title: "\u6700\u8FD1\u7684\u7B14\u8BB0",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u67E5\u770B\u66F4\u591A${remaining}\u7BC7\u7B14\u8BB0 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u5305\u542B${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u6307\u5411\u539F\u59CB\u7B14\u8BB0\u7684\u94FE\u63A5"
    },
    search: {
      title: "\u641C\u7D22",
      searchBarPlaceholder: "\u641C\u7D22\u4E9B\u4EC0\u4E48"
    },
    tableOfContents: {
      title: "\u76EE\u5F55"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes}\u5206\u949F\u9605\u8BFB`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u6700\u8FD1\u7684\u7B14\u8BB0",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u6700\u8FD1\u7684${count}\u6761\u7B14\u8BB0`, "lastFewNotes")
    },
    error: {
      title: "\u65E0\u6CD5\u627E\u5230",
      notFound: "\u79C1\u6709\u7B14\u8BB0\u6216\u7B14\u8BB0\u4E0D\u5B58\u5728\u3002",
      home: "\u8FD4\u56DE\u9996\u9875"
    },
    folderContent: {
      folder: "\u6587\u4EF6\u5939",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u6B64\u6587\u4EF6\u5939\u4E0B\u6709${count}\u6761\u7B14\u8BB0\u3002`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u6807\u7B7E",
      tagIndex: "\u6807\u7B7E\u7D22\u5F15",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u6B64\u6807\u7B7E\u4E0B\u6709${count}\u6761\u7B14\u8BB0\u3002`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u663E\u793A\u524D${count}\u4E2A\u6807\u7B7E\u3002`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\u603B\u5171\u6709${count}\u4E2A\u6807\u7B7E\u3002`, "totalTags")
    }
  }
};

// quartz/i18n/locales/zh-TW.ts
var zh_TW_default = {
  propertyDefaults: {
    title: "\u7121\u984C",
    description: "\u7121\u63CF\u8FF0"
  },
  components: {
    callout: {
      note: "\u7B46\u8A18",
      abstract: "\u6458\u8981",
      info: "\u63D0\u793A",
      todo: "\u5F85\u8FA6",
      tip: "\u63D0\u793A",
      success: "\u6210\u529F",
      question: "\u554F\u984C",
      warning: "\u8B66\u544A",
      failure: "\u5931\u6557",
      danger: "\u5371\u96AA",
      bug: "\u932F\u8AA4",
      example: "\u7BC4\u4F8B",
      quote: "\u5F15\u7528"
    },
    backlinks: {
      title: "\u53CD\u5411\u9023\u7D50",
      noBacklinksFound: "\u7121\u6CD5\u627E\u5230\u53CD\u5411\u9023\u7D50"
    },
    themeToggle: {
      lightMode: "\u4EAE\u8272\u6A21\u5F0F",
      darkMode: "\u6697\u8272\u6A21\u5F0F"
    },
    readerMode: {
      title: "\u95B1\u8B80\u6A21\u5F0F"
    },
    explorer: {
      title: "\u63A2\u7D22"
    },
    footer: {
      createdWith: "Created with"
    },
    graph: {
      title: "\u95DC\u4FC2\u5716\u8B5C"
    },
    recentNotes: {
      title: "\u6700\u8FD1\u7684\u7B46\u8A18",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u67E5\u770B\u66F4\u591A ${remaining} \u7BC7\u7B46\u8A18 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u5305\u542B ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u6307\u5411\u539F\u59CB\u7B46\u8A18\u7684\u9023\u7D50"
    },
    search: {
      title: "\u641C\u5C0B",
      searchBarPlaceholder: "\u641C\u5C0B\u4E9B\u4EC0\u9EBC"
    },
    tableOfContents: {
      title: "\u76EE\u9304"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u95B1\u8B80\u6642\u9593\u7D04 ${minutes} \u5206\u9418`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u6700\u8FD1\u7684\u7B46\u8A18",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u6700\u8FD1\u7684 ${count} \u689D\u7B46\u8A18`, "lastFewNotes")
    },
    error: {
      title: "\u7121\u6CD5\u627E\u5230",
      notFound: "\u79C1\u4EBA\u7B46\u8A18\u6216\u7B46\u8A18\u4E0D\u5B58\u5728\u3002",
      home: "\u8FD4\u56DE\u9996\u9801"
    },
    folderContent: {
      folder: "\u8CC7\u6599\u593E",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u6B64\u8CC7\u6599\u593E\u4E0B\u6709 ${count} \u689D\u7B46\u8A18\u3002`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u6A19\u7C64",
      tagIndex: "\u6A19\u7C64\u7D22\u5F15",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u6B64\u6A19\u7C64\u4E0B\u6709 ${count} \u689D\u7B46\u8A18\u3002`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u986F\u793A\u524D ${count} \u500B\u6A19\u7C64\u3002`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\u7E3D\u5171\u6709 ${count} \u500B\u6A19\u7C64\u3002`, "totalTags")
    }
  }
};

// quartz/i18n/locales/vi-VN.ts
var vi_VN_default = {
  propertyDefaults: {
    title: "Kh\xF4ng c\xF3 ti\xEAu \u0111\u1EC1",
    description: "Kh\xF4ng c\xF3 m\xF4 t\u1EA3 \u0111\u01B0\u1EE3c cung c\u1EA5p"
  },
  components: {
    callout: {
      note: "Ghi Ch\xFA",
      abstract: "T\xF3m T\u1EAFt",
      info: "Th\xF4ng tin",
      todo: "C\u1EA7n L\xE0m",
      tip: "G\u1EE3i \xDD",
      success: "Th\xE0nh C\xF4ng",
      question: "Nghi V\u1EA5n",
      warning: "C\u1EA3nh B\xE1o",
      failure: "Th\u1EA5t B\u1EA1i",
      danger: "Nguy Hi\u1EC3m",
      bug: "L\u1ED7i",
      example: "V\xED D\u1EE5",
      quote: "Tr\xEDch D\u1EABn"
    },
    backlinks: {
      title: "Li\xEAn K\u1EBFt Ng\u01B0\u1EE3c",
      noBacklinksFound: "Kh\xF4ng c\xF3 li\xEAn k\u1EBFt ng\u01B0\u1EE3c \u0111\u01B0\u1EE3c t\xECm th\u1EA5y"
    },
    themeToggle: {
      lightMode: "S\xE1ng",
      darkMode: "T\u1ED1i"
    },
    readerMode: {
      title: "Ch\u1EBF \u0111\u1ED9 \u0111\u1ECDc"
    },
    explorer: {
      title: "Trong b\xE0i n\xE0y"
    },
    footer: {
      createdWith: "\u0110\u01B0\u1EE3c t\u1EA1o b\u1EDFi"
    },
    graph: {
      title: "Bi\u1EC3u \u0110\u1ED3"
    },
    recentNotes: {
      title: "B\xE0i vi\u1EBFt g\u1EA7n \u0111\xE2y",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Xem ${remaining} th\xEAm \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Bao g\u1ED3m ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Li\xEAn K\u1EBFt G\u1ED1c"
    },
    search: {
      title: "T\xECm Ki\u1EBFm",
      searchBarPlaceholder: "T\xECm ki\u1EBFm th\xF4ng tin"
    },
    tableOfContents: {
      title: "B\u1EA3ng N\u1ED9i Dung"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u0111\u1ECDc ${minutes} ph\xFAt`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Nh\u1EEFng b\xE0i g\u1EA7n \u0111\xE2y",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} B\xE0i g\u1EA7n \u0111\xE2y`, "lastFewNotes")
    },
    error: {
      title: "Kh\xF4ng T\xECm Th\u1EA5y",
      notFound: "Trang n\xE0y \u0111\u01B0\u1EE3c b\u1EA3o m\u1EADt ho\u1EB7c kh\xF4ng t\u1ED3n t\u1EA1i.",
      home: "Tr\u1EDF v\u1EC1 trang ch\u1EE7"
    },
    folderContent: {
      folder: "Th\u01B0 M\u1EE5c",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 m\u1EE5c trong th\u01B0 m\u1EE5c n\xE0y." : `${count} m\u1EE5c trong th\u01B0 m\u1EE5c n\xE0y.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Th\u1EBB",
      tagIndex: "Th\u1EBB M\u1EE5c L\u1EE5c",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 m\u1EE5c g\u1EAFn th\u1EBB n\xE0y." : `${count} m\u1EE5c g\u1EAFn th\u1EBB n\xE0y.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Hi\u1EC3n th\u1ECB tr\u01B0\u1EDBc ${count} th\u1EBB.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `T\xECm th\u1EA5y ${count} th\u1EBB t\u1ED5ng c\u1ED9ng.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/pt-BR.ts
var pt_BR_default = {
  propertyDefaults: {
    title: "Sem t\xEDtulo",
    description: "Sem descri\xE7\xE3o"
  },
  components: {
    callout: {
      note: "Nota",
      abstract: "Abstrato",
      info: "Info",
      todo: "Pend\xEAncia",
      tip: "Dica",
      success: "Sucesso",
      question: "Pergunta",
      warning: "Aviso",
      failure: "Falha",
      danger: "Perigo",
      bug: "Bug",
      example: "Exemplo",
      quote: "Cita\xE7\xE3o"
    },
    backlinks: {
      title: "Backlinks",
      noBacklinksFound: "Sem backlinks encontrados"
    },
    themeToggle: {
      lightMode: "Tema claro",
      darkMode: "Tema escuro"
    },
    readerMode: {
      title: "Modo leitor"
    },
    explorer: {
      title: "Explorador"
    },
    footer: {
      createdWith: "Criado com"
    },
    graph: {
      title: "Vis\xE3o de gr\xE1fico"
    },
    recentNotes: {
      title: "Notas recentes",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Veja mais ${remaining} \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transcrever de ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Link ao original"
    },
    search: {
      title: "Pesquisar",
      searchBarPlaceholder: "Pesquisar por algo"
    },
    tableOfContents: {
      title: "Sum\xE1rio"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `Leitura de ${minutes} min`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Notas recentes",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\xDAltimas ${count} notas`, "lastFewNotes")
    },
    error: {
      title: "N\xE3o encontrado",
      notFound: "Esta p\xE1gina \xE9 privada ou n\xE3o existe.",
      home: "Retornar a p\xE1gina inicial"
    },
    folderContent: {
      folder: "Arquivo",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item neste arquivo." : `${count} items neste arquivo.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Sum\xE1rio de Tags",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item com esta tag." : `${count} items com esta tag.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Mostrando as ${count} primeiras tags.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Encontradas ${count} tags.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/hu-HU.ts
var hu_HU_default = {
  propertyDefaults: {
    title: "N\xE9vtelen",
    description: "Nincs le\xEDr\xE1s"
  },
  components: {
    callout: {
      note: "Jegyzet",
      abstract: "Abstract",
      info: "Inform\xE1ci\xF3",
      todo: "Tennival\xF3",
      tip: "Tipp",
      success: "Siker",
      question: "K\xE9rd\xE9s",
      warning: "Figyelmeztet\xE9s",
      failure: "Hiba",
      danger: "Vesz\xE9ly",
      bug: "Bug",
      example: "P\xE9lda",
      quote: "Id\xE9zet"
    },
    backlinks: {
      title: "Visszautal\xE1sok",
      noBacklinksFound: "Nincs visszautal\xE1s"
    },
    themeToggle: {
      lightMode: "Vil\xE1gos m\xF3d",
      darkMode: "S\xF6t\xE9t m\xF3d"
    },
    readerMode: {
      title: "Olvas\xF3 m\xF3d"
    },
    explorer: {
      title: "F\xE1jlb\xF6ng\xE9sz\u0151"
    },
    footer: {
      createdWith: "K\xE9sz\xEDtve ezzel:"
    },
    graph: {
      title: "Grafikonn\xE9zet"
    },
    recentNotes: {
      title: "Legut\xF3bbi jegyzetek",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} tov\xE1bbi megtekint\xE9se \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug} \xE1thivatkoz\xE1sa`, "transcludeOf"),
      linkToOriginal: "Hivatkoz\xE1s az eredetire"
    },
    search: {
      title: "Keres\xE9s",
      searchBarPlaceholder: "Keress valamire"
    },
    tableOfContents: {
      title: "Tartalomjegyz\xE9k"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} perces olvas\xE1s`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Legut\xF3bbi jegyzetek",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Legut\xF3bbi ${count} jegyzet`, "lastFewNotes")
    },
    error: {
      title: "Nem tal\xE1lhat\xF3",
      notFound: "Ez a lap vagy priv\xE1t vagy nem l\xE9tezik.",
      home: "Vissza a kezd\u0151lapra"
    },
    folderContent: {
      folder: "Mappa",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `Ebben a mapp\xE1ban ${count} elem tal\xE1lhat\xF3.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "C\xEDmke",
      tagIndex: "C\xEDmke index",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `${count} elem tal\xE1lhat\xF3 ezzel a c\xEDmk\xE9vel.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Els\u0151 ${count} c\xEDmke megjelen\xEDtve.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\xD6sszesen ${count} c\xEDmke tal\xE1lhat\xF3.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/fa-IR.ts
var fa_IR_default = {
  propertyDefaults: {
    title: "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646",
    description: "\u062A\u0648\u0636\u06CC\u062D \u062E\u0627\u0635\u06CC \u0627\u0636\u0627\u0641\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"
  },
  direction: "rtl",
  components: {
    callout: {
      note: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A",
      abstract: "\u0686\u06A9\u06CC\u062F\u0647",
      info: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A",
      todo: "\u0627\u0642\u062F\u0627\u0645",
      tip: "\u0646\u06A9\u062A\u0647",
      success: "\u062A\u06CC\u06A9",
      question: "\u0633\u0624\u0627\u0644",
      warning: "\u0647\u0634\u062F\u0627\u0631",
      failure: "\u0634\u06A9\u0633\u062A",
      danger: "\u062E\u0637\u0631",
      bug: "\u0628\u0627\u06AF",
      example: "\u0645\u062B\u0627\u0644",
      quote: "\u0646\u0642\u0644 \u0642\u0648\u0644"
    },
    backlinks: {
      title: "\u0628\u06A9\u200C\u0644\u06CC\u0646\u06A9\u200C\u0647\u0627",
      noBacklinksFound: "\u0628\u062F\u0648\u0646 \u0628\u06A9\u200C\u0644\u06CC\u0646\u06A9"
    },
    themeToggle: {
      lightMode: "\u062D\u0627\u0644\u062A \u0631\u0648\u0634\u0646",
      darkMode: "\u062D\u0627\u0644\u062A \u062A\u0627\u0631\u06CC\u06A9"
    },
    readerMode: {
      title: "\u062D\u0627\u0644\u062A \u062E\u0648\u0627\u0646\u062F\u0646"
    },
    explorer: {
      title: "\u0645\u0637\u0627\u0644\u0628"
    },
    footer: {
      createdWith: "\u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647 \u0628\u0627"
    },
    graph: {
      title: "\u0646\u0645\u0627\u06CC \u06AF\u0631\u0627\u0641"
    },
    recentNotes: {
      title: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627\u06CC \u0627\u062E\u06CC\u0631",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u062F\u06CC\u06AF\u0631 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0627\u0632 ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u067E\u06CC\u0648\u0646\u062F \u0628\u0647 \u0627\u0635\u0644\u06CC"
    },
    search: {
      title: "\u062C\u0633\u062A\u062C\u0648",
      searchBarPlaceholder: "\u0645\u0637\u0644\u0628\u06CC \u0631\u0627 \u062C\u0633\u062A\u062C\u0648 \u06A9\u0646\u06CC\u062F"
    },
    tableOfContents: {
      title: "\u0641\u0647\u0631\u0633\u062A"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u0632\u0645\u0627\u0646 \u062A\u0642\u0631\u06CC\u0628\u06CC \u0645\u0637\u0627\u0644\u0639\u0647: ${minutes} \u062F\u0642\u06CC\u0642\u0647`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627\u06CC \u0627\u062E\u06CC\u0631",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0627\u062E\u06CC\u0631`, "lastFewNotes")
    },
    error: {
      title: "\u06CC\u0627\u0641\u062A \u0646\u0634\u062F",
      notFound: "\u0627\u06CC\u0646 \u0635\u0641\u062D\u0647 \u06CC\u0627 \u062E\u0635\u0648\u0635\u06CC \u0627\u0633\u062A \u06CC\u0627 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F",
      home: "\u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0647 \u0635\u0641\u062D\u0647 \u0627\u0635\u0644\u06CC"
    },
    folderContent: {
      folder: "\u067E\u0648\u0634\u0647",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? ".\u06CC\u06A9 \u0645\u0637\u0644\u0628 \u062F\u0631 \u0627\u06CC\u0646 \u067E\u0648\u0634\u0647 \u0627\u0633\u062A" : `${count} \u0645\u0637\u0644\u0628 \u062F\u0631 \u0627\u06CC\u0646 \u067E\u0648\u0634\u0647 \u0627\u0633\u062A.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u0628\u0631\u0686\u0633\u0628",
      tagIndex: "\u0641\u0647\u0631\u0633\u062A \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u06CC\u06A9 \u0645\u0637\u0644\u0628 \u0628\u0627 \u0627\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628" : `${count} \u0645\u0637\u0644\u0628 \u0628\u0627 \u0627\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u062F\u0631 \u062D\u0627\u0644 \u0646\u0645\u0627\u06CC\u0634 ${count} \u0628\u0631\u0686\u0633\u0628.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `${count} \u0628\u0631\u0686\u0633\u0628 \u06CC\u0627\u0641\u062A \u0634\u062F.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/pl-PL.ts
var pl_PL_default = {
  propertyDefaults: {
    title: "Bez nazwy",
    description: "Brak opisu"
  },
  components: {
    callout: {
      note: "Notatka",
      abstract: "Streszczenie",
      info: "informacja",
      todo: "Do zrobienia",
      tip: "Wskaz\xF3wka",
      success: "Zrobione",
      question: "Pytanie",
      warning: "Ostrze\u017Cenie",
      failure: "Usterka",
      danger: "Niebiezpiecze\u0144stwo",
      bug: "B\u0142\u0105d w kodzie",
      example: "Przyk\u0142ad",
      quote: "Cytat"
    },
    backlinks: {
      title: "Odno\u015Bniki zwrotne",
      noBacklinksFound: "Brak po\u0142\u0105cze\u0144 zwrotnych"
    },
    themeToggle: {
      lightMode: "Trzyb jasny",
      darkMode: "Tryb ciemny"
    },
    readerMode: {
      title: "Tryb czytania"
    },
    explorer: {
      title: "Przegl\u0105daj"
    },
    footer: {
      createdWith: "Stworzone z u\u017Cyciem"
    },
    graph: {
      title: "Graf"
    },
    recentNotes: {
      title: "Najnowsze notatki",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Zobacz ${remaining} nastepnych \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Osadzone ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u0141\u0105cze do orygina\u0142u"
    },
    search: {
      title: "Szukaj",
      searchBarPlaceholder: "Wpisz fraz\u0119 wyszukiwania"
    },
    tableOfContents: {
      title: "Spis tre\u015Bci"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min. czytania `, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Najnowsze notatki",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Ostatnie ${count} notatek`, "lastFewNotes")
    },
    error: {
      title: "Nie znaleziono",
      notFound: "Ta strona jest prywatna lub nie istnieje.",
      home: "Powr\xF3t do strony g\u0142\xF3wnej"
    },
    folderContent: {
      folder: "Folder",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "W tym folderze jest 1 element." : `Element\xF3w w folderze: ${count}.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Znacznik",
      tagIndex: "Spis znacznik\xF3w",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Oznaczony 1 element." : `Element\xF3w z tym znacznikiem: ${count}.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Pokazuje ${count} pierwszych znacznik\xF3w.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Znalezionych wszystkich znacznik\xF3w: ${count}.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/cs-CZ.ts
var cs_CZ_default = {
  propertyDefaults: {
    title: "Bez n\xE1zvu",
    description: "Nebyl uveden \u017E\xE1dn\xFD popis"
  },
  components: {
    callout: {
      note: "Pozn\xE1mka",
      abstract: "Abstract",
      info: "Info",
      todo: "Todo",
      tip: "Tip",
      success: "\xDAsp\u011Bch",
      question: "Ot\xE1zka",
      warning: "Upozorn\u011Bn\xED",
      failure: "Chyba",
      danger: "Nebezpe\u010D\xED",
      bug: "Bug",
      example: "P\u0159\xEDklad",
      quote: "Citace"
    },
    backlinks: {
      title: "P\u0159\xEDchoz\xED odkazy",
      noBacklinksFound: "Nenalezeny \u017E\xE1dn\xE9 p\u0159\xEDchoz\xED odkazy"
    },
    themeToggle: {
      lightMode: "Sv\u011Btl\xFD re\u017Eim",
      darkMode: "Tmav\xFD re\u017Eim"
    },
    readerMode: {
      title: "Re\u017Eim \u010Dte\u010Dky"
    },
    explorer: {
      title: "Proch\xE1zet"
    },
    footer: {
      createdWith: "Vytvo\u0159eno pomoc\xED"
    },
    graph: {
      title: "Graf"
    },
    recentNotes: {
      title: "Nejnov\u011Bj\u0161\xED pozn\xE1mky",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Zobraz ${remaining} dal\u0161\xEDch \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Zobrazen\xED ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Odkaz na p\u016Fvodn\xED dokument"
    },
    search: {
      title: "Hledat",
      searchBarPlaceholder: "Hledejte n\u011Bco"
    },
    tableOfContents: {
      title: "Obsah"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min \u010Dten\xED`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Nejnov\u011Bj\u0161\xED pozn\xE1mky",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Posledn\xEDch ${count} pozn\xE1mek`, "lastFewNotes")
    },
    error: {
      title: "Nenalezeno",
      notFound: "Tato str\xE1nka je bu\u010F soukrom\xE1, nebo neexistuje.",
      home: "N\xE1vrat na domovskou str\xE1nku"
    },
    folderContent: {
      folder: "Slo\u017Eka",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 polo\u017Eka v t\xE9to slo\u017Ece." : `${count} polo\u017Eek v t\xE9to slo\u017Ece.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Rejst\u0159\xEDk tag\u016F",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 polo\u017Eka s t\xEDmto tagem." : `${count} polo\u017Eek s t\xEDmto tagem.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Zobrazuj\xED se prvn\xED ${count} tagy.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Nalezeno celkem ${count} tag\u016F.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/tr-TR.ts
var tr_TR_default = {
  propertyDefaults: {
    title: "\u0130simsiz",
    description: "Herhangi bir a\xE7\u0131klama eklenmedi"
  },
  components: {
    callout: {
      note: "Not",
      abstract: "\xD6zet",
      info: "Bilgi",
      todo: "Yap\u0131lacaklar",
      tip: "\u0130pucu",
      success: "Ba\u015Far\u0131l\u0131",
      question: "Soru",
      warning: "Uyar\u0131",
      failure: "Ba\u015Far\u0131s\u0131z",
      danger: "Tehlike",
      bug: "Hata",
      example: "\xD6rnek",
      quote: "Al\u0131nt\u0131"
    },
    backlinks: {
      title: "Backlinkler",
      noBacklinksFound: "Backlink bulunamad\u0131"
    },
    themeToggle: {
      lightMode: "A\xE7\u0131k mod",
      darkMode: "Koyu mod"
    },
    readerMode: {
      title: "Okuma modu"
    },
    explorer: {
      title: "Gezgin"
    },
    footer: {
      createdWith: "\u015Eununla olu\u015Fturuldu"
    },
    graph: {
      title: "Grafik G\xF6r\xFCn\xFCm\xFC"
    },
    recentNotes: {
      title: "Son Notlar",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} tane daha g\xF6r \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug} sayfas\u0131ndan al\u0131nt\u0131`, "transcludeOf"),
      linkToOriginal: "Orijinal ba\u011Flant\u0131"
    },
    search: {
      title: "Arama",
      searchBarPlaceholder: "Bir \u015Fey aray\u0131n"
    },
    tableOfContents: {
      title: "\u0130\xE7indekiler"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} dakika okuma s\xFCresi`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Son notlar",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Son ${count} not`, "lastFewNotes")
    },
    error: {
      title: "Bulunamad\u0131",
      notFound: "Bu sayfa ya \xF6zel ya da mevcut de\u011Fil.",
      home: "Anasayfaya geri d\xF6n"
    },
    folderContent: {
      folder: "Klas\xF6r",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Bu klas\xF6r alt\u0131nda 1 \xF6\u011Fe." : `Bu klas\xF6r alt\u0131ndaki ${count} \xF6\u011Fe.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Etiket",
      tagIndex: "Etiket S\u0131ras\u0131",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Bu etikete sahip 1 \xF6\u011Fe." : `Bu etiket alt\u0131ndaki ${count} \xF6\u011Fe.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0130lk ${count} etiket g\xF6steriliyor.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Toplam ${count} adet etiket bulundu.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/th-TH.ts
var th_TH_default = {
  propertyDefaults: {
    title: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D",
    description: "\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E22\u0E48\u0E2D"
  },
  components: {
    callout: {
      note: "\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38",
      abstract: "\u0E1A\u0E17\u0E04\u0E31\u0E14\u0E22\u0E48\u0E2D",
      info: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25",
      todo: "\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E33\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21",
      tip: "\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33",
      success: "\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22",
      question: "\u0E04\u0E33\u0E16\u0E32\u0E21",
      warning: "\u0E04\u0E33\u0E40\u0E15\u0E37\u0E2D\u0E19",
      failure: "\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14",
      danger: "\u0E2D\u0E31\u0E19\u0E15\u0E23\u0E32\u0E22",
      bug: "\u0E1A\u0E31\u0E4A\u0E01",
      example: "\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07",
      quote: "\u0E04\u0E33\u0E1E\u0E39\u0E01\u0E22\u0E01\u0E21\u0E32"
    },
    backlinks: {
      title: "\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E01\u0E25\u0E48\u0E32\u0E27\u0E16\u0E36\u0E07",
      noBacklinksFound: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E42\u0E22\u0E07\u0E21\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49"
    },
    themeToggle: {
      lightMode: "\u0E42\u0E2B\u0E21\u0E14\u0E2A\u0E27\u0E48\u0E32\u0E07",
      darkMode: "\u0E42\u0E2B\u0E21\u0E14\u0E21\u0E37\u0E14"
    },
    readerMode: {
      title: "\u0E42\u0E2B\u0E21\u0E14\u0E2D\u0E48\u0E32\u0E19"
    },
    explorer: {
      title: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2B\u0E19\u0E49\u0E32"
    },
    footer: {
      createdWith: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22"
    },
    graph: {
      title: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E01\u0E23\u0E32\u0E1F"
    },
    recentNotes: {
      title: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u0E14\u0E39\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2D\u0E35\u0E01 ${remaining} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0E23\u0E27\u0E21\u0E02\u0E49\u0E32\u0E21\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E08\u0E32\u0E01 ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "\u0E14\u0E39\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E49\u0E19\u0E17\u0E32\u0E07"
    },
    search: {
      title: "\u0E04\u0E49\u0E19\u0E2B\u0E32",
      searchBarPlaceholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E1A\u0E32\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E07"
    },
    tableOfContents: {
      title: "\u0E2A\u0E32\u0E23\u0E1A\u0E31\u0E0D"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u0E2D\u0E48\u0E32\u0E19\u0E23\u0E32\u0E27 ${minutes} \u0E19\u0E32\u0E17\u0E35`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14`, "lastFewNotes")
    },
    error: {
      title: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49",
      notFound: "\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49\u0E2D\u0E32\u0E08\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E2A\u0E23\u0E49\u0E32\u0E07",
      home: "\u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01"
    },
    folderContent: {
      folder: "\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u0E21\u0E35 ${count} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u0E41\u0E17\u0E47\u0E01",
      tagIndex: "\u0E41\u0E17\u0E47\u0E01\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u0E21\u0E35 ${count} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E41\u0E17\u0E47\u0E01\u0E19\u0E35\u0E49`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0E41\u0E2A\u0E14\u0E07 ${count} \u0E41\u0E17\u0E47\u0E01\u0E41\u0E23\u0E01`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `\u0E21\u0E35\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 ${count} \u0E41\u0E17\u0E47\u0E01`, "totalTags")
    }
  }
};

// quartz/i18n/locales/lt-LT.ts
var lt_LT_default = {
  propertyDefaults: {
    title: "Be Pavadinimo",
    description: "Apra\u0161ymas Nepateiktas"
  },
  components: {
    callout: {
      note: "Pastaba",
      abstract: "Santrauka",
      info: "Informacija",
      todo: "Darb\u0173 s\u0105ra\u0161as",
      tip: "Patarimas",
      success: "S\u0117kmingas",
      question: "Klausimas",
      warning: "\u012Esp\u0117jimas",
      failure: "Nes\u0117kmingas",
      danger: "Pavojus",
      bug: "Klaida",
      example: "Pavyzdys",
      quote: "Citata"
    },
    backlinks: {
      title: "Atgalin\u0117s Nuorodos",
      noBacklinksFound: "Atgalini\u0173 Nuorod\u0173 Nerasta"
    },
    themeToggle: {
      lightMode: "\u0160viesus Re\u017Eimas",
      darkMode: "Tamsus Re\u017Eimas"
    },
    readerMode: {
      title: "Modalit\xE0 lettore"
    },
    explorer: {
      title: "Nar\u0161ykl\u0117"
    },
    footer: {
      createdWith: "Sukurta Su"
    },
    graph: {
      title: "Grafiko Vaizdas"
    },
    recentNotes: {
      title: "Naujausi U\u017Era\u0161ai",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Per\u017Ei\u016Br\u0117ti dar ${remaining} \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u012Eterpimas i\u0161 ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Nuoroda \u012F original\u0105"
    },
    search: {
      title: "Paie\u0161ka",
      searchBarPlaceholder: "Ie\u0161koti"
    },
    tableOfContents: {
      title: "Turinys"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min skaitymo`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Naujausi u\u017Era\u0161ai",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Paskutinis 1 u\u017Era\u0161as" : count < 10 ? `Paskutiniai ${count} u\u017Era\u0161ai` : `Paskutiniai ${count} u\u017Era\u0161\u0173`, "lastFewNotes")
    },
    error: {
      title: "Nerasta",
      notFound: "Arba \u0161is puslapis yra pasiekiamas tik tam tikriems vartotojams, arba tokio puslapio n\u0117ra.",
      home: "Gr\u012F\u017Eti \u012F pagrindin\u012F puslap\u012F"
    },
    folderContent: {
      folder: "Aplankas",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 elementas \u0161iame aplanke." : count < 10 ? `${count} elementai \u0161iame aplanke.` : `${count} element\u0173 \u0161iame aplanke.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "\u017Dyma",
      tagIndex: "\u017Dym\u0173 indeksas",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 elementas su \u0161ia \u017Eyma." : count < 10 ? `${count} elementai su \u0161ia \u017Eyma.` : `${count} element\u0173 su \u0161ia \u017Eyma.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => count < 10 ? `Rodomos pirmosios ${count} \u017Eymos.` : `Rodomos pirmosios ${count} \u017Eym\u0173.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Rasta i\u0161 viso 1 \u017Eyma." : count < 10 ? `Rasta i\u0161 viso ${count} \u017Eymos.` : `Rasta i\u0161 viso ${count} \u017Eym\u0173.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/fi-FI.ts
var fi_FI_default = {
  propertyDefaults: {
    title: "Nimet\xF6n",
    description: "Ei kuvausta saatavilla"
  },
  components: {
    callout: {
      note: "Merkint\xE4",
      abstract: "Tiivistelm\xE4",
      info: "Info",
      todo: "Teht\xE4v\xE4lista",
      tip: "Vinkki",
      success: "Onnistuminen",
      question: "Kysymys",
      warning: "Varoitus",
      failure: "Ep\xE4onnistuminen",
      danger: "Vaara",
      bug: "Virhe",
      example: "Esimerkki",
      quote: "Lainaus"
    },
    backlinks: {
      title: "Takalinkit",
      noBacklinksFound: "Takalinkkej\xE4 ei l\xF6ytynyt"
    },
    themeToggle: {
      lightMode: "Vaalea tila",
      darkMode: "Tumma tila"
    },
    readerMode: {
      title: "Lukijatila"
    },
    explorer: {
      title: "Selain"
    },
    footer: {
      createdWith: "Luotu k\xE4ytt\xE4en"
    },
    graph: {
      title: "Verkkon\xE4kym\xE4"
    },
    recentNotes: {
      title: "Viimeisimm\xE4t muistiinpanot",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `N\xE4yt\xE4 ${remaining} lis\xE4\xE4 \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Upote kohteesta ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Linkki alkuper\xE4iseen"
    },
    search: {
      title: "Haku",
      searchBarPlaceholder: "Hae jotain"
    },
    tableOfContents: {
      title: "Sis\xE4llysluettelo"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min lukuaika`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Viimeisimm\xE4t muistiinpanot",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Viimeiset ${count} muistiinpanoa`, "lastFewNotes")
    },
    error: {
      title: "Ei l\xF6ytynyt",
      notFound: "T\xE4m\xE4 sivu on joko yksityinen tai sit\xE4 ei ole olemassa.",
      home: "Palaa etusivulle"
    },
    folderContent: {
      folder: "Kansio",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 kohde t\xE4ss\xE4 kansiossa." : `${count} kohdetta t\xE4ss\xE4 kansiossa.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tunniste",
      tagIndex: "Tunnisteluettelo",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 kohde t\xE4ll\xE4 tunnisteella." : `${count} kohdetta t\xE4ll\xE4 tunnisteella.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `N\xE4ytet\xE4\xE4n ensimm\xE4iset ${count} tunnistetta.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `L\xF6ytyi yhteens\xE4 ${count} tunnistetta.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/nb-NO.ts
var nb_NO_default = {
  propertyDefaults: {
    title: "Uten navn",
    description: "Ingen beskrivelse angitt"
  },
  components: {
    callout: {
      note: "Notis",
      abstract: "Abstrakt",
      info: "Info",
      todo: "Husk p\xE5",
      tip: "Tips",
      success: "Suksess",
      question: "Sp\xF8rsm\xE5l",
      warning: "Advarsel",
      failure: "Feil",
      danger: "Farlig",
      bug: "Bug",
      example: "Eksempel",
      quote: "Sitat"
    },
    backlinks: {
      title: "Tilbakekoblinger",
      noBacklinksFound: "Ingen tilbakekoblinger funnet"
    },
    themeToggle: {
      lightMode: "Lys modus",
      darkMode: "M\xF8rk modus"
    },
    readerMode: {
      title: "L\xE6semodus"
    },
    explorer: {
      title: "Utforsker"
    },
    footer: {
      createdWith: "Laget med"
    },
    graph: {
      title: "Graf-visning"
    },
    recentNotes: {
      title: "Nylige notater",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Se ${remaining} til \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transkludering of ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Lenke til original"
    },
    search: {
      title: "S\xF8k",
      searchBarPlaceholder: "S\xF8k etter noe"
    },
    tableOfContents: {
      title: "Oversikt"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min lesning`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Nylige notat",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Siste ${count} notat`, "lastFewNotes")
    },
    error: {
      title: "Ikke funnet",
      notFound: "Enten er denne siden privat eller s\xE5 finnes den ikke.",
      home: "Returner til hovedsiden"
    },
    folderContent: {
      folder: "Mappe",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 gjenstand i denne mappen." : `${count} gjenstander i denne mappen.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tagg",
      tagIndex: "Tagg Indeks",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 gjenstand med denne taggen." : `${count} gjenstander med denne taggen.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Viser f\xF8rste ${count} tagger.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Fant totalt ${count} tagger.`, "totalTags")
    }
  }
};

// quartz/i18n/locales/id-ID.ts
var id_ID_default = {
  propertyDefaults: {
    title: "Tanpa Judul",
    description: "Tidak ada deskripsi"
  },
  components: {
    callout: {
      note: "Catatan",
      abstract: "Abstrak",
      info: "Info",
      todo: "Daftar Tugas",
      tip: "Tips",
      success: "Berhasil",
      question: "Pertanyaan",
      warning: "Peringatan",
      failure: "Gagal",
      danger: "Bahaya",
      bug: "Bug",
      example: "Contoh",
      quote: "Kutipan"
    },
    backlinks: {
      title: "Tautan Balik",
      noBacklinksFound: "Tidak ada tautan balik ditemukan"
    },
    themeToggle: {
      lightMode: "Mode Terang",
      darkMode: "Mode Gelap"
    },
    readerMode: {
      title: "Mode Pembaca"
    },
    explorer: {
      title: "Penjelajah"
    },
    footer: {
      createdWith: "Dibuat dengan"
    },
    graph: {
      title: "Tampilan Grafik"
    },
    recentNotes: {
      title: "Catatan Terbaru",
      seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Lihat ${remaining} lagi \u2192`, "seeRemainingMore")
    },
    transcludes: {
      transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transklusi dari ${targetSlug}`, "transcludeOf"),
      linkToOriginal: "Tautan ke asli"
    },
    search: {
      title: "Cari",
      searchBarPlaceholder: "Cari sesuatu"
    },
    tableOfContents: {
      title: "Daftar Isi"
    },
    contentMeta: {
      readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} menit baca`, "readingTime")
    }
  },
  pages: {
    rss: {
      recentNotes: "Catatan terbaru",
      lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} catatan terakhir`, "lastFewNotes")
    },
    error: {
      title: "Tidak Ditemukan",
      notFound: "Halaman ini bersifat privat atau tidak ada.",
      home: "Kembali ke Beranda"
    },
    folderContent: {
      folder: "Folder",
      itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item di bawah folder ini." : `${count} item di bawah folder ini.`, "itemsUnderFolder")
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Indeks Tag",
      itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item dengan tag ini." : `${count} item dengan tag ini.`, "itemsUnderTag"),
      showingFirst: /* @__PURE__ */ __name(({ count }) => `Menampilkan ${count} tag pertama.`, "showingFirst"),
      totalTags: /* @__PURE__ */ __name(({ count }) => `Ditemukan total ${count} tag.`, "totalTags")
    }
  }
};

// quartz/i18n/index.ts
var TRANSLATIONS = {
  "en-US": en_US_default,
  "en-GB": en_GB_default,
  "fr-FR": fr_FR_default,
  "it-IT": it_IT_default,
  "ja-JP": ja_JP_default,
  "de-DE": de_DE_default,
  "nl-NL": nl_NL_default,
  "nl-BE": nl_NL_default,
  "ro-RO": ro_RO_default,
  "ro-MD": ro_RO_default,
  "ca-ES": ca_ES_default,
  "es-ES": es_ES_default,
  "ar-SA": ar_SA_default,
  "ar-AE": ar_SA_default,
  "ar-QA": ar_SA_default,
  "ar-BH": ar_SA_default,
  "ar-KW": ar_SA_default,
  "ar-OM": ar_SA_default,
  "ar-YE": ar_SA_default,
  "ar-IR": ar_SA_default,
  "ar-SY": ar_SA_default,
  "ar-IQ": ar_SA_default,
  "ar-JO": ar_SA_default,
  "ar-PL": ar_SA_default,
  "ar-LB": ar_SA_default,
  "ar-EG": ar_SA_default,
  "ar-SD": ar_SA_default,
  "ar-LY": ar_SA_default,
  "ar-MA": ar_SA_default,
  "ar-TN": ar_SA_default,
  "ar-DZ": ar_SA_default,
  "ar-MR": ar_SA_default,
  "uk-UA": uk_UA_default,
  "ru-RU": ru_RU_default,
  "ko-KR": ko_KR_default,
  "zh-CN": zh_CN_default,
  "zh-TW": zh_TW_default,
  "vi-VN": vi_VN_default,
  "pt-BR": pt_BR_default,
  "hu-HU": hu_HU_default,
  "fa-IR": fa_IR_default,
  "pl-PL": pl_PL_default,
  "cs-CZ": cs_CZ_default,
  "tr-TR": tr_TR_default,
  "th-TH": th_TH_default,
  "lt-LT": lt_LT_default,
  "fi-FI": fi_FI_default,
  "nb-NO": nb_NO_default,
  "id-ID": id_ID_default
};
var defaultTranslation = "en-US";
var i18n = /* @__PURE__ */ __name((locale) => TRANSLATIONS[locale ?? defaultTranslation], "i18n");

// quartz/plugins/transformers/frontmatter.ts
var OBSIDIAN_LINK_PATTERN = /!?\[\[[^\]\r\n]+\]\]/;
var sanitizeObsidianEmbeds = /* @__PURE__ */ __name((frontmatter) => {
  const wrap = /* @__PURE__ */ __name((prefix, target) => `${prefix}"${target}"`, "wrap");
  const patternSource = OBSIDIAN_LINK_PATTERN.source;
  const valuePattern = new RegExp(`(^\\s*[^\\n:]+:\\s*)(?<!["'])(${patternSource})(?=\\s*$)`, "gm");
  const listPattern = new RegExp(`(^\\s*-\\s*)(?<!["'])(${patternSource})(?=\\s*$)`, "gm");
  if (!OBSIDIAN_LINK_PATTERN.test(frontmatter)) {
    return frontmatter;
  }
  return frontmatter.replace(listPattern, (_, prefix, target) => wrap(prefix, target)).replace(valuePattern, (_, prefix, target) => wrap(prefix, target));
}, "sanitizeObsidianEmbeds");
var defaultOptions = {
  delimiters: "---",
  language: "yaml"
};
function coalesceAliases(data, aliases) {
  for (const alias of aliases) {
    if (data[alias] !== void 0 && data[alias] !== null) return data[alias];
  }
}
__name(coalesceAliases, "coalesceAliases");
function coerceToArray(input) {
  if (input === void 0 || input === null) return void 0;
  if (!Array.isArray(input)) {
    input = input.toString().split(",").map((tag) => tag.trim());
  }
  return input.filter((tag) => typeof tag === "string" || typeof tag === "number").map((tag) => tag.toString());
}
__name(coerceToArray, "coerceToArray");
function getAliasSlugs(aliases) {
  const res = [];
  for (const alias of aliases) {
    const isMd = getFileExtension(alias) === "md";
    const mockFp = isMd ? alias : alias + ".md";
    const slug = slugifyFilePath(mockFp);
    res.push(slug);
  }
  return res;
}
__name(getAliasSlugs, "getAliasSlugs");
var FrontMatter = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions, ...userOpts };
  return {
    name: "FrontMatter",
    markdownPlugins(ctx) {
      const { cfg, allSlugs } = ctx;
      return [
        [remarkFrontmatter, ["yaml", "toml"]],
        () => {
          return (_, file) => {
            const fileData = Buffer.from(file.value);
            const { data } = matter(fileData, {
              ...opts,
              engines: {
                yaml: /* @__PURE__ */ __name((s) => yaml.load(sanitizeObsidianEmbeds(s), { schema: yaml.JSON_SCHEMA }), "yaml"),
                toml: /* @__PURE__ */ __name((s) => toml.parse(s), "toml")
              }
            });
            if (data.title != null && data.title.toString() !== "") {
              data.title = data.title.toString();
            } else {
              data.title = file.stem ?? i18n(cfg.configuration.locale).propertyDefaults.title;
            }
            const tags = coerceToArray(coalesceAliases(data, ["tags", "tag"]));
            if (tags) data.tags = [...new Set(tags.map((tag) => slugTag(tag)))];
            const aliases = coerceToArray(coalesceAliases(data, ["aliases", "alias"]));
            if (aliases) {
              data.aliases = aliases;
              file.data.aliases = getAliasSlugs(aliases);
              allSlugs.push(...file.data.aliases);
            }
            if (data.permalink != null && data.permalink.toString() !== "") {
              data.permalink = data.permalink.toString();
              const aliases2 = file.data.aliases ?? [];
              aliases2.push(data.permalink);
              file.data.aliases = aliases2;
              allSlugs.push(data.permalink);
            }
            const cssclasses = coerceToArray(coalesceAliases(data, ["cssclasses", "cssclass"]));
            if (cssclasses) data.cssclasses = cssclasses;
            const socialImage = coalesceAliases(data, ["socialImage", "image", "cover"]);
            const created = coalesceAliases(data, ["created", "date"]);
            if (created) {
              data.created = created;
              data.modified ||= created;
            }
            const modified = coalesceAliases(data, [
              "modified",
              "lastmod",
              "updated",
              "last-modified"
            ]);
            if (modified) data.modified = modified;
            const published = coalesceAliases(data, ["published", "publishDate", "date"]);
            if (published) data.published = published;
            if (socialImage) data.socialImage = socialImage;
            const uniqueSlugs = [...new Set(allSlugs)];
            allSlugs.splice(0, allSlugs.length, ...uniqueSlugs);
            file.data.frontmatter = data;
          };
        }
      ];
    }
  };
}, "FrontMatter");

// quartz/plugins/transformers/gfm.ts
import remarkGfm from "remark-gfm";
import smartypants from "remark-smartypants";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
var defaultOptions2 = {
  enableSmartyPants: true,
  linkHeadings: true
};
var GitHubFlavoredMarkdown = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions2, ...userOpts };
  return {
    name: "GitHubFlavoredMarkdown",
    markdownPlugins() {
      return opts.enableSmartyPants ? [remarkGfm, smartypants] : [remarkGfm];
    },
    htmlPlugins() {
      if (opts.linkHeadings) {
        return [
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "append",
              properties: {
                role: "anchor",
                ariaHidden: true,
                tabIndex: -1,
                "data-no-popover": true
              },
              content: {
                type: "element",
                tagName: "svg",
                properties: {
                  width: 18,
                  height: 18,
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": "2",
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round"
                },
                children: [
                  {
                    type: "element",
                    tagName: "path",
                    properties: {
                      d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                    },
                    children: []
                  },
                  {
                    type: "element",
                    tagName: "path",
                    properties: {
                      d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                    },
                    children: []
                  }
                ]
              }
            }
          ]
        ];
      } else {
        return [];
      }
    }
  };
}, "GitHubFlavoredMarkdown");

// quartz/plugins/transformers/citations.ts
import rehypeCitation from "rehype-citation";
import { visit } from "unist-util-visit";

// quartz/plugins/transformers/lastmod.ts
import fs from "fs";
import { Repository } from "@napi-rs/simple-git";
import path from "path";
import { execSync } from "child_process";
var defaultOptions3 = {
  priority: ["frontmatter", "git", "filesystem"]
};
function coerceDate(fp, d) {
  const dt = new Date(d);
  const invalidDate = isNaN(dt.getTime()) || dt.getTime() === 0;
  return invalidDate ? void 0 : dt;
}
__name(coerceDate, "coerceDate");
var CreatedModifiedDate = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions3, ...userOpts };
  return {
    name: "CreatedModifiedDate",
    markdownPlugins(ctx) {
      return [
        () => {
          let repo = void 0;
          let repoRoot = "";
          let processCount = 0;
          if (opts.priority.includes("git")) {
            try {
              repo = Repository.discover(ctx.argv.directory);
              repoRoot = repo.workdir() || "";
              console.error(`[DEBUG] Git Repo Discovered. Root: ${repoRoot}, ArgvDir: ${ctx.argv.directory}`);
            } catch (e) {
              console.error(`[DEBUG] Failed to discover git repo: ${e}`);
            }
          }
          return async (_tree, file) => {
            processCount++;
            const isDebug = processCount <= 5;
            let created = void 0;
            let modified = void 0;
            let published = void 0;
            const fp = file.data.relativePath;
            const fullFp = file.data.filePath;
            if (isDebug) {
              console.error(`[DEBUG] File #${processCount}: ${fp}`);
              console.error(`[DEBUG] Full Path: ${fullFp}`);
            }
            for (const source of opts.priority) {
              if (source === "filesystem") {
                try {
                  const st = await fs.promises.stat(fullFp);
                  created ||= st.birthtimeMs;
                  modified ||= st.mtimeMs;
                } catch (e) {
                }
              } else if (source === "frontmatter" && file.data.frontmatter) {
                if (file.data.frontmatter.created) created ||= file.data.frontmatter.created;
                if (file.data.frontmatter.modified) modified ||= file.data.frontmatter.modified;
                if (file.data.frontmatter.published) published ||= file.data.frontmatter.published;
              } else if (source === "git" && repoRoot) {
                try {
                  const absoluteFp = path.resolve(fullFp);
                  const normalize = /* @__PURE__ */ __name((p) => p.replace(/\\/g, "/"), "normalize");
                  const normWorkdir = normalize(repoRoot);
                  const normFp = normalize(absoluteFp);
                  let relativePath = normFp;
                  if (normFp.toLowerCase().startsWith(normWorkdir.toLowerCase())) {
                    relativePath = normFp.slice(normWorkdir.length);
                  }
                  relativePath = relativePath.replace(/^\/+/, "");
                  if (isDebug) console.error(`[DEBUG] Relative path for git: ${relativePath}`);
                  let gitDate = void 0;
                  if (repo) {
                    gitDate = await repo.getFileLatestModifiedDateAsync(relativePath);
                    if (isDebug) console.error(`[DEBUG] Simple-Git returned: ${gitDate}`);
                  }
                  if (!gitDate) {
                    try {
                      const cmd = `git log -1 --format=%ct -- "${relativePath}"`;
                      const out = execSync(cmd, { cwd: repoRoot, encoding: "utf-8" }).trim();
                      if (isDebug) console.error(`[DEBUG] CLI Git returned: '${out}'`);
                      if (out && !isNaN(parseInt(out))) {
                        gitDate = parseInt(out) * 1e3;
                      }
                    } catch (execErr) {
                      if (isDebug) console.error(`[DEBUG] CLI Git failed: ${execErr}`);
                    }
                  }
                  if (gitDate) {
                    modified ||= gitDate;
                  }
                } catch (e) {
                  console.error(`[DEBUG] Git processing error for ${fp}: ${e}`);
                }
              }
            }
            const finalDate = coerceDate(fp, modified);
            if (isDebug) console.error(`[DEBUG] Final Modified Date: ${finalDate}`);
            file.data.dates = {
              created: coerceDate(fp, created),
              modified: finalDate,
              published: coerceDate(fp, published)
            };
          };
        }
      ];
    }
  };
}, "CreatedModifiedDate");

// quartz/plugins/transformers/latex.ts
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeMathjax from "rehype-mathjax/svg";
import rehypeTypst from "@myriaddreamin/rehype-typst";
var Latex = /* @__PURE__ */ __name((opts) => {
  const engine = opts?.renderEngine ?? "katex";
  const macros = opts?.customMacros ?? {};
  return {
    name: "Latex",
    markdownPlugins() {
      return [remarkMath];
    },
    htmlPlugins() {
      switch (engine) {
        case "katex": {
          return [[rehypeKatex, { output: "html", macros, ...opts?.katexOptions ?? {} }]];
        }
        case "typst": {
          return [[rehypeTypst, opts?.typstOptions ?? {}]];
        }
        case "mathjax": {
          return [[rehypeMathjax, { macros, ...opts?.mathJaxOptions ?? {} }]];
        }
        default: {
          return [[rehypeMathjax, { macros, ...opts?.mathJaxOptions ?? {} }]];
        }
      }
    },
    externalResources() {
      switch (engine) {
        case "katex":
          return {
            css: [{ content: "/static/katex/katex.min.css" }],
            js: [
              {
                // fix copy behaviour: https://github.com/KaTeX/KaTeX/blob/main/contrib/copy-tex/README.md
                src: "/static/katex/contrib/copy-tex.min.js",
                loadTime: "afterDOMReady",
                contentType: "external"
              }
            ]
          };
      }
    }
  };
}, "Latex");

// quartz/plugins/transformers/description.ts
import { toString } from "hast-util-to-string";

// quartz/util/escape.ts
var escapeHTML = /* @__PURE__ */ __name((unsafe) => {
  return unsafe.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}, "escapeHTML");
var unescapeHTML = /* @__PURE__ */ __name((html) => {
  return html.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#039;", "'");
}, "unescapeHTML");

// quartz/plugins/transformers/description.ts
var defaultOptions4 = {
  descriptionLength: 150,
  maxDescriptionLength: 300,
  replaceExternalLinks: true
};
var urlRegex = new RegExp(
  /(https?:\/\/)?(?<domain>([\da-z\.-]+)\.([a-z\.]{2,6})(:\d+)?)(?<path>[\/\w\.-]*)(\?[\/\w\.=&;-]*)?/,
  "g"
);
var Description = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions4, ...userOpts };
  return {
    name: "Description",
    htmlPlugins() {
      return [
        () => {
          return async (tree, file) => {
            let frontMatterDescription = file.data.frontmatter?.description;
            let text = escapeHTML(toString(tree));
            if (opts.replaceExternalLinks) {
              frontMatterDescription = frontMatterDescription?.replace(
                urlRegex,
                "$<domain>$<path>"
              );
              text = text.replace(urlRegex, "$<domain>$<path>");
            }
            if (frontMatterDescription) {
              file.data.description = frontMatterDescription;
              file.data.text = text;
              return;
            }
            const desc = text;
            const sentences = desc.replace(/\s+/g, " ").split(/\.\s/);
            let finalDesc = "";
            let sentenceIdx = 0;
            while (sentenceIdx < sentences.length) {
              const sentence = sentences[sentenceIdx];
              if (!sentence) break;
              const currentSentence = sentence.endsWith(".") ? sentence : sentence + ".";
              const nextLength = finalDesc.length + currentSentence.length + (finalDesc ? 1 : 0);
              if (nextLength <= opts.descriptionLength || sentenceIdx === 0) {
                finalDesc += (finalDesc ? " " : "") + currentSentence;
                sentenceIdx++;
              } else {
                break;
              }
            }
            file.data.description = finalDesc.length > opts.maxDescriptionLength ? finalDesc.slice(0, opts.maxDescriptionLength) + "..." : finalDesc;
            file.data.text = text;
          };
        }
      ];
    }
  };
}, "Description");

// quartz/plugins/transformers/links.ts
import path2 from "path";
import { visit as visit2 } from "unist-util-visit";
import isAbsoluteUrl from "is-absolute-url";
var defaultOptions5 = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: false,
  lazyLoad: false
};
var CrawlLinks = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions5, ...userOpts };
  return {
    name: "LinkProcessing",
    htmlPlugins(ctx) {
      return [
        () => {
          return (tree, file) => {
            const curSlug = simplifySlug(file.data.slug);
            const outgoing = /* @__PURE__ */ new Set();
            const transformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs
            };
            visit2(tree, "element", (node, _index, _parent) => {
              if (node.tagName === "a" && node.properties && typeof node.properties.href === "string") {
                let dest = node.properties.href;
                const classes = node.properties.className ?? [];
                const isExternal = isAbsoluteUrl(dest);
                const hasAlias = node.children.length === 1 && node.children[0].type === "text" && node.children[0].value !== dest;
                classes.push(isExternal ? "external" : "internal");
                if (hasAlias) {
                  classes.push("alias");
                }
                node.properties.className = classes;
                if (isExternal && opts.openLinksInNewTab) {
                  node.properties.target = "_blank";
                }
                const isInternal = !(isAbsoluteUrl(dest) || dest.startsWith("#"));
                if (isInternal) {
                  dest = node.properties.href = transformLink(
                    file.data.slug,
                    dest,
                    transformOptions
                  );
                  const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true));
                  const canonicalDest = url.pathname;
                  let [destCanonical, _destAnchor] = splitAnchor(canonicalDest);
                  if (destCanonical.endsWith("/")) {
                    destCanonical += "index";
                  }
                  const full = decodeURIComponent(stripSlashes(destCanonical, true));
                  const simple = simplifySlug(full);
                  outgoing.add(simple);
                  node.properties["data-slug"] = full;
                }
                if (opts.prettyLinks && isInternal && !hasAlias && node.children.length === 1 && node.children[0].type === "text" && !node.children[0].value.startsWith("#")) {
                  node.children[0].value = path2.basename(node.children[0].value);
                }
              }
              if (["img", "video", "audio", "iframe"].includes(node.tagName) && node.properties && typeof node.properties.src === "string") {
                if (opts.lazyLoad) {
                  node.properties.loading = "lazy";
                }
                if (!isAbsoluteUrl(node.properties.src)) {
                  let dest = node.properties.src;
                  if (dest.includes("?")) {
                    return;
                  }
                  dest = node.properties.src = transformLink(
                    file.data.slug,
                    dest,
                    transformOptions
                  );
                  node.properties.src = dest;
                }
              }
            });
            file.data.links = [...outgoing];
          };
        }
      ];
    }
  };
}, "CrawlLinks");

// quartz/plugins/transformers/ofm.ts
import { findAndReplace as mdastFindReplace } from "mdast-util-find-and-replace";
import rehypeRaw from "rehype-raw";
import { SKIP, visit as visit3 } from "unist-util-visit";
import path3 from "path";

// quartz/components/scripts/callout.inline.ts
var callout_inline_default = "";

// quartz/components/scripts/checkbox.inline.ts
var checkbox_inline_default = "";

// quartz/components/scripts/mermaid.inline.ts
var mermaid_inline_default = "";

// quartz/components/styles/mermaid.inline.scss
var mermaid_inline_default2 = "";

// quartz/plugins/transformers/ofm.ts
import { toHast } from "mdast-util-to-hast";
import { toHtml } from "hast-util-to-html";

// quartz/util/lang.ts
function capitalize(s) {
  return s.substring(0, 1).toUpperCase() + s.substring(1);
}
__name(capitalize, "capitalize");
function classNames(displayClass, ...classes) {
  if (displayClass) {
    classes.push(displayClass);
  }
  return classes.join(" ");
}
__name(classNames, "classNames");

// quartz/plugins/transformers/ofm.ts
var defaultOptions6 = {
  comments: true,
  highlight: true,
  wikilinks: true,
  callouts: true,
  mermaid: true,
  parseTags: true,
  parseArrows: true,
  parseBlockReferences: true,
  enableInHtmlEmbed: false,
  enableYouTubeEmbed: true,
  enableVideoEmbed: true,
  enableCheckbox: false,
  disableBrokenWikilinks: false
};
var calloutMapping = {
  note: "note",
  abstract: "abstract",
  summary: "abstract",
  tldr: "abstract",
  info: "info",
  todo: "todo",
  tip: "tip",
  hint: "tip",
  important: "tip",
  success: "success",
  check: "success",
  done: "success",
  question: "question",
  help: "question",
  faq: "question",
  warning: "warning",
  attention: "warning",
  caution: "warning",
  failure: "failure",
  missing: "failure",
  fail: "failure",
  danger: "danger",
  error: "danger",
  bug: "bug",
  example: "example",
  quote: "quote",
  cite: "quote"
};
var arrowMapping = {
  "->": "&rarr;",
  "-->": "&rArr;",
  "=>": "&rArr;",
  "==>": "&rArr;",
  "<-": "&larr;",
  "<--": "&lArr;",
  "<=": "&lArr;",
  "<==": "&lArr;"
};
function canonicalizeCallout(calloutName) {
  const normalizedCallout = calloutName.toLowerCase();
  return calloutMapping[normalizedCallout] ?? calloutName;
}
__name(canonicalizeCallout, "canonicalizeCallout");
var externalLinkRegex = /^https?:\/\//i;
var arrowRegex = new RegExp(/(-{1,2}>|={1,2}>|<-{1,2}|<={1,2})/g);
var wikilinkRegex = new RegExp(
  /!?\[\[([^\[\]\|\#\\]+)?(#+[^\[\]\|\#\\]+)?(\\?\|[^\[\]\#]*)?\]\]/g
);
function resolveWikilinkTarget(raw, allSlugs) {
  const candidate = raw?.trim();
  if (!candidate) {
    return raw ?? "";
  }
  let slug;
  try {
    slug = slugifyFilePath(candidate);
  } catch (_error) {
    return candidate;
  }
  if (!allSlugs || allSlugs.length === 0) {
    return slug;
  }
  const simplifiedTarget = simplifySlug(slug);
  const match = allSlugs.find((existing) => simplifySlug(existing) === simplifiedTarget);
  return match ?? slug;
}
__name(resolveWikilinkTarget, "resolveWikilinkTarget");
var tableRegex = new RegExp(/^\|([^\n])+\|\n(\|)( ?:?-{3,}:? ?\|)+\n(\|([^\n])+\|\n?)+/gm);
var tableWikilinkRegex = new RegExp(/(!?\[\[[^\]]*?\]\]|\[\^[^\]]*?\])/g);
var highlightRegex = new RegExp(/==([^=]+)==/g);
var commentRegex = new RegExp(/%%[\s\S]*?%%/g);
var calloutRegex = new RegExp(/^\[\!([\w-]+)\|?(.+?)?\]([+-]?)/);
var calloutLineRegex = new RegExp(/^> *\[\!\w+\|?.*?\][+-]?.*$/gm);
var tagRegex = new RegExp(
  /(?<=^| )#((?:[-_\p{L}\p{Emoji}\p{M}\d])+(?:\/[-_\p{L}\p{Emoji}\p{M}\d]+)*)/gu
);
var blockReferenceRegex = new RegExp(/\^([-_A-Za-z0-9]+)$/g);
var ytLinkRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
var ytPlaylistLinkRegex = /[?&]list=([^#?&]*)/;
var videoExtensionRegex = new RegExp(/\.(mp4|webm|ogg|avi|mov|flv|wmv|mkv|mpg|mpeg|3gp|m4v)$/);
var wikilinkImageEmbedRegex = new RegExp(
  /^(?<alt>(?!^\d*x?\d*$).*?)?(\|?\s*?(?<width>\d+)(x(?<height>\d+))?)?$/
);
var EMBED_ALLOW_FEATURES = [
  "accelerometer",
  "autoplay",
  "fullscreen",
  "clipboard-write",
  "encrypted-media",
  "gyroscope",
  "picture-in-picture",
  "web-share"
];
var YOUTUBE_EMBED_SRC_REGEX = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/embed\/)/i;
var DRIVE_PREVIEW_SRC_REGEX = /drive\.google\.com\/file\/.*\/preview/i;
var mergeAllowFeatures = /* @__PURE__ */ __name((existing) => {
  const features = /* @__PURE__ */ new Set();
  if (typeof existing === "string") {
    existing.split(";").map((feature) => feature.trim()).filter(Boolean).forEach((feature) => features.add(feature));
  } else if (Array.isArray(existing)) {
    existing.map((feature) => typeof feature === "string" ? feature : String(feature)).flatMap((feature) => feature.split(";")).map((feature) => feature.trim()).filter(Boolean).forEach((feature) => features.add(feature));
  }
  for (const feature of EMBED_ALLOW_FEATURES) {
    features.add(feature);
  }
  return Array.from(features).join("; ");
}, "mergeAllowFeatures");
var normalizeClassList = /* @__PURE__ */ __name((value) => {
  const classNames2 = /* @__PURE__ */ new Set();
  if (typeof value === "string") {
    value.split(/\s+/).map((cls) => cls.trim()).filter(Boolean).forEach((cls) => classNames2.add(cls));
  } else if (Array.isArray(value)) {
    value.flatMap((entry) => typeof entry === "string" ? entry.split(/\s+/) : []).map((cls) => cls.trim()).filter(Boolean).forEach((cls) => classNames2.add(cls));
  }
  return classNames2;
}, "normalizeClassList");
var ensureEmbedAttributes = /* @__PURE__ */ __name((node, kind) => {
  node.properties = node.properties ?? {};
  const props = node.properties;
  props.allow = mergeAllowFeatures(props.allow);
  if (props.allowfullscreen === void 0) {
    props.allowfullscreen = true;
  }
  if (props.loading === void 0) {
    props.loading = "lazy";
  }
  if (props.referrerpolicy === void 0) {
    props.referrerpolicy = "strict-origin-when-cross-origin";
  }
  if (props.frameborder === void 0) {
    props.frameborder = 0;
  }
  const classNames2 = normalizeClassList(props.className ?? props.class);
  classNames2.add("external-embed");
  if (kind === "youtube") {
    classNames2.add("youtube");
  } else if (kind === "drive") {
    classNames2.add("drive");
  }
  props.className = Array.from(classNames2);
  if ("class" in props) {
    delete props.class;
  }
  if (!props.title) {
    props.title = kind === "youtube" ? "YouTube video" : "Embedded media";
  }
  if (kind === "youtube" && typeof props.src === "string" && props.src.length > 0) {
    try {
      const url = new URL(props.src, "https://www.youtube.com");
      if (url.searchParams.get("enablejsapi") !== "1") {
        url.searchParams.set("enablejsapi", "1");
      }
      if (!url.searchParams.has("playsinline")) {
        url.searchParams.set("playsinline", "1");
      }
      props.src = url.toString();
    } catch (error) {
      console.warn("ensureEmbedAttributes: unable to normalize YouTube src", error);
    }
  }
}, "ensureEmbedAttributes");
var ObsidianFlavoredMarkdown = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions6, ...userOpts };
  const mdastToHtml = /* @__PURE__ */ __name((ast) => {
    const hast = toHast(ast, { allowDangerousHtml: true });
    return toHtml(hast, { allowDangerousHtml: true });
  }, "mdastToHtml");
  return {
    name: "ObsidianFlavoredMarkdown",
    textTransform(_ctx, src) {
      if (opts.comments) {
        src = src.replace(commentRegex, "");
      }
      if (opts.callouts) {
        src = src.replace(calloutLineRegex, (value) => {
          return value + "\n> ";
        });
      }
      if (opts.wikilinks) {
        src = src.replace(tableRegex, (value) => {
          return value.replace(tableWikilinkRegex, (_value, raw) => {
            let escaped = raw ?? "";
            escaped = escaped.replace("#", "\\#");
            escaped = escaped.replace(/((^|[^\\])(\\\\)*)\|/g, "$1\\|");
            return escaped;
          });
        });
        src = src.replace(wikilinkRegex, (value, ...capture) => {
          const [rawFp, rawHeader, rawAlias] = capture;
          const [fp, anchor] = splitAnchor(`${rawFp ?? ""}${rawHeader ?? ""}`);
          const blockRef = Boolean(rawHeader?.startsWith("#^")) ? "^" : "";
          const displayAnchor = anchor ? `#${blockRef}${anchor.trim().replace(/^#+/, "")}` : "";
          const displayAlias = rawAlias ?? rawHeader?.replace("#", "|") ?? "";
          const embedDisplay = value.startsWith("!") ? "!" : "";
          if (rawFp?.match(externalLinkRegex)) {
            return `${embedDisplay}[${displayAlias.replace(/^\|/, "")}](${rawFp})`;
          }
          return `${embedDisplay}[[${fp}${displayAnchor}${displayAlias}]]`;
        });
      }
      return src;
    },
    markdownPlugins(ctx) {
      const plugins = [];
      plugins.push(() => {
        return (tree, file) => {
          const replacements = [];
          const base = pathToRoot(file.data.slug);
          if (opts.wikilinks) {
            replacements.push([
              wikilinkRegex,
              (value, ...capture) => {
                let [rawFp, rawHeader, rawAlias] = capture;
                const fp = rawFp?.trim() ?? "";
                const anchor = rawHeader?.trim() ?? "";
                const alias = rawAlias?.slice(1).trim();
                const hasExplicitTarget = fp.length > 0;
                const resolvedSlug = hasExplicitTarget ? resolveWikilinkTarget(fp, ctx.allSlugs) : "";
                if (value.startsWith("!")) {
                  const ext = path3.extname(fp).toLowerCase();
                  const url2 = slugifyFilePath(fp);
                  if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"].includes(ext)) {
                    const match = wikilinkImageEmbedRegex.exec(alias ?? "");
                    const alt = match?.groups?.alt ?? "";
                    const width = match?.groups?.width ?? "auto";
                    const height = match?.groups?.height ?? "auto";
                    return {
                      type: "image",
                      url: url2,
                      data: {
                        hProperties: {
                          width,
                          height,
                          alt
                        }
                      }
                    };
                  } else if ([".mp4", ".webm", ".ogv", ".mov", ".mkv"].includes(ext)) {
                    return {
                      type: "html",
                      value: `<video src="${url2}" controls></video>`
                    };
                  } else if ([".mp3", ".webm", ".wav", ".m4a", ".ogg", ".3gp", ".flac"].includes(ext)) {
                    return {
                      type: "html",
                      value: `<audio src="${url2}" controls></audio>`
                    };
                  } else if ([".pdf"].includes(ext)) {
                    return {
                      type: "html",
                      value: `<iframe src="${url2}" class="pdf"></iframe>`
                    };
                  } else {
                    const block = anchor;
                    return {
                      type: "html",
                      data: { hProperties: { transclude: true } },
                      value: `<blockquote class="transclude" data-url="${url2}" data-block="${block}" data-embed-alias="${alias}"><a href="${url2 + anchor}" class="transclude-inner">Transclude of ${url2}${block}</a></blockquote>`
                    };
                  }
                }
                if (opts.disableBrokenWikilinks && hasExplicitTarget) {
                  const slug = resolveWikilinkTarget(fp, ctx.allSlugs);
                  const exists = ctx.allSlugs && ctx.allSlugs.includes(slug);
                  if (!exists) {
                    return {
                      type: "html",
                      value: `<a class="internal broken">${alias ?? fp}</a>`
                    };
                  }
                }
                const url = `${hasExplicitTarget ? resolvedSlug : ""}${anchor}`;
                return {
                  type: "link",
                  url,
                  children: [
                    {
                      type: "text",
                      value: alias ?? fp
                    }
                  ]
                };
              }
            ]);
          }
          if (opts.highlight) {
            replacements.push([
              highlightRegex,
              (_value, ...capture) => {
                const [inner] = capture;
                return {
                  type: "html",
                  value: `<span class="text-highlight">${inner}</span>`
                };
              }
            ]);
          }
          if (opts.parseArrows) {
            replacements.push([
              arrowRegex,
              (value, ..._capture) => {
                const maybeArrow = arrowMapping[value];
                if (maybeArrow === void 0) return SKIP;
                return {
                  type: "html",
                  value: `<span>${maybeArrow}</span>`
                };
              }
            ]);
          }
          if (opts.parseTags) {
            replacements.push([
              tagRegex,
              (_value, tag) => {
                if (/^[\/\d]+$/.test(tag)) {
                  return false;
                }
                tag = slugTag(tag);
                if (file.data.frontmatter) {
                  const noteTags = file.data.frontmatter.tags ?? [];
                  file.data.frontmatter.tags = [.../* @__PURE__ */ new Set([...noteTags, tag])];
                }
                return {
                  type: "link",
                  url: base + `/tags/${tag}`,
                  data: {
                    hProperties: {
                      className: ["tag-link"]
                    }
                  },
                  children: [
                    {
                      type: "text",
                      value: tag
                    }
                  ]
                };
              }
            ]);
          }
          if (opts.enableInHtmlEmbed) {
            visit3(tree, "html", (node) => {
              for (const [regex, replace] of replacements) {
                if (typeof replace === "string") {
                  node.value = node.value.replace(regex, replace);
                } else {
                  node.value = node.value.replace(regex, (substring, ...args) => {
                    const replaceValue = replace(substring, ...args);
                    if (typeof replaceValue === "string") {
                      return replaceValue;
                    } else if (Array.isArray(replaceValue)) {
                      return replaceValue.map(mdastToHtml).join("");
                    } else if (typeof replaceValue === "object" && replaceValue !== null) {
                      return mdastToHtml(replaceValue);
                    } else {
                      return substring;
                    }
                  });
                }
              }
            });
          }
          mdastFindReplace(tree, replacements);
        };
      });
      if (opts.enableVideoEmbed) {
        plugins.push(() => {
          return (tree, _file) => {
            visit3(tree, "image", (node, index, parent) => {
              if (parent && index != void 0 && videoExtensionRegex.test(node.url)) {
                const newNode = {
                  type: "html",
                  value: `<video controls src="${node.url}"></video>`
                };
                parent.children.splice(index, 1, newNode);
                return SKIP;
              }
            });
          };
        });
      }
      if (opts.callouts) {
        plugins.push(() => {
          return (tree, _file) => {
            visit3(tree, "blockquote", (node) => {
              if (node.children.length === 0) {
                return;
              }
              const [firstChild, ...calloutContent] = node.children;
              if (firstChild.type !== "paragraph" || firstChild.children[0]?.type !== "text") {
                return;
              }
              const text = firstChild.children[0].value;
              const restOfTitle = firstChild.children.slice(1);
              const [firstLine, ...remainingLines] = text.split("\n");
              const remainingText = remainingLines.join("\n");
              const match = firstLine.match(calloutRegex);
              if (match && match.input) {
                const [calloutDirective, typeString, calloutMetaData, collapseChar] = match;
                const calloutType = canonicalizeCallout(typeString.toLowerCase());
                const collapse = collapseChar === "+" || collapseChar === "-";
                const defaultState = collapseChar === "-" ? "collapsed" : "expanded";
                const titleContent = match.input.slice(calloutDirective.length).trim();
                const useDefaultTitle = titleContent === "" && restOfTitle.length === 0;
                const titleNode = {
                  type: "paragraph",
                  children: [
                    {
                      type: "text",
                      value: useDefaultTitle ? capitalize(typeString).replace(/-/g, " ") : titleContent + " "
                    },
                    ...restOfTitle
                  ]
                };
                const title = mdastToHtml(titleNode);
                const toggleIcon = `<div class="fold-callout-icon"></div>`;
                const titleHtml = {
                  type: "html",
                  value: `<div
                  class="callout-title"
                >
                  <div class="callout-icon"></div>
                  <div class="callout-title-inner">${title}</div>
                  ${collapse ? toggleIcon : ""}
                </div>`
                };
                const blockquoteContent = [titleHtml];
                if (remainingText.length > 0) {
                  blockquoteContent.push({
                    type: "paragraph",
                    children: [
                      {
                        type: "text",
                        value: remainingText
                      }
                    ]
                  });
                }
                if (calloutContent.length > 0) {
                  node.children = [
                    node.children[0],
                    {
                      data: { hProperties: { className: ["callout-content"] }, hName: "div" },
                      type: "blockquote",
                      children: [...calloutContent]
                    }
                  ];
                }
                node.children.splice(0, 1, ...blockquoteContent);
                const classNames2 = ["callout", calloutType];
                if (collapse) {
                  classNames2.push("is-collapsible");
                }
                if (defaultState === "collapsed") {
                  classNames2.push("is-collapsed");
                }
                node.data = {
                  hProperties: {
                    ...node.data?.hProperties ?? {},
                    className: classNames2.join(" "),
                    "data-callout": calloutType,
                    "data-callout-fold": collapse,
                    "data-callout-metadata": calloutMetaData
                  }
                };
              }
            });
          };
        });
      }
      if (opts.mermaid) {
        plugins.push(() => {
          return (tree, file) => {
            visit3(tree, "code", (node) => {
              if (node.lang === "mermaid") {
                file.data.hasMermaidDiagram = true;
                node.data = {
                  hProperties: {
                    className: ["mermaid"],
                    "data-clipboard": JSON.stringify(node.value)
                  }
                };
              }
            });
          };
        });
      }
      return plugins;
    },
    htmlPlugins() {
      const plugins = [rehypeRaw];
      if (opts.parseBlockReferences) {
        plugins.push(() => {
          const inlineTagTypes = /* @__PURE__ */ new Set(["p", "li"]);
          const blockTagTypes = /* @__PURE__ */ new Set(["blockquote"]);
          return (tree, file) => {
            file.data.blocks = {};
            visit3(tree, "element", (node, index, parent) => {
              if (blockTagTypes.has(node.tagName)) {
                const nextChild = parent?.children.at(index + 2);
                if (nextChild && nextChild.tagName === "p") {
                  const text = nextChild.children.at(0);
                  if (text && text.value && text.type === "text") {
                    const matches = text.value.match(blockReferenceRegex);
                    if (matches && matches.length >= 1) {
                      parent.children.splice(index + 2, 1);
                      const block = matches[0].slice(1);
                      if (!Object.keys(file.data.blocks).includes(block)) {
                        node.properties = {
                          ...node.properties,
                          id: block
                        };
                        file.data.blocks[block] = node;
                      }
                    }
                  }
                }
              } else if (inlineTagTypes.has(node.tagName)) {
                const last = node.children.at(-1);
                if (last && last.value && typeof last.value === "string") {
                  const matches = last.value.match(blockReferenceRegex);
                  if (matches && matches.length >= 1) {
                    last.value = last.value.slice(0, -matches[0].length);
                    const block = matches[0].slice(1);
                    if (last.value === "") {
                      let idx = (index ?? 1) - 1;
                      while (idx >= 0) {
                        const element = parent?.children.at(idx);
                        if (!element) break;
                        if (element.type !== "element") {
                          idx -= 1;
                        } else {
                          if (!Object.keys(file.data.blocks).includes(block)) {
                            element.properties = {
                              ...element.properties,
                              id: block
                            };
                            file.data.blocks[block] = element;
                          }
                          return;
                        }
                      }
                    } else {
                      if (!Object.keys(file.data.blocks).includes(block)) {
                        node.properties = {
                          ...node.properties,
                          id: block
                        };
                        file.data.blocks[block] = node;
                      }
                    }
                  }
                }
              }
            });
            file.data.htmlAst = tree;
          };
        });
      }
      if (opts.enableYouTubeEmbed) {
        plugins.push(() => {
          return (tree) => {
            visit3(tree, "element", (node) => {
              if (node.tagName === "img" && typeof node.properties.src === "string") {
                const match = node.properties.src.match(ytLinkRegex);
                const videoId = match && match[2].length == 11 ? match[2] : null;
                const playlistId = node.properties.src.match(ytPlaylistLinkRegex)?.[1];
                if (videoId) {
                  node.tagName = "iframe";
                  node.properties = {
                    ...node.properties,
                    src: playlistId ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}` : `https://www.youtube.com/embed/${videoId}`,
                    width: node.properties.width ?? "600px",
                    frameborder: node.properties.frameborder ?? 0
                  };
                  ensureEmbedAttributes(node, "youtube");
                } else if (playlistId) {
                  node.tagName = "iframe";
                  node.properties = {
                    ...node.properties,
                    src: `https://www.youtube.com/embed/videoseries?list=${playlistId}`,
                    width: node.properties.width ?? "600px",
                    frameborder: node.properties.frameborder ?? 0
                  };
                  ensureEmbedAttributes(node, "youtube");
                }
              }
            });
          };
        });
      }
      plugins.push(() => {
        return (tree) => {
          visit3(tree, "element", (node) => {
            if (node.tagName !== "iframe") {
              return;
            }
            const src = typeof node.properties?.src === "string" ? node.properties.src : null;
            if (!src) {
              return;
            }
            if (YOUTUBE_EMBED_SRC_REGEX.test(src)) {
              ensureEmbedAttributes(node, "youtube");
            } else if (DRIVE_PREVIEW_SRC_REGEX.test(src)) {
              ensureEmbedAttributes(node, "drive");
            }
          });
        };
      });
      if (opts.enableCheckbox) {
        plugins.push(() => {
          return (tree, _file) => {
            visit3(tree, "element", (node) => {
              if (node.tagName === "input" && node.properties.type === "checkbox") {
                const isChecked = node.properties?.checked ?? false;
                node.properties = {
                  type: "checkbox",
                  disabled: false,
                  checked: isChecked,
                  class: "checkbox-toggle"
                };
              }
            });
          };
        });
      }
      if (opts.mermaid) {
        plugins.push(() => {
          return (tree, _file) => {
            visit3(tree, "element", (node, _idx, parent) => {
              if (node.tagName === "code" && (node.properties?.className ?? [])?.includes("mermaid")) {
                parent.children = [
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      className: ["expand-button"],
                      "aria-label": "Expand mermaid diagram",
                      "data-view-component": true
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "svg",
                        properties: {
                          width: 16,
                          height: 16,
                          viewBox: "0 0 16 16",
                          fill: "currentColor"
                        },
                        children: [
                          {
                            type: "element",
                            tagName: "path",
                            properties: {
                              fillRule: "evenodd",
                              d: "M3.72 3.72a.75.75 0 011.06 1.06L2.56 7h10.88l-2.22-2.22a.75.75 0 011.06-1.06l3.5 3.5a.75.75 0 010 1.06l-3.5 3.5a.75.75 0 11-1.06-1.06l2.22-2.22H2.56l2.22 2.22a.75.75 0 11-1.06 1.06l-3.5-3.5a.75.75 0 010-1.06l3.5-3.5z"
                            },
                            children: []
                          }
                        ]
                      }
                    ]
                  },
                  node,
                  {
                    type: "element",
                    tagName: "div",
                    properties: { id: "mermaid-container", role: "dialog" },
                    children: [
                      {
                        type: "element",
                        tagName: "div",
                        properties: { id: "mermaid-space" },
                        children: [
                          {
                            type: "element",
                            tagName: "div",
                            properties: { className: ["mermaid-content"] },
                            children: []
                          }
                        ]
                      }
                    ]
                  }
                ];
              }
            });
          };
        });
      }
      return plugins;
    },
    externalResources() {
      const js = [];
      const css = [];
      if (opts.enableCheckbox) {
        js.push({
          script: checkbox_inline_default,
          loadTime: "afterDOMReady",
          contentType: "inline"
        });
      }
      if (opts.callouts) {
        js.push({
          script: callout_inline_default,
          loadTime: "afterDOMReady",
          contentType: "inline"
        });
      }
      if (opts.mermaid) {
        js.push({
          script: mermaid_inline_default,
          loadTime: "afterDOMReady",
          contentType: "inline",
          moduleType: "module"
        });
        css.push({
          content: mermaid_inline_default2,
          inline: true
        });
      }
      return { js, css };
    }
  };
}, "ObsidianFlavoredMarkdown");

// quartz/plugins/transformers/oxhugofm.ts
import rehypeRaw2 from "rehype-raw";
var relrefRegex = new RegExp(/\[([^\]]+)\]\(\{\{< relref "([^"]+)" >\}\}\)/, "g");
var predefinedHeadingIdRegex = new RegExp(/(.*) {#(?:.*)}/, "g");
var hugoShortcodeRegex = new RegExp(/{{(.*)}}/, "g");
var figureTagRegex = new RegExp(/< ?figure src="(.*)" ?>/, "g");
var inlineLatexRegex = new RegExp(/\\\\\((.+?)\\\\\)/, "g");
var blockLatexRegex = new RegExp(
  /(?:\\begin{equation}|\\\\\(|\\\\\[)([\s\S]*?)(?:\\\\\]|\\\\\)|\\end{equation})/,
  "g"
);
var quartzLatexRegex = new RegExp(/\$\$[\s\S]*?\$\$|\$.*?\$/, "g");

// quartz/plugins/transformers/syntax.ts
import rehypePrettyCode from "rehype-pretty-code";
var defaultOptions7 = {
  theme: {
    light: "github-light",
    dark: "github-dark"
  },
  keepBackground: false
};
var SyntaxHighlighting = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions7, ...userOpts };
  return {
    name: "SyntaxHighlighting",
    htmlPlugins() {
      return [[rehypePrettyCode, opts]];
    }
  };
}, "SyntaxHighlighting");

// quartz/plugins/transformers/toc.ts
import { visit as visit4 } from "unist-util-visit";
import { toString as toString2 } from "mdast-util-to-string";
import Slugger from "github-slugger";
var defaultOptions8 = {
  maxDepth: 3,
  minEntries: 1,
  showByDefault: true,
  collapseByDefault: false
};
var slugAnchor2 = new Slugger();
var TableOfContents = /* @__PURE__ */ __name((userOpts) => {
  const opts = { ...defaultOptions8, ...userOpts };
  return {
    name: "TableOfContents",
    markdownPlugins() {
      return [
        () => {
          return async (tree, file) => {
            const display = file.data.frontmatter?.enableToc ?? opts.showByDefault;
            if (display) {
              slugAnchor2.reset();
              const toc = [];
              let highestDepth = opts.maxDepth;
              visit4(tree, "heading", (node) => {
                if (node.depth <= opts.maxDepth) {
                  const text = toString2(node);
                  highestDepth = Math.min(highestDepth, node.depth);
                  toc.push({
                    depth: node.depth,
                    text,
                    slug: slugAnchor2.slug(text)
                  });
                }
              });
              if (toc.length > 0 && toc.length > opts.minEntries) {
                file.data.toc = toc.map((entry) => ({
                  ...entry,
                  depth: entry.depth - highestDepth
                }));
                file.data.collapseToc = opts.collapseByDefault;
              }
            }
          };
        }
      ];
    }
  };
}, "TableOfContents");

// quartz/plugins/transformers/linebreaks.ts
import remarkBreaks from "remark-breaks";
var HardLineBreaks = /* @__PURE__ */ __name(() => {
  return {
    name: "HardLineBreaks",
    markdownPlugins() {
      return [remarkBreaks];
    }
  };
}, "HardLineBreaks");

// quartz/plugins/transformers/roam.ts
import { visit as visit5 } from "unist-util-visit";
import { findAndReplace as mdastFindReplace2 } from "mdast-util-find-and-replace";
var orRegex = new RegExp(/{{or:(.*?)}}/, "g");
var TODORegex = new RegExp(/{{.*?\bTODO\b.*?}}/, "g");
var DONERegex = new RegExp(/{{.*?\bDONE\b.*?}}/, "g");
var blockquoteRegex = new RegExp(/(\[\[>\]\])\s*(.*)/, "g");
var roamHighlightRegex = new RegExp(/\^\^(.+)\^\^/, "g");
var roamItalicRegex = new RegExp(/__(.+)__/, "g");

// quartz/util/assetVersion.ts
var cachedVersion = null;
function getAssetVersion() {
  if (cachedVersion) {
    return cachedVersion;
  }
  const envVersion = process.env.QUARTZ_ASSET_VERSION;
  if (envVersion && envVersion.trim().length > 0) {
    cachedVersion = envVersion.trim();
    return cachedVersion;
  }
  cachedVersion = Date.now().toString();
  return cachedVersion;
}
__name(getAssetVersion, "getAssetVersion");

// quartz/util/assetLookup.ts
import path4 from "node:path";
import { globbySync } from "globby";
var CONTENT_ROOT = path4.resolve(process.cwd(), "../Content");
var assetLookupCache = /* @__PURE__ */ new Map();
var slugLookupCache = /* @__PURE__ */ new Map();
var slugLookupInitialised = false;
var escapeForGlob = /* @__PURE__ */ __name((value) => value.replace(/([*?\[\]{}()!+@\\])/g, "\\$1"), "escapeForGlob");
var expandBasenameCandidates = /* @__PURE__ */ __name((basename2) => {
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  const addCandidate = /* @__PURE__ */ __name((value) => {
    if (!value) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(trimmed);
  }, "addCandidate");
  addCandidate(basename2);
  try {
    addCandidate(decodeURIComponent(basename2));
  } catch {
  }
  const hyphenAsSpace = basename2.replace(/-/g, " ");
  addCandidate(hyphenAsSpace);
  try {
    addCandidate(decodeURIComponent(hyphenAsSpace));
  } catch {
  }
  const underscoreAsSpace = basename2.replace(/_/g, " ");
  addCandidate(underscoreAsSpace);
  try {
    addCandidate(decodeURIComponent(underscoreAsSpace));
  } catch {
  }
  const spacesAsHyphen = basename2.replace(/\s+/g, "-");
  addCandidate(spacesAsHyphen);
  return candidates;
}, "expandBasenameCandidates");
var ensureSlugLookup = /* @__PURE__ */ __name(() => {
  if (slugLookupInitialised) {
    return;
  }
  const matches = globbySync("**/*", {
    cwd: CONTENT_ROOT,
    caseSensitiveMatch: false,
    onlyFiles: true
  });
  matches.forEach((match) => {
    const normalised = match.replace(/\\/g, "/");
    const base = path4.basename(normalised);
    const slugKey = slugifyFilePath(base).toLowerCase();
    if (!slugLookupCache.has(slugKey)) {
      slugLookupCache.set(slugKey, normalised);
    }
  });
  slugLookupInitialised = true;
}, "ensureSlugLookup");
var findAssetByBasename = /* @__PURE__ */ __name((basename2) => {
  const key = basename2.toLowerCase();
  if (assetLookupCache.has(key)) {
    const cached = assetLookupCache.get(key);
    return cached === null ? void 0 : cached;
  }
  const candidates = expandBasenameCandidates(basename2);
  for (const candidate of candidates) {
    const pattern = `**/${escapeForGlob(candidate)}`;
    const matches = globbySync(pattern, {
      cwd: CONTENT_ROOT,
      caseSensitiveMatch: false,
      onlyFiles: true
    });
    if (matches.length > 0) {
      matches.sort((a, b) => a.length - b.length || a.localeCompare(b));
      const resolved = matches[0].replace(/\\/g, "/");
      assetLookupCache.set(key, resolved);
      const slugKey2 = slugifyFilePath(path4.basename(resolved)).toLowerCase();
      if (!slugLookupCache.has(slugKey2)) {
        slugLookupCache.set(slugKey2, resolved);
      }
      return resolved;
    }
  }
  ensureSlugLookup();
  const slugKey = slugifyFilePath(basename2).toLowerCase();
  if (slugLookupCache.has(slugKey)) {
    const mapped = slugLookupCache.get(slugKey);
    if (mapped) {
      assetLookupCache.set(key, mapped);
      return mapped;
    }
    assetLookupCache.set(key, null);
    return void 0;
  }
  assetLookupCache.set(key, null);
  slugLookupCache.set(slugKey, null);
  return void 0;
}, "findAssetByBasename");

// quartz/components/scripts/discordCollapse.inline.ts
var discordCollapse_inline_default = "";

// quartz/components/scripts/discordMessageJump.inline.ts
var discordMessageJump_inline_default = "";

// quartz/plugins/transformers/discordMessages.ts
var FALLBACK_AVATAR = "/static/discord_default_pfp.png";
var DEFAULT_AVATAR = FALLBACK_AVATAR;
var DISCORD_CITE_ICON_PATH = "M20.992 20.163c-1.511-0.099-2.699-1.349-2.699-2.877 0-0.051 0.001-0.102 0.004-0.153l-0 0.007c-0.003-0.048-0.005-0.104-0.005-0.161 0-1.525 1.19-2.771 2.692-2.862l0.008-0c1.509 0.082 2.701 1.325 2.701 2.847 0 0.062-0.002 0.123-0.006 0.184l0-0.008c0.003 0.050 0.005 0.109 0.005 0.168 0 1.523-1.191 2.768-2.693 2.854l-0.008 0zM11.026 20.163c-1.511-0.099-2.699-1.349-2.699-2.877 0-0.051 0.001-0.102 0.004-0.153l-0 0.007c-0.003-0.048-0.005-0.104-0.005-0.161 0-1.525 1.19-2.771 2.692-2.862l0.008-0c1.509 0.082 2.701 1.325 2.701 2.847 0 0.062-0.002 0.123-0.006 0.184l0-0.008c0.003 0.048 0.005 0.104 0.005 0.161 0 1.525-1.19 2.771-2.692 2.862l-0.008 0zM26.393 6.465c-1.763-0.832-3.811-1.49-5.955-1.871l-0.149-0.022c-0.005-0.001-0.011-0.002-0.017-0.002-0.035 0-0.065 0.019-0.081 0.047l-0 0c-0.234 0.411-0.488 0.924-0.717 1.45l-0.043 0.111c-1.030-0.165-2.218-0.259-3.428-0.259s-2.398 0.094-3.557 0.275l0.129-0.017c-0.27-0.63-0.528-1.142-0.813-1.638l0.041 0.077c-0.017-0.029-0.048-0.047-0.083-0.047-0.005 0-0.011 0-0.016 0.001l0.001-0c-2.293 0.403-4.342 1.060-6.256 1.957l0.151-0.064c-0.017 0.007-0.031 0.019-0.040 0.034l-0 0c-2.854 4.041-4.562 9.069-4.562 14.496 0 0.907 0.048 1.802 0.141 2.684l-0.009-0.11c0.003 0.029 0.018 0.053 0.039 0.070l0 0c2.14 1.601 4.628 2.891 7.313 3.738l0.176 0.048c0.008 0.003 0.018 0.004 0.028 0.004 0.032 0 0.060-0.015 0.077-0.038l0-0c0.535-0.72 1.044-1.536 1.485-2.392l0.047-0.1c0.006-0.012 0.010-0.027 0.010-0.043 0-0.041-0.026-0.075-0.062-0.089l-0.001-0c-0.912-0.352-1.683-0.727-2.417-1.157l0.077 0.042c-0.029-0.017-0.048-0.048-0.048-0.083 0-0.031 0.015-0.059 0.038-0.076l0-0c0.157-0.118 0.315-0.24 0.465-0.364 0.016-0.013 0.037-0.021 0.059-0.021 0.014 0 0.027 0.003 0.038 0.008l-0.001-0c2.208 1.061 4.8 1.681 7.536 1.681s5.329-0.62 7.643-1.727l-0.107 0.046c0.012-0.006 0.025-0.009 0.040-0.009 0.022 0 0.043 0.008 0.059 0.021l-0-0c0.15 0.124 0.307 0.248 0.466 0.365 0.023 0.018 0.038 0.046 0.038 0.077 0 0.035-0.019 0.065-0.046 0.082l-0 0c-0.661 0.395-1.432 0.769-2.235 1.078l-0.105 0.036c-0.036 0.014-0.062 0.049-0.062 0.089 0 0.016 0.004 0.031 0.011 0.044l-0-0.001c0.501 0.96 1.009 1.775 1.571 2.548l-0.040-0.057c0.017 0.024 0.046 0.040 0.077 0.040 0.010 0 0.020-0.002 0.029-0.004l-0.001 0c2.865-0.892 5.358-2.182 7.566-3.832l-0.065 0.047c0.022-0.016 0.036-0.041 0.039-0.069l0-0c0.087-0.784 0.136-1.694 0.136-2.615 0-5.415-1.712-10.43-4.623-14.534l0.052 0.078c-0.008-0.016-0.022-0.029-0.038-0.036l-0-0z";
var SHARE_ICON_MASK_URL = "/static/icons/share_icon.svg";
var AUDIO_ICON_URL = "/static/icons/audio-icon.svg";
var VIDEO_ICON_URL = "/static/icons/video-icon.svg";
var FILE_ICON_URL = "/static/icons/file-icon.svg";
var discordThreadSequence = 0;
var DISCORD_CSS = `
.discord-thread {
  --discord-bg: #2b2d31;
  --discord-border: #1f2024;
  --discord-hover: rgba(78, 80, 88, 0.6);
  --discord-text-primary: #f2f3f5;
  --discord-text-muted: #b5bac1;
  --discord-author: #f2f3f5;
  --discord-accent: #5865f2;
  background: var(--discord-bg);
  border: 1px solid var(--discord-border);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: min(720px, 100%);
  font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  position: relative;
}

.discord-thread-wrapper {
  position: relative;
  max-width: min(720px, 100%);
  display: block;
}

.discord-thread-content {
  position: relative;
  overflow: hidden;
  display: block;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.discord-thread-content.collapsed {
  max-height: 420px;
}

.discord-thread-fade {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 120px;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    to bottom,
    rgba(43, 45, 49, 0) 0%,
    rgba(43, 45, 49, 0.72) 52%,
    color-mix(in srgb, rgba(43, 45, 49, 0.9) 30%, var(--color-primary-background) 70%) 78%,
    var(--color-primary-background) 100%
  );
  transition: opacity 0.28s ease;
  z-index: 2;
}

.discord-thread-wrapper.collapsed .discord-thread-fade,
.discord-thread-content.collapsed .discord-thread-fade {
  opacity: 1;
}

.discord-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  margin: 0 auto;
  margin-top: -3rem;
  background: var(--color-surface-overlay);
  border: 1px solid var(--color-accent-deep);
  border-radius: 8px;
  color: var(--color-tone-contrast);
  font-family: var(--bodyFont);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  z-index: 3;
  width: fit-content;
  min-width: 140px;
}

.discord-thread-content:not(.collapsed) + .discord-collapse-toggle {
  margin-top: 0.75rem;
}

.discord-collapse-toggle:hover {
  background: var(--color-highlight-overlay);
  border-color: var(--color-accent-bright);
  color: var(--color-tone-contrast);
}

.discord-collapse-toggle:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.discord-collapse-icon {
  width: 16px;
  height: 16px;
  transform-origin: 50% 50%;
  transition: transform 0.3s ease;
}

.discord-collapse-toggle[aria-expanded="false"] .discord-collapse-icon {
  transform: rotate(0deg);
}

.discord-collapse-toggle[aria-expanded="true"] .discord-collapse-icon,
.discord-collapse-toggle.is-expanded .discord-collapse-icon {
  transform: rotate(180deg);
}

.discord-message {
  position: relative;
  border-radius: 8px;
  padding: 6px 8px 4px;
  color: var(--discord-text-primary);
  --discord-author-color: var(--discord-author);
  scroll-margin-top: 120px;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  text-decoration: none;
  align-items: flex-start;
  width: 100%;
  font: inherit;
  user-select: text;
  cursor: default;
  transition: background 0.18s ease;
}

.discord-message * {
  font-weight: inherit;
}

.discord-message[data-discord-jump] {
  cursor: pointer;
}

.discord-message[data-discord-jump]:focus-visible {
  outline: 2px solid var(--discord-accent);
  outline-offset: 2px;
}

.discord-message + .discord-message {
  margin-top: 2px;
}

.discord-message:hover {
  background: var(--discord-hover);
}

.discord-message--compact {
  padding-top: 2px;
}

.discord-avatar {
  width: 40px;
  min-width: 40px;
  height: 40px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  background: #1f2125;
  border: 1px solid rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
}

.discord-avatar-spacer {
  width: 40px;
  min-width: 40px;
  height: 10px;
  display: block;
  margin-top: 6px;
}

.discord-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}


.discord-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.discord-message--compact .discord-body {
  gap: 0.18rem;
}

.discord-header {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  column-gap: 0.5rem;
  row-gap: 0.15rem;
  line-height: 1.25;
  margin-bottom: 2px;
  min-width: 0;
}

.discord-author {
  font-weight: 600;
  color: var(--discord-author-color, var(--discord-author));
}

.discord-header time {
  font-size: 0.8125rem;
  color: var(--discord-text-muted);
  flex-shrink: 0;
  white-space: nowrap;
}

.discord-content {
  font-size: 0.95rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.discord-content--compact {
  margin-top: 2px;
}

.discord-attachments {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.discord-attachment {
  display: block;
  max-width: min(420px, 100%);
  border-radius: 10px;
  overflow: hidden;
  background: #1f2126;
  border: 1px solid rgba(0, 0, 0, 0.35);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.36);
}

.discord-attachment__card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.1rem;
  background: rgba(0, 0, 0, 0.22);
  color: var(--discord-text-primary);
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.18s ease, border-color 0.18s ease;
}

.discord-attachment__card:hover,
.discord-attachment__card:focus-visible {
  background: rgba(88, 101, 242, 0.16);
  border-color: rgba(88, 101, 242, 0.32);
  text-decoration: none;
  outline: none;
}

.discord-attachment__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(88, 101, 242, 0.2);
  color: #c7ccff;
  flex-shrink: 0;
}

.discord-attachment__icon img,
.discord-attachment__icon svg {
  width: 20px;
  height: 20px;
}

.discord-attachment__icon img {
  object-fit: contain;
  display: block;
}

.discord-attachment__card--audio .discord-attachment__icon img {
  filter: brightness(0) saturate(100%);
}

.discord-attachment__card--video .discord-attachment__icon {
  background: rgba(89, 54, 255, 0.24);
  color: #d7cbff;
}

.discord-attachment__card--file .discord-attachment__icon {
  background: rgba(79, 84, 92, 0.35);
  color: #d6dae3;
}

.discord-attachment__info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.discord-attachment__name {
  font-weight: 600;
  color: var(--discord-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discord-attachment__subtitle {
  font-size: 0.8rem;
  color: var(--discord-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discord-attachment__image-link {
  display: block;
  color: inherit;
}

.discord-attachment__image-link:hover,
.discord-attachment__image-link:focus-visible {
  opacity: 0.94;
  outline: none;
}

.discord-attachment img {
  display: block;
  width: 100%;
  height: auto;
}

.discord-attachment audio,
.discord-attachment video {
  display: block;
  width: 100%;
  max-width: 100%;
  outline: none;
}

.discord-attachment iframe {
  display: block;
  width: 100%;
  max-width: 100%;
  border: none;
  background: #000;
}

.discord-attachment video {
  max-height: 360px;
  background: #000;
}

.discord-attachment__control {
  margin: 0.65rem 1rem 1rem;
  border-radius: 10px;
  border: none;
  background: rgba(15, 17, 22, 0.85);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.discord-attachment__frame {
  margin: 0.65rem 1rem 1rem;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  background: rgba(15, 17, 22, 0.85);
  aspect-ratio: 16 / 9;
  min-height: 220px;
}

.discord-attachment__control::-webkit-media-controls-panel {
  background-color: rgba(32, 34, 37, 0.95);
}

.discord-attachment__control::-webkit-media-controls-enclosure {
  border-radius: 10px;
  background-color: transparent;
}

.discord-attachment--file {
  padding: 0;
}

.discord-attachment--file a {
  color: inherit;
}

.discord-message .external-icon {
  display: none !important;
}

.discord-thread-wrapper {
  position: relative;
  max-width: min(720px, 100%);
  scroll-margin-top: 120px;
}

.discord-thread-share-container.article-share {
  position: absolute;
  top: 12px;
  right: 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  width: max-content;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(0, -6px, 0);
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 4;
}

.discord-thread-share-container.article-share .article-share__feedback {
  text-align: right;
  min-height: 0.85rem;
}

.discord-thread-share.article-share__button {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #d6dae3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, color 0.18s ease;
}

.discord-thread-share__icon {
  width: 18px;
  height: 18px;
  display: block;
  background-color: currentColor;
  mask-image: url(${SHARE_ICON_MASK_URL});
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: url(${SHARE_ICON_MASK_URL});
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}


.discord-thread-wrapper:hover .discord-thread-share-container,
.discord-thread-wrapper:focus-within .discord-thread-share-container,
.discord-thread-wrapper:target .discord-thread-share-container,
.discord-thread-share-container:focus-within {
  pointer-events: auto;
  transform: translate3d(0, 0, 0);
  opacity: 1;
}

.discord-thread-share.article-share__button:hover {
  color: var(--color-accent-deep);
}

.discord-thread-share.article-share__button:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.discord-thread-wrapper:target,
.discord-thread-wrapper:has(.discord-message:target) {
  isolation: isolate;
  z-index: 6;
}

.discord-thread-wrapper:target .discord-thread-content,
.discord-thread-wrapper:has(.discord-message:target) .discord-thread-content {
  overflow: visible;
}

.discord-thread-wrapper:target .discord-thread-fade,
.discord-thread-wrapper:has(.discord-message:target) .discord-thread-fade {
  opacity: 0;
}

.discord-thread-wrapper:target .discord-thread,
.discord-message:target {
  position: relative;
  z-index: 2;
}

.discord-message:target {
  isolation: isolate;
}

@media (hover: none) {
  .discord-thread-share-container {
    opacity: 1;
    pointer-events: auto;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes discord-target-glow {
  0% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0.65), 0 0 0 rgba(235, 28, 36, 0.1);
  }
  35% {
    box-shadow: 0 0 0 6px rgba(235, 28, 36, 0.25), 0 0 30px rgba(235, 28, 36, 0.45);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0);
  }
}

.discord-message:target,
.discord-thread-wrapper:target .discord-thread {
  animation: discord-target-glow 1.6s ease-out;
  box-shadow: 0 0 0 2px rgba(235, 28, 36, 0.45), 0 0 24px rgba(235, 28, 36, 0.35);
}

.discord-timestamp-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.discord-cite {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: baseline;
}

.discord-cite__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background 120ms ease;
  color: var(--discord-cite-icon, #b71002);
  position: relative;
  top: -0.3em;
}

.discord-cite__trigger svg {
  width: 14px;
  height: 14px;
  display: block;
  fill: currentColor;
  pointer-events: none;
}

.discord-cite__trigger:hover {
  background: rgba(88, 101, 242, 0.2);
  color: var(--discord-cite-icon-hover, #eb1c24);
}

.discord-cite__trigger:focus-visible {
  outline: 2px solid var(--discord-accent);
  outline-offset: 2px;
}

.discord-cite__preview {
  position: absolute;
  z-index: 50;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  display: none;
  max-width: min(480px, 85vw);
}

.discord-cite__preview::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-bottom-color: var(--discord-border);
}

.discord-cite:hover .discord-cite__preview,
.discord-cite:focus-within .discord-cite__preview {
  display: block;
}

.discord-cite__preview-content {
  position: relative;
  z-index: 1;
  box-shadow: 0 24px 48px rgba(15, 15, 20, 0.45);
  border-radius: 12px;
  overflow: hidden;
}

.discord-cite__preview .discord-thread {
  max-width: min(520px, 85vw);
  min-width: min(420px, 75vw);
}

.discord-cite__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.callout.discord-cite {
  display: none !important;
}
`;
var isExternalUrl = /* @__PURE__ */ __name((url) => /^(https?:)?\/\//i.test(url), "isExternalUrl");
var OBSIDIAN_EMBED_PATTERN = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/;
var stripContentPrefix = /* @__PURE__ */ __name((target) => target.replace(/^[./]+/, "").replace(/^content\//i, ""), "stripContentPrefix");
var appendAssetVersion = /* @__PURE__ */ __name((url, version) => {
  if (!version) {
    return url;
  }
  return url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
}, "appendAssetVersion");
var extractMessageIdentifier = /* @__PURE__ */ __name((message) => {
  const direct = message.id?.trim();
  if (direct) {
    return direct;
  }
  const jump = message.jump_url ?? message.url;
  if (jump) {
    const parts = jump.trim().split("/");
    const candidate = parts.pop() ?? "";
    if (candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return void 0;
}, "extractMessageIdentifier");
var normaliseFragment = /* @__PURE__ */ __name((raw) => raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "").replace(/-+$/, ""), "normaliseFragment");
var buildMessageAnchorId = /* @__PURE__ */ __name((message, context) => {
  const fallback = context ? `${context.threadId}-message-${context.index + 1}` : void 0;
  const source = extractMessageIdentifier(message) ?? fallback;
  if (!source) {
    return void 0;
  }
  const fragment = normaliseFragment(source);
  if (!fragment) {
    return void 0;
  }
  return fragment.startsWith("discord-message") ? fragment : `discord-message-${fragment}`;
}, "buildMessageAnchorId");
var createShareSnippet = /* @__PURE__ */ __name((raw) => {
  if (!raw) {
    return void 0;
  }
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return void 0;
  }
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}\u2026` : cleaned;
}, "createShareSnippet");
var toOptionalFragment = /* @__PURE__ */ __name((raw) => {
  if (!raw) {
    return void 0;
  }
  const fragment = normaliseFragment(raw);
  return fragment.length > 0 ? fragment : void 0;
}, "toOptionalFragment");
var buildThreadAnchorMetadata = /* @__PURE__ */ __name((messages, slug) => {
  const primary = messages.find((message) => Boolean(message));
  const snippet = primary ? createShareSnippet(primary.content) : void 0;
  const candidates = primary ? [
    extractMessageIdentifier(primary),
    primary.timestamp,
    primary.author?.id,
    primary.author?.display_name,
    primary.author?.username,
    snippet
  ] : [];
  const slugFragment = toOptionalFragment(slug);
  let anchorBase = candidates.map(toOptionalFragment).find((fragment) => fragment);
  if (anchorBase) {
    if (!anchorBase.startsWith("discord-thread")) {
      anchorBase = `discord-thread-${anchorBase}`;
    }
  } else {
    anchorBase = slugFragment ? `${slugFragment}-discord-thread` : "discord-thread";
  }
  if (slugFragment && !anchorBase.startsWith(`${slugFragment}-`)) {
    anchorBase = `${slugFragment}-${anchorBase}`;
  }
  const sequence = (discordThreadSequence++).toString(36);
  return {
    anchorId: `${anchorBase}-${sequence}`,
    snippet
  };
}, "buildThreadAnchorMetadata");
var resolveObsidianTarget = /* @__PURE__ */ __name((rawTarget, slug, options2 = {}) => {
  const { appendVersion: shouldAppendVersion = true } = options2;
  if (isExternalUrl(rawTarget)) {
    return rawTarget;
  }
  let targetPath = stripContentPrefix(rawTarget);
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath);
    if (matched) {
      targetPath = matched;
    }
  }
  const targetSlug = slugifyFilePath(targetPath);
  if (!slug) {
    return shouldAppendVersion ? appendAssetVersion(targetSlug, getAssetVersion()) : targetSlug;
  }
  const baseDir = pathToRoot(slug);
  const resolved = joinSegments(baseDir, targetSlug);
  return shouldAppendVersion ? appendAssetVersion(resolved, getAssetVersion()) : resolved;
}, "resolveObsidianTarget");
var resolveAttachmentSource = /* @__PURE__ */ __name((raw, slug, options2 = {}) => {
  const { appendVersion: shouldAppendVersion = true } = options2;
  const cleaned = raw.trim();
  if (!cleaned) {
    return void 0;
  }
  if (isExternalUrl(cleaned) || !slug) {
    return cleaned;
  }
  const embedMatch = cleaned.match(OBSIDIAN_EMBED_PATTERN);
  if (embedMatch?.groups?.target) {
    return resolveObsidianTarget(embedMatch.groups.target, slug, { appendVersion: shouldAppendVersion });
  }
  let targetPath = stripContentPrefix(cleaned);
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath);
    if (matched) {
      targetPath = matched;
    }
  }
  const targetSlug = slugifyFilePath(targetPath);
  if (!slug) {
    return shouldAppendVersion ? appendAssetVersion(targetSlug, getAssetVersion()) : targetSlug;
  }
  const baseDir = pathToRoot(slug);
  const resolved = joinSegments(baseDir, targetSlug);
  return shouldAppendVersion ? appendAssetVersion(resolved, getAssetVersion()) : resolved;
}, "resolveAttachmentSource");
var CITATION_MARKER_PATTERN = /(?:\{\{discord-cite:([a-z0-9-]+)\}\}|<!--\s*discord-cite:([a-z0-9-]+)\s*-->)/gi;
var escapeHtml = /* @__PURE__ */ __name((value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"), "escapeHtml");
var escapeAttribute = /* @__PURE__ */ __name((value) => escapeHtml(value), "escapeAttribute");
var formatTimestamp = /* @__PURE__ */ __name((source) => {
  if (!source) {
    return void 0;
  }
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return {
      readable: source,
      iso: source
    };
  }
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return {
    readable: `${day}/${month}/${year} ${hours}:${minutes}`,
    iso: date.toISOString()
  };
}, "formatTimestamp");
var normaliseMessages = /* @__PURE__ */ __name((raw) => {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => normaliseMessages(entry));
  }
  if (typeof raw === "object") {
    const maybeMessages = raw.messages;
    if (Array.isArray(maybeMessages)) {
      return normaliseMessages(maybeMessages);
    }
    return [raw];
  }
  return [];
}, "normaliseMessages");
var renderContent = /* @__PURE__ */ __name((content) => {
  if (!content) {
    return "";
  }
  const safe = escapeHtml(content);
  return safe.replace(/\r?\n/g, "<br />");
}, "renderContent");
var normalizeColor = /* @__PURE__ */ __name((input) => {
  if (input === null || input === void 0) {
    return void 0;
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    const hex = input.toString(16).padStart(6, "0").slice(-6);
    return `#${hex}`;
  }
  const value = input.toString().trim();
  if (/^\d+$/.test(value)) {
    const numeric = Number.parseInt(value, 10);
    if (Number.isFinite(numeric)) {
      const hex = numeric.toString(16).padStart(6, "0").slice(-6);
      return `#${hex}`;
    }
  }
  const prefixed = value.startsWith("#") ? value : `#${value}`;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(prefixed)) {
    return prefixed;
  }
  if (/^rgb(a)?\(/i.test(value)) {
    return value;
  }
  return void 0;
}, "normalizeColor");
var getAuthorKey = /* @__PURE__ */ __name((message) => {
  const author = message?.author;
  if (!author) {
    return void 0;
  }
  if (author.id) {
    return author.id;
  }
  if (author.display_name || author.username) {
    const composite = `${author.username ?? ""}|${author.display_name ?? ""}`.trim();
    if (composite.length > 0) {
      return composite;
    }
  }
  return void 0;
}, "getAuthorKey");
var ATTACHMENT_ICON_AUDIO = `
  <img src="${AUDIO_ICON_URL}" alt="" class="discord-attachment__icon-image" loading="lazy" decoding="async" />
`;
var ATTACHMENT_ICON_VIDEO = `
  <img src="${VIDEO_ICON_URL}" alt="" class="discord-attachment__icon-image" loading="lazy" decoding="async" />
`;
var ATTACHMENT_ICON_FILE = `
  <img src="${FILE_ICON_URL}" alt="" class="discord-attachment__icon-image" loading="lazy" decoding="async" />
`;
var renderAttachments = /* @__PURE__ */ __name((attachments) => {
  if (!attachments || attachments.length === 0) {
    return "";
  }
  const decodeFileName = /* @__PURE__ */ __name((src) => {
    const withoutQuery = src.split(/[?#]/)[0];
    const segments = withoutQuery.split("/");
    const candidate = segments.pop() ?? "";
    const fallback = candidate.trim().length > 0 ? candidate.trim() : "discord-attachment";
    try {
      return decodeURIComponent(fallback);
    } catch {
      return fallback;
    }
  }, "decodeFileName");
  const scrubLabel = /* @__PURE__ */ __name((value) => {
    if (!value) {
      return void 0;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : void 0;
  }, "scrubLabel");
  const buildSubtitle = /* @__PURE__ */ __name((attachment, displayName) => {
    const subtitleSource = scrubLabel(attachment.title) ?? scrubLabel(attachment.alt);
    if (!subtitleSource) {
      return "";
    }
    if (subtitleSource.toLowerCase() === displayName.toLowerCase()) {
      return "";
    }
    return `<span class="discord-attachment__subtitle">${escapeHtml(subtitleSource)}</span>`;
  }, "buildSubtitle");
  const renderCard = /* @__PURE__ */ __name((type, src, displayName, subtitle) => {
    const escapedSrc = escapeAttribute(src);
    const typeLabel = type === "audio" ? "Audio" : type === "video" ? "Video" : type === "image" ? "Image" : "File";
    const icon = type === "audio" ? ATTACHMENT_ICON_AUDIO : type === "video" ? ATTACHMENT_ICON_VIDEO : ATTACHMENT_ICON_FILE;
    return `<a class="discord-attachment__card discord-attachment__card--${type}" href="${escapedSrc}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttribute(`${typeLabel}: ${displayName}`)}">
      <span class="discord-attachment__icon" aria-hidden="true">${icon}</span>
      <span class="discord-attachment__info">
        <span class="discord-attachment__name">${escapeHtml(displayName)}</span>
        ${subtitle}
      </span>
    </a>`;
  }, "renderCard");
  const items = attachments.map((attachment) => {
    if (!attachment || typeof attachment.src !== "string") {
      return "";
    }
    const type = attachment.type ?? "file";
    const src = attachment.src.trim();
    if (!src) {
      return "";
    }
    const displayName = scrubLabel(attachment.alt) ?? scrubLabel(attachment.title) ?? decodeFileName(src);
    const subtitle = buildSubtitle(attachment, displayName);
    if (type === "image") {
      const altText = scrubLabel(attachment.alt) ?? "Discord attachment";
      const escapedSrc = escapeAttribute(src);
      return `<span class="discord-attachment discord-attachment--image">
        <a class="discord-attachment__image-link" href="${escapedSrc}" target="_blank" rel="noopener noreferrer">
          <img src="${escapedSrc}" alt="${escapeAttribute(altText)}" loading="lazy" decoding="async" />
        </a>
      </span>`;
    }
    if (type === "audio") {
      const escapedLabel = escapeAttribute(displayName);
      const card2 = renderCard(type, src, displayName, subtitle);
      const escapedSrc = escapeAttribute(src);
      return `<span class="discord-attachment discord-attachment--audio">
        ${card2}
        <audio class="discord-attachment__control" controls preload="metadata" aria-label="${escapedLabel}">
          <source src="${escapedSrc}" />
        </audio>
      </span>`;
    }
    if (type === "video") {
      const escapedLabel = escapeAttribute(displayName);
      const previewSrc = resolveGoogleDrivePreview(src);
      const cardHref = previewSrc ?? src;
      const card2 = renderCard(type, cardHref, displayName, subtitle);
      if (previewSrc) {
        const escapedPreview = escapeAttribute(previewSrc);
        return `<span class="discord-attachment discord-attachment--video">
        ${card2}
  <iframe class="discord-attachment__frame external-embed drive" src="${escapedPreview}" title="${escapedLabel}" allow="autoplay; fullscreen; picture-in-picture" loading="lazy" allowfullscreen></iframe>
      </span>`;
      }
      const escapedSrc = escapeAttribute(src);
      return `<span class="discord-attachment discord-attachment--video">
        ${card2}
        <video class="discord-attachment__control" controls preload="metadata" playsinline aria-label="${escapedLabel}">
          <source src="${escapedSrc}" />
        </video>
      </span>`;
    }
    const card = renderCard("file", src, displayName, subtitle);
    return `<span class="discord-attachment discord-attachment--file">
      ${card}
    </span>`;
  }).filter((html) => html.length > 0);
  if (items.length === 0) {
    return "";
  }
  return `<span class="discord-attachments" role="group" data-discord-jump-skip="true">${items.join("\n")}</span>`;
}, "renderAttachments");
var renderMessage = /* @__PURE__ */ __name((message, previous, options2 = {}, context) => {
  const {
    wrapperTag = "article",
    avatarTag = "div",
    bodyTag = "div",
    headerTag = "div",
    contentTag = "div"
  } = options2;
  const author = message.author ?? {};
  const displayName = author.display_name?.trim() || author.username?.trim() || "Unknown User";
  const avatar = message.avatar_url?.trim() || DEFAULT_AVATAR;
  const timestamp = formatTimestamp(message.timestamp);
  const jumpUrl = message.jump_url || message.url || "#";
  const content = renderContent(message.content);
  const authorColor = normalizeColor(
    author.color ?? author.colour ?? author.colour_value
  );
  const previousKey = getAuthorKey(previous);
  const currentKey = getAuthorKey(message);
  const sameAuthor = previousKey !== void 0 && previousKey === currentKey;
  const showHeader = !sameAuthor;
  const showAvatar = !sameAuthor;
  const articleClasses = ["discord-message"];
  if (!showAvatar) {
    articleClasses.push("discord-message--compact");
  }
  const anchorId = buildMessageAnchorId(message, context);
  const articleAttributes = [`class="${articleClasses.join(" ")}"`];
  if (message.id) {
    articleAttributes.push(`data-discord-id="${escapeAttribute(message.id)}"`);
  }
  if (anchorId) {
    articleAttributes.push(`id="${escapeAttribute(anchorId)}"`);
  }
  if (authorColor) {
    articleAttributes.push(`style="--discord-author-color: ${escapeAttribute(authorColor)}"`);
  }
  const trimmedJumpUrl = jumpUrl.trim();
  const hasJumpTarget = trimmedJumpUrl.length > 0 && trimmedJumpUrl !== "#";
  if (hasJumpTarget) {
    articleAttributes.push(`data-discord-jump="${escapeAttribute(trimmedJumpUrl)}"`);
    const ariaLabelParts = [`Open Discord message from ${displayName}`];
    if (timestamp) {
      ariaLabelParts.push(`posted ${timestamp.readable}`);
    }
    const ariaLabel = ariaLabelParts.join(", ");
    articleAttributes.push('role="link"');
    articleAttributes.push('tabindex="0"');
    articleAttributes.push(`aria-label="${escapeAttribute(ariaLabel)}"`);
  }
  const avatarMarkup = showAvatar ? `<${avatarTag} class="discord-avatar">
        <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(displayName)}'s avatar" loading="lazy" width="40" height="40" onerror="${escapeAttribute(
    `this.onerror=null;this.src='${FALLBACK_AVATAR}';`
  )}" />
      </${avatarTag}>` : `<${avatarTag} class="discord-avatar-spacer" aria-hidden="true"></${avatarTag}>`;
  const headerMarkup = showHeader ? `<${headerTag} class="discord-header">
        <span class="discord-author"${authorColor ? ` style="color: ${escapeAttribute(authorColor)}"` : ""}>${escapeHtml(displayName)}</span>
        ${timestamp ? `<time datetime="${escapeAttribute(timestamp.iso)}">${escapeHtml(timestamp.readable)}</time>` : ""}
      </${headerTag}>` : "";
  const accessibleTimestamp = !showHeader && timestamp ? `<time class="discord-timestamp-sr" datetime="${escapeAttribute(timestamp.iso)}">${escapeHtml(timestamp.readable)}</time>` : "";
  const contentClasses = ["discord-content"];
  if (!showHeader) {
    contentClasses.push("discord-content--compact");
  }
  const attachmentsArray = Array.isArray(message.attachments) ? message.attachments : void 0;
  const attachmentsMarkup = renderAttachments(attachmentsArray);
  const attributes = articleAttributes.join(" ");
  return `<${wrapperTag} ${attributes}>
      ${avatarMarkup}
      <${bodyTag} class="discord-body">
        ${headerMarkup}
        <${contentTag} class="${contentClasses.join(" ")}">${content}${accessibleTimestamp}</${contentTag}>
        ${attachmentsMarkup}
      </${bodyTag}>
  </${wrapperTag}>`;
}, "renderMessage");
var renderMessages = /* @__PURE__ */ __name((messages, options2 = {}) => {
  if (messages.length === 0) {
    return "";
  }
  const {
    containerTag = "section",
    messageOptions,
    enableShare = true,
    slug,
    wrapperTag = "div",
    contentWrapperTag = "div",
    collapsible = true
  } = options2;
  const { anchorId: wrapperAnchorId, snippet: primarySnippet } = buildThreadAnchorMetadata(messages, slug);
  const htmlMessages = messages.map(
    (message, index) => renderMessage(message, index > 0 ? messages[index - 1] : void 0, messageOptions, {
      index,
      threadId: wrapperAnchorId
    })
  ).join("\n");
  let shareMarkup = "";
  if (enableShare) {
    const messageCount = messages.length;
    const countLabel = messageCount === 1 ? "Share Discord message" : `Share Discord thread (${messageCount} messages)`;
    const shareTitle = messageCount === 1 ? "Discord message" : "Discord thread";
    const shareAttributes = [
      'type="button"',
      'class="discord-thread-share article-share__button"',
      `aria-label="${escapeAttribute(countLabel)}"`,
      `data-share-url="#${escapeAttribute(wrapperAnchorId)}"`,
      `data-share-title="${escapeAttribute(shareTitle)}"`
    ];
    const shareText = primarySnippet ?? createShareSnippet(messages[0]?.content);
    if (shareText) {
      shareAttributes.push(`data-share-text="${escapeAttribute(shareText)}"`);
    }
    shareAttributes.push('data-share-copied="URL copied"');
    shareMarkup = `<div class="discord-thread-share-container article-share">
      <button ${shareAttributes.join(" ")}>
        <span class="discord-thread-share__icon" aria-hidden="true"></span>
      </button>
      <span class="article-share__feedback" aria-live="polite"></span>
    </div>`;
  }
  const wrapperClasses = ["discord-thread-wrapper"];
  const contentClasses = ["discord-thread-content"];
  if (collapsible) {
    wrapperClasses.push("collapsed");
    contentClasses.push("collapsed");
  }
  const fadeMarkup = collapsible ? `<div class="discord-thread-fade" aria-hidden="true"></div>` : "";
  const collapseToggleMarkup = collapsible ? `<button class="discord-collapse-toggle" aria-expanded="false" aria-controls="${wrapperAnchorId}-content" data-discord-toggle="${wrapperAnchorId}">
    <span>Show More</span>
    <svg class="discord-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>` : "";
  return `<${wrapperTag} class="${wrapperClasses.join(" ")}" id="${wrapperAnchorId}">
  ${shareMarkup}
  <${contentWrapperTag} class="${contentClasses.join(" ")}" id="${wrapperAnchorId}-content">
    <${containerTag} class="discord-thread" data-message-count="${messages.length}">
${htmlMessages}
    </${containerTag}>
    ${fadeMarkup}
  </${contentWrapperTag}>
  ${collapseToggleMarkup}
</${wrapperTag}>`;
}, "renderMessages");
var renderCitation = /* @__PURE__ */ __name((id, messages, slug) => {
  const threadHtml = renderMessages(messages, {
    containerTag: "span",
    messageOptions: {
      wrapperTag: "span",
      avatarTag: "span",
      bodyTag: "span",
      headerTag: "span",
      contentTag: "span"
    },
    enableShare: false,
    slug,
    wrapperTag: "span",
    contentWrapperTag: "span",
    collapsible: false
  });
  if (!threadHtml) {
    return void 0;
  }
  const count = messages.length;
  const labelText = count === 1 ? "View Discord citation (1 message)" : `View Discord citation (${count} messages)`;
  return `<span class="discord-cite" data-discord-id="${escapeAttribute(id)}">
    <button type="button" class="discord-cite__trigger" aria-label="${escapeAttribute(labelText)}" title="${escapeAttribute(labelText)}">
      <svg viewBox="0 0 32 32" role="img" aria-hidden="true" focusable="false">
        <path d="${DISCORD_CITE_ICON_PATH}" />
      </svg>
      <span class="discord-cite__sr">${escapeHtml(labelText)}</span>
    </button>
    <span class="discord-cite__preview" role="dialog" aria-modal="false">
      <span class="discord-cite__preview-content">${threadHtml}</span>
    </span>
  </span>`;
}, "renderCitation");
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  "png",
  "apng",
  "avif",
  "gif",
  "jpg",
  "jpeg",
  "jfif",
  "pjpeg",
  "pjp",
  "svg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif"
]);
var AUDIO_EXTENSIONS = /* @__PURE__ */ new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "opus",
  "flac",
  "aac",
  "m4a",
  "weba",
  "mid",
  "midi"
]);
var VIDEO_EXTENSIONS = /* @__PURE__ */ new Set([
  "mp4",
  "m4v",
  "mov",
  "webm",
  "ogv",
  "ogg",
  "mkv",
  "avi",
  "wmv",
  "flv",
  "gifv"
]);
var normaliseAttachmentDescriptors = /* @__PURE__ */ __name((value) => {
  if (value === null || value === void 0) {
    return [];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [{ target: trimmed }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normaliseAttachmentDescriptors(entry));
  }
  if (typeof value === "object") {
    const record = value;
    const candidateValues = [
      record.target,
      record.src,
      record.attachment,
      record.url,
      record.path,
      record.href,
      record.file,
      record.source
    ];
    const source = candidateValues.find(
      (candidate) => typeof candidate === "string" && candidate.trim().length > 0
    );
    if (!source) {
      return [];
    }
    const altValue = record.alt;
    const alt = typeof altValue === "string" ? altValue.trim() : void 0;
    const typeValue = record.type ?? record.mtype ?? record.kind;
    const typeHint = typeof typeValue === "string" ? typeValue.trim() : void 0;
    const titleValue = record.title ?? record.name ?? record.label ?? record.caption ?? record.description;
    const title = typeof titleValue === "string" ? titleValue.trim() : void 0;
    return [
      {
        target: source.trim(),
        alt: alt && alt.length > 0 ? alt : void 0,
        typeHint: typeHint && typeHint.length > 0 ? typeHint : void 0,
        title: title && title.length > 0 ? title : void 0
      }
    ];
  }
  return [];
}, "normaliseAttachmentDescriptors");
var toLowerSafe = /* @__PURE__ */ __name((value) => typeof value === "string" ? value.trim().toLowerCase() : void 0, "toLowerSafe");
var extractExtension = /* @__PURE__ */ __name((source) => {
  if (!source) {
    return void 0;
  }
  const withoutQuery = source.split(/[?#]/)[0]?.trim();
  if (!withoutQuery) {
    return void 0;
  }
  const lastDot = withoutQuery.lastIndexOf(".");
  if (lastDot === -1 || lastDot === withoutQuery.length - 1) {
    return void 0;
  }
  return withoutQuery.slice(lastDot + 1).toLowerCase();
}, "extractExtension");
var resolveGoogleDrivePreview = /* @__PURE__ */ __name((source) => {
  if (typeof source !== "string" || source.length === 0) {
    return void 0;
  }
  if (!/^https?:\/\//i.test(source)) {
    return void 0;
  }
  let url;
  try {
    url = new URL(source);
  } catch {
    return void 0;
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith("drive.google.com")) {
    return void 0;
  }
  const pathname = url.pathname;
  if (!pathname.includes("/file/")) {
    return void 0;
  }
  let adjustedPath = pathname;
  if (adjustedPath.includes("/view")) {
    adjustedPath = adjustedPath.replace(/\/view(?=\/?$)/, "/preview");
  }
  if (!adjustedPath.endsWith("/preview")) {
    adjustedPath = adjustedPath.replace(/\/+$/, "");
    adjustedPath = `${adjustedPath}/preview`;
  }
  return `${url.origin}${adjustedPath}${url.search}`;
}, "resolveGoogleDrivePreview");
var determineAttachmentType = /* @__PURE__ */ __name((src, hint) => {
  const hintValue = toLowerSafe(hint);
  if (hintValue) {
    if (hintValue.includes("image") || hintValue === "img" || hintValue === "picture" || hintValue === "photo") {
      return "image";
    }
    if (hintValue.includes("audio") || hintValue.includes("sound") || hintValue.includes("voice") || hintValue === "music") {
      return "audio";
    }
    if (hintValue.includes("video") || hintValue === "gifv" || hintValue === "movie") {
      return "video";
    }
  }
  const extension = extractExtension(src);
  if (resolveGoogleDrivePreview(src)) {
    return "video";
  }
  if (extension) {
    if (IMAGE_EXTENSIONS.has(extension)) {
      return "image";
    }
    if (AUDIO_EXTENSIONS.has(extension)) {
      return "audio";
    }
    if (VIDEO_EXTENSIONS.has(extension)) {
      return "video";
    }
  }
  return "file";
}, "determineAttachmentType");
var applyAttachmentMetadataToMessages = /* @__PURE__ */ __name((messages, slug) => {
  messages.forEach((message) => {
    if (!message || typeof message !== "object") {
      return;
    }
    const raw = message;
    const descriptors = [
      ...normaliseAttachmentDescriptors(raw.attachments),
      ...normaliseAttachmentDescriptors(raw.attachment),
      ...normaliseAttachmentDescriptors(raw.image),
      ...normaliseAttachmentDescriptors(raw.images)
    ];
    if (descriptors.length === 0) {
      delete raw.image;
      delete raw.images;
      delete raw.image_alt;
      delete raw.imageAlt;
      delete raw.attachment;
      delete raw.attachment_alt;
      delete raw.attachmentAlt;
      if (!Array.isArray(message.attachments)) {
        delete message.attachments;
      }
      return;
    }
    const altFallbacks = [
      typeof raw.attachment_alt === "string" ? raw.attachment_alt.trim() : void 0,
      typeof raw.attachmentAlt === "string" ? raw.attachmentAlt.trim() : void 0,
      typeof raw.image_alt === "string" ? raw.image_alt.trim() : void 0,
      typeof raw.imageAlt === "string" ? raw.imageAlt.trim() : void 0
    ].filter((value) => Boolean(value));
    let fallbackIndex = 0;
    descriptors.forEach((descriptor) => {
      if (!descriptor.alt && fallbackIndex < altFallbacks.length) {
        const fallback = altFallbacks[fallbackIndex];
        if (fallback) {
          descriptor.alt = fallback;
        }
        fallbackIndex += 1;
      }
    });
    const seenSources = /* @__PURE__ */ new Set();
    const resolved = [];
    descriptors.forEach((descriptor) => {
      const src = resolveAttachmentSource(descriptor.target, slug, { appendVersion: false });
      if (!src) {
        return;
      }
      const trimmedSrc = src.trim();
      if (!trimmedSrc || seenSources.has(trimmedSrc)) {
        return;
      }
      seenSources.add(trimmedSrc);
      resolved.push({
        type: determineAttachmentType(trimmedSrc, descriptor.typeHint),
        src: trimmedSrc,
        alt: descriptor.alt && descriptor.alt.trim().length > 0 ? descriptor.alt.trim() : void 0,
        title: descriptor.title && descriptor.title.trim().length > 0 ? descriptor.title.trim() : void 0
      });
    });
    if (resolved.length > 0) {
      message.attachments = resolved;
    } else {
      delete message.attachments;
    }
    delete raw.image;
    delete raw.images;
    delete raw.image_alt;
    delete raw.imageAlt;
    delete raw.attachment;
    delete raw.attachment_alt;
    delete raw.attachmentAlt;
  });
}, "applyAttachmentMetadataToMessages");
var parseDiscordBlock = /* @__PURE__ */ __name((value, slug) => {
  try {
    const data = JSON.parse(value.trim());
    const messages = normaliseMessages(data);
    if (messages.length > 0) {
      applyAttachmentMetadataToMessages(messages, slug);
    }
    return messages;
  } catch (error) {
    console.warn("Failed to parse discord block", error);
    return [];
  }
}, "parseDiscordBlock");
var visitCodeBlocks = /* @__PURE__ */ __name((node, callback) => {
  if (!node || typeof node !== "object" || !Array.isArray(node.children)) {
    return;
  }
  const parent = node;
  for (let idx = 0; idx < parent.children.length; idx++) {
    const child = parent.children[idx];
    if (!child || typeof child !== "object") {
      continue;
    }
    if (child.type === "code") {
      callback(child, idx, parent);
    }
    visitCodeBlocks(child, callback);
  }
}, "visitCodeBlocks");
var replaceCitationMarkers = /* @__PURE__ */ __name((value, citations, slug) => {
  CITATION_MARKER_PATTERN.lastIndex = 0;
  let match;
  let lastIndex = 0;
  const nodes = [];
  let replaced = false;
  while ((match = CITATION_MARKER_PATTERN.exec(value)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const id = match[1] ?? match[2];
    if (!id) {
      continue;
    }
    if (start > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, start) });
    }
    const messages = citations.get(id) ?? [];
    if (messages.length > 0) {
      const citationHtml = renderCitation(id, messages, slug);
      if (citationHtml) {
        nodes.push({ type: "html", value: citationHtml });
        replaced = true;
      } else {
        nodes.push({ type: "text", value: match[0] });
      }
    } else {
      nodes.push({ type: "text", value: match[0] });
    }
    lastIndex = end;
  }
  if (!replaced) {
    return null;
  }
  if (lastIndex < value.length) {
    nodes.push({ type: "text", value: value.slice(lastIndex) });
  }
  return nodes.filter((node) => {
    if (node.type !== "text") {
      return true;
    }
    const textValue = node.value;
    return typeof textValue !== "string" || textValue.length > 0;
  });
}, "replaceCitationMarkers");
var collectTextContent = /* @__PURE__ */ __name((node) => {
  if (!node || typeof node !== "object") {
    return "";
  }
  const value = node.value;
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child) => collectTextContent(child)).join("");
  }
  return "";
}, "collectTextContent");
var findCodeBlockNode = /* @__PURE__ */ __name((node) => {
  if (!node || typeof node !== "object") {
    return void 0;
  }
  if (node.type === "code" && typeof node.value === "string") {
    return node;
  }
  if (!Array.isArray(node.children)) {
    return void 0;
  }
  for (const child of node.children) {
    const found = findCodeBlockNode(child);
    if (found) {
      return found;
    }
  }
  return void 0;
}, "findCodeBlockNode");
var isDiscordCitationCallout = /* @__PURE__ */ __name((node) => {
  if (!node || typeof node !== "object") {
    return false;
  }
  const type = node.type;
  if (type === "containerDirective" || type === "leafDirective" || type === "textDirective") {
    const directiveName = (node.name ?? "").toLowerCase();
    return directiveName === "discord-cite";
  }
  if (type !== "blockquote") {
    return false;
  }
  const hProperties = node.data?.hProperties;
  const calloutValue = typeof hProperties?.["data-callout"] === "string" ? hProperties["data-callout"].toLowerCase() : void 0;
  if (calloutValue === "discord-cite") {
    return true;
  }
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return false;
  }
  const firstChild = node.children[0];
  if (!firstChild || typeof firstChild !== "object") {
    return false;
  }
  if (firstChild.type === "paragraph") {
    const text = collectTextContent(firstChild).trim().toLowerCase();
    return text.startsWith("[!discord-cite");
  }
  return false;
}, "isDiscordCitationCallout");
var extractCitationDataFromCallout = /* @__PURE__ */ __name((node, slug) => {
  if (!Array.isArray(node.children)) {
    return void 0;
  }
  const codeBlock = findCodeBlockNode(node);
  if (!codeBlock || typeof codeBlock.value !== "string") {
    return void 0;
  }
  const raw = codeBlock.value.trim();
  if (raw.length === 0) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(raw);
    const id = typeof parsed.id === "string" ? parsed.id.trim() : void 0;
    const messages = normaliseMessages(
      parsed.messages !== void 0 ? parsed.messages : parsed
    );
    if (!id || messages.length === 0) {
      return void 0;
    }
    if (messages.length > 0) {
      applyAttachmentMetadataToMessages(messages, slug);
    }
    return { id, messages };
  } catch (error) {
    const preview = raw.slice(0, 160);
    const slugLabel = slug ?? "unknown";
    console.warn(
      `Failed to parse Discord citation callout payload for ${slugLabel}`,
      error,
      { preview }
    );
    return void 0;
  }
}, "extractCitationDataFromCallout");
var collectCitationCallouts = /* @__PURE__ */ __name((root, slug) => {
  const citations = /* @__PURE__ */ new Map();
  const removals = [];
  const traverse = /* @__PURE__ */ __name((current) => {
    if (!current || typeof current !== "object") {
      return;
    }
    const parent = current;
    if (!Array.isArray(parent.children)) {
      return;
    }
    for (let idx = 0; idx < parent.children.length; idx++) {
      const child = parent.children[idx];
      if (!child || typeof child !== "object") {
        continue;
      }
      if (isDiscordCitationCallout(child)) {
        const data = extractCitationDataFromCallout(child, slug);
        if (data) {
          citations.set(data.id, data.messages);
        } else {
          console.warn("Unable to extract Discord citation data from callout");
        }
        removals.push({ parent, index: idx });
        continue;
      }
      traverse(child);
    }
  }, "traverse");
  traverse(root);
  for (let idx = removals.length - 1; idx >= 0; idx--) {
    const { parent, index } = removals[idx];
    if (!Array.isArray(parent.children)) {
      continue;
    }
    parent.children.splice(index, 1);
  }
  return citations;
}, "collectCitationCallouts");
var transformCitationMarkers = /* @__PURE__ */ __name((root, citations, slug) => {
  const traverse = /* @__PURE__ */ __name((node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const parent = node;
    if (!Array.isArray(parent.children)) {
      return;
    }
    for (let idx = 0; idx < parent.children.length; idx++) {
      const child = parent.children[idx];
      if (!child || typeof child !== "object") {
        continue;
      }
      const value = typeof child.value === "string" ? child.value ?? "" : void 0;
      if (typeof value === "string") {
        const replacements = replaceCitationMarkers(value, citations, slug);
        if (replacements) {
          parent.children.splice(idx, 1, ...replacements);
          idx += replacements.length - 1;
          continue;
        }
      }
      traverse(child);
    }
  }, "traverse");
  traverse(root);
}, "transformCitationMarkers");
var DiscordMessages = /* @__PURE__ */ __name(() => {
  return {
    name: "DiscordMessages",
    markdownPlugins() {
      return [
        () => (tree, file) => {
          const root = tree;
          const slug = typeof file?.data?.slug === "string" ? file.data.slug : void 0;
          const citations = collectCitationCallouts(root, slug);
          transformCitationMarkers(root, citations, slug);
          visitCodeBlocks(root, (codeBlock, index, parent) => {
            const lang = typeof codeBlock.lang === "string" ? codeBlock.lang.toLowerCase() : "";
            if (lang !== "discord") {
              return;
            }
            const raw = typeof codeBlock.value === "string" ? codeBlock.value : "";
            const messages = parseDiscordBlock(raw, slug);
            if (messages.length === 0) {
              return;
            }
            const html = renderMessages(messages, { slug });
            if (parent.type === "paragraph" && parent.children?.length === 1) {
              delete parent.children;
              parent.type = "html";
              parent.value = html;
              return;
            }
            parent.children.splice(index, 1, {
              type: "html",
              value: html
            });
          });
        }
      ];
    },
    externalResources() {
      return {
        css: [
          {
            content: DISCORD_CSS,
            inline: true
          }
        ],
        js: [
          {
            script: discordCollapse_inline_default,
            loadTime: "afterDOMReady",
            contentType: "inline"
          },
          {
            script: discordMessageJump_inline_default,
            loadTime: "afterDOMReady",
            contentType: "inline"
          }
        ]
      };
    }
  };
}, "DiscordMessages");

// quartz/plugins/transformers/youtubeCommunityPosts.ts
import path5 from "node:path";
import fs2, { existsSync } from "node:fs";
import fsp from "node:fs/promises";
import { globbySync as globbySync2 } from "globby";
var TARGET_SLUG = "youtube/community-posts";
var DEFAULT_CHANNEL_HANDLE = "7-10tone";
var CONTENT_ROOT2 = path5.resolve(process.cwd(), "../Content");
var CACHE_DIR = path5.resolve(process.cwd(), ".quartz-cache");
var CACHE_FILE = path5.join(CACHE_DIR, "youtube-channels.json");
var AVATAR_RELATIVE_DIR = "Media/Avatars";
var AVATAR_DIR = path5.resolve(CONTENT_ROOT2, AVATAR_RELATIVE_DIR);
if (!existsSync(CACHE_DIR)) {
  fs2.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!existsSync(AVATAR_DIR)) {
  fs2.mkdirSync(AVATAR_DIR, { recursive: true });
}
var memoryCache = null;
var loadCache = /* @__PURE__ */ __name(async () => {
  if (memoryCache) return memoryCache;
  try {
    const data = await fsp.readFile(CACHE_FILE, "utf-8");
    memoryCache = JSON.parse(data);
  } catch {
    memoryCache = {};
  }
  return memoryCache;
}, "loadCache");
var saveCache = /* @__PURE__ */ __name(async () => {
  if (memoryCache) {
    await fsp.writeFile(CACHE_FILE, JSON.stringify(memoryCache, null, 2));
  }
}, "saveCache");
var downloadImage = /* @__PURE__ */ __name(async (url, destPath) => {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (!res.ok) {
      console.warn(`[YouTubeCommunityPosts] Failed to fetch image ${url}: ${res.statusText}`);
      return;
    }
    const buffer = await res.arrayBuffer();
    await fsp.writeFile(destPath, Buffer.from(buffer));
  } catch (err) {
    console.warn(`[YouTubeCommunityPosts] Failed to download image from ${url}`, err);
  }
}, "downloadImage");
var fetchChannelData = /* @__PURE__ */ __name(async (handle) => {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
    if (!titleMatch || !imageMatch) return null;
    const name = titleMatch[1];
    const imageUrl = imageMatch[1];
    let ext = "jpg";
    if (imageUrl.includes(".png")) ext = "png";
    const safeHandle = handle.replace(/[^a-zA-Z0-9_\-]/g, "");
    const avatarFilename = `${safeHandle}.${ext}`;
    const localAvatarPath = `${AVATAR_RELATIVE_DIR}/${avatarFilename}`;
    const absoluteAvatarPath = path5.join(AVATAR_DIR, avatarFilename);
    await downloadImage(imageUrl, absoluteAvatarPath);
    return {
      name,
      avatar: localAvatarPath
    };
  } catch (err) {
    console.warn(`[YouTubeCommunityPosts] Failed to fetch channel @${handle}`, err);
    return null;
  }
}, "fetchChannelData");
var getChannelProfile = /* @__PURE__ */ __name(async (handle) => {
  const cache = await loadCache();
  const normalizedKey = handle.toLowerCase();
  if (cache[normalizedKey]) {
    return cache[normalizedKey];
  }
  if (normalizedKey === "7-10tone" && !cache[normalizedKey]) {
    cache[normalizedKey] = {
      name: "7/10 Tone",
      avatar: "Media/710 Media/Images/710 tone pfp small.jpg"
    };
    return cache[normalizedKey];
  }
  console.log(`[YouTubeCommunityPosts] Fetching channel data for: @${handle}`);
  const profile = await fetchChannelData(handle);
  if (profile) {
    cache[normalizedKey] = profile;
    await saveCache();
    return profile;
  }
  return {
    name: `@${handle}`,
    avatar: "Media/Avatars/default.jpg"
  };
}, "getChannelProfile");
var assetLookupCache2 = /* @__PURE__ */ new Map();
var isExternalUrl2 = /* @__PURE__ */ __name((url) => /^(https?:)?\/\//i.test(url), "isExternalUrl");
var stripContentPrefix2 = /* @__PURE__ */ __name((target) => target.replace(/^[./]+/, "").replace(/^content\//i, ""), "stripContentPrefix");
var findAssetByBasename2 = /* @__PURE__ */ __name((basename2) => {
  const key = basename2.toLowerCase();
  if (assetLookupCache2.has(key)) {
    const cached = assetLookupCache2.get(key);
    return cached === null ? void 0 : cached;
  }
  const matches = globbySync2(`**/${basename2}`, {
    cwd: CONTENT_ROOT2,
    caseSensitiveMatch: false,
    onlyFiles: true
  });
  if (matches.length === 0) {
    assetLookupCache2.set(key, null);
    return void 0;
  }
  matches.sort((a, b) => a.length - b.length || a.localeCompare(b));
  const resolved = matches[0].replace(/\\/g, "/");
  assetLookupCache2.set(key, resolved);
  return resolved;
}, "findAssetByBasename");
var resolveObsidianTarget2 = /* @__PURE__ */ __name((rawTarget, slug) => {
  if (isExternalUrl2(rawTarget)) {
    return rawTarget;
  }
  let targetPath = stripContentPrefix2(rawTarget);
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename2(targetPath);
    if (matched) {
      targetPath = matched;
    }
  }
  const targetWithoutExt = targetPath;
  const targetSlug = slugifyFilePath(targetWithoutExt);
  const baseDir = pathToRoot(slug);
  const resolved = joinSegments(baseDir, targetSlug);
  const version = getAssetVersion();
  return version ? `${resolved}?v=${version}` : resolved;
}, "resolveObsidianTarget");
var escapeHtml2 = /* @__PURE__ */ __name((value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"), "escapeHtml");
var escapeAttribute2 = /* @__PURE__ */ __name((value) => escapeHtml2(value), "escapeAttribute");
var collectText = /* @__PURE__ */ __name((node) => {
  if (!node || typeof node !== "object") {
    return "";
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child) => collectText(child)).join("");
  }
  return "";
}, "collectText");
var EMBED_REGEX = /!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;
var METADATA_LINE_REGEX = /^\s*(?:@([a-zA-Z0-9_\-]+)\s*,\s*)?(\d+)\s*,\s*(\d+)\s*,\s*([^,\n]+?)(?:\s*,\s*)?(?:\r?\n|$)/i;
var COMMUNITY_POST_PREFIX_REGEX = /^\s*community-post\s*,/i;
var parseCommunityPostHeader = /* @__PURE__ */ __name((raw) => {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!COMMUNITY_POST_PREFIX_REGEX.test(trimmed)) {
    return null;
  }
  const parts = trimmed.split(",").map((part) => part.trim()).filter((part, index, array) => {
    if (part.length === 0 && index >= array.length - 1) {
      return false;
    }
    return true;
  });
  if (parts.length < 4) {
    return null;
  }
  let argIndex = 1;
  let channelHandle = DEFAULT_CHANNEL_HANDLE;
  if (parts[1] && parts[1].startsWith("@")) {
    channelHandle = parts[1].slice(1).toLowerCase();
    argIndex++;
  }
  if (parts.length < argIndex + 2) {
    return null;
  }
  const likes = Number.parseInt(parts[argIndex] ?? "", 10);
  const comments = Number.parseInt(parts[argIndex + 1] ?? "", 10);
  if (!Number.isFinite(likes) || !Number.isFinite(comments)) {
    return null;
  }
  let postedLabelRaw = parts[argIndex + 2] ?? "";
  const inlineSegments = parts.slice(argIndex + 3).filter((segment) => segment.length > 0);
  if ((!postedLabelRaw || /^[0-9]+$/.test(postedLabelRaw)) && inlineSegments.length > 0) {
    const candidate = inlineSegments[0];
    if (candidate && /[A-Za-z]/.test(candidate)) {
      postedLabelRaw = `${postedLabelRaw} ${candidate}`.trim();
      inlineSegments.shift();
    } else if (!postedLabelRaw) {
      postedLabelRaw = candidate;
      inlineSegments.shift();
    }
  } else if (postedLabelRaw && inlineSegments.length > 0 && /[A-Za-z]/.test(postedLabelRaw) && !/\d{4}/.test(postedLabelRaw)) {
    const candidate = inlineSegments[0];
    if (/^\d{4}$/.test(candidate)) {
      postedLabelRaw = `${postedLabelRaw} ${candidate}`.trim();
      inlineSegments.shift();
    }
  }
  const inlineBody = inlineSegments.join(",").trim();
  const metadata = {};
  metadata.likes = likes;
  metadata.comments = comments;
  metadata.channelHandle = channelHandle;
  if (postedLabelRaw.length > 0) {
    metadata.postedLabel = postedLabelRaw;
  }
  return {
    metadata,
    inlineBody: inlineBody.length > 0 ? inlineBody : void 0
  };
}, "parseCommunityPostHeader");
var splitSegments = /* @__PURE__ */ __name((raw) => {
  EMBED_REGEX.lastIndex = 0;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = EMBED_REGEX.exec(raw)) !== null) {
    const [whole, target, alias] = match;
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: raw.slice(lastIndex, match.index) });
    }
    segments.push({ type: "embed", target: target.trim(), alias: alias?.trim() });
    lastIndex = match.index + whole.length;
  }
  if (lastIndex < raw.length) {
    segments.push({ type: "text", content: raw.slice(lastIndex) });
  }
  return segments;
}, "splitSegments");
var normaliseWhitespace = /* @__PURE__ */ __name((segment) => segment.replace(/\r\n?/g, "\n"), "normaliseWhitespace");
var toSentenceCase = /* @__PURE__ */ __name((input) => {
  if (!input) {
    return "";
  }
  const cleaned = input.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}, "toSentenceCase");
var parseNumericAlias = /* @__PURE__ */ __name((alias) => {
  if (!alias) {
    return void 0;
  }
  const numeric = Number.parseInt(alias.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : void 0;
}, "parseNumericAlias");
var parseMetadataMatch = /* @__PURE__ */ __name((match) => {
  if (!match) {
    return {};
  }
  const [, handleRaw, likesRaw, commentsRaw, labelRaw] = match;
  const likes = Number.parseInt(likesRaw, 10);
  const comments = Number.parseInt(commentsRaw, 10);
  const postedLabel = labelRaw.trim();
  const metadata = {};
  if (Number.isFinite(likes)) {
    metadata.likes = likes;
  }
  if (Number.isFinite(comments)) {
    metadata.comments = comments;
  }
  if (postedLabel.length > 0) {
    metadata.postedLabel = postedLabel;
  }
  if (handleRaw) {
    metadata.channelHandle = handleRaw.toLowerCase();
  }
  return metadata;
}, "parseMetadataMatch");
var parseBodyMetadata = /* @__PURE__ */ __name((raw) => {
  const match = raw.match(METADATA_LINE_REGEX);
  if (!match) {
    return { metadata: {}, body: raw };
  }
  const metadata = parseMetadataMatch(match);
  const body = raw.slice(match[0].length);
  return { metadata, body };
}, "parseBodyMetadata");
var MONTH_INDEX = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};
var ORDINAL_SUFFIX_REGEX = /\b(\d{1,2})(?:st|nd|rd|th)\b/gi;
var TRAILING_PUNCTUATION_REGEX = /[.,]+$/;
var DATE_WITH_DAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric"
});
var DATE_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric"
});
var getMonthIndex = /* @__PURE__ */ __name((value) => MONTH_INDEX[value.toLowerCase()], "getMonthIndex");
var padTwo = /* @__PURE__ */ __name((value) => value < 10 ? `0${value}` : `${value}`, "padTwo");
var padYear = /* @__PURE__ */ __name((value) => value.toString().padStart(4, "0"), "padYear");
var formatPostedLabel = /* @__PURE__ */ __name((rawLabel, fallbackYear) => {
  const base = rawLabel.replace(ORDINAL_SUFFIX_REGEX, "$1").replace(TRAILING_PUNCTUATION_REGEX, "").replace(/\s+/g, " ").trim();
  if (!base) {
    return { display: "" };
  }
  const dayMonthYearMatch = base.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayMonthYearMatch) {
    const [, dayRaw, monthRaw, yearRaw] = dayMonthYearMatch;
    const monthIndex = getMonthIndex(monthRaw);
    if (monthIndex !== void 0) {
      const year = Number.parseInt(yearRaw, 10);
      const day = Number.parseInt(dayRaw, 10);
      if (Number.isFinite(year) && Number.isFinite(day)) {
        const date = new Date(Date.UTC(year, monthIndex, day));
        return {
          display: DATE_WITH_DAY_FORMATTER.format(date),
          iso: `${yearRaw}-${padTwo(monthIndex + 1)}-${padTwo(day)}`
        };
      }
    }
  }
  const dayMonthMatch = base.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  if (dayMonthMatch && fallbackYear) {
    const [, dayRaw, monthRaw] = dayMonthMatch;
    const monthIndex = getMonthIndex(monthRaw);
    if (monthIndex !== void 0) {
      const year = Number.parseInt(fallbackYear, 10);
      const day = Number.parseInt(dayRaw, 10);
      if (Number.isFinite(year) && Number.isFinite(day)) {
        const date = new Date(Date.UTC(year, monthIndex, day));
        return {
          display: DATE_WITH_DAY_FORMATTER.format(date),
          iso: `${padYear(year)}-${padTwo(monthIndex + 1)}-${padTwo(day)}`
        };
      }
    }
  }
  const monthYearMatch = base.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const [, monthRaw, yearRaw] = monthYearMatch;
    const monthIndex = getMonthIndex(monthRaw);
    if (monthIndex !== void 0) {
      const year = Number.parseInt(yearRaw, 10);
      if (Number.isFinite(year)) {
        const date = new Date(Date.UTC(year, monthIndex, 1));
        return {
          display: DATE_MONTH_YEAR_FORMATTER.format(date),
          iso: `${yearRaw}-${padTwo(monthIndex + 1)}-01`
        };
      }
    }
  }
  const yearMatch = base.match(/^(\d{4})$/);
  if (yearMatch) {
    const [, yearRaw] = yearMatch;
    return {
      display: yearRaw,
      iso: yearRaw
    };
  }
  if (fallbackYear && !/\d{4}/.test(base)) {
    const combined = `${base} ${fallbackYear}`;
    const attempt = formatPostedLabel(combined, void 0);
    if (attempt.display) {
      return attempt;
    }
  }
  return { display: base };
}, "formatPostedLabel");
var formatCount = /* @__PURE__ */ __name((value) => {
  if (value === void 0 || Number.isNaN(value) || value < 0) {
    return void 0;
  }
  return value.toLocaleString("en-US");
}, "formatCount");
var normaliseFragment2 = /* @__PURE__ */ __name((value) => value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "").replace(/-+$/, ""), "normaliseFragment");
var toOptionalFragment2 = /* @__PURE__ */ __name((value) => {
  if (!value) {
    return void 0;
  }
  const fragment = normaliseFragment2(value);
  return fragment.length > 0 ? fragment : void 0;
}, "toOptionalFragment");
var createShareSnippet2 = /* @__PURE__ */ __name((raw) => {
  if (!raw) {
    return void 0;
  }
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return void 0;
  }
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}\u2026` : cleaned;
}, "createShareSnippet");
var communityPostSequence = 0;
var buildPostAnchorId = /* @__PURE__ */ __name((slug, metadata, snippet) => {
  const slugFragment = toOptionalFragment2(slug);
  let base = [metadata.postedLabel, snippet].map(toOptionalFragment2).find((fragment) => fragment);
  if (base) {
    if (!base.startsWith("youtube-post")) {
      base = `youtube-post-${base}`;
    }
  } else {
    base = "youtube-post";
  }
  if (slugFragment && !base.startsWith(`${slugFragment}-`)) {
    base = `${slugFragment}-${base}`;
  }
  const sequence = (communityPostSequence++).toString(36);
  return `${base}-${sequence}`;
}, "buildPostAnchorId");
var renderTextSegment = /* @__PURE__ */ __name((segment) => {
  const content = normaliseWhitespace(segment.content).replace(/^\s+/, "").replace(/\s+$/, "");
  if (!content) {
    return "";
  }
  const safe = escapeHtml2(content).replace(/\n/g, "<br />");
  return `<div class="yt-community-post__text">${safe}</div>`;
}, "renderTextSegment");
var renderEmbedSegment = /* @__PURE__ */ __name((segment, slug, channelName) => {
  if (!segment.target) {
    return "";
  }
  const src = resolveObsidianTarget2(segment.target, slug);
  const width = parseNumericAlias(segment.alias);
  const fallbackAlt = toSentenceCase(segment.target.split("/").pop() ?? "") || channelName;
  const aliasAlt = width ? void 0 : segment.alias;
  const alt = escapeAttribute2((aliasAlt && aliasAlt.length > 0 ? aliasAlt : fallbackAlt) || channelName);
  const styles = [];
  if (width) {
    styles.push(`max-width: ${width}px`);
  }
  const styleAttr = styles.length > 0 ? ` style="${escapeAttribute2(styles.join("; "))}"` : "";
  return `<figure class="yt-community-post__embed">
    <img src="${escapeAttribute2(src)}" alt="${alt}" loading="lazy" decoding="async"${styleAttr} />
  </figure>`;
}, "renderEmbedSegment");
var renderSegments = /* @__PURE__ */ __name((segments, slug, channelName) => {
  return segments.map((segment) => {
    if (segment.type === "text") {
      return renderTextSegment(segment);
    }
    return renderEmbedSegment(segment, slug, channelName);
  }).filter((html) => html.length > 0).join("\n");
}, "renderSegments");
var renderPost = /* @__PURE__ */ __name((options2) => {
  const { content, year, slug, metadataHint, channelProfile } = options2;
  const trimmed = content.replace(/^\s+|\s+$/g, "");
  if (!trimmed) {
    return "";
  }
  const { metadata: bodyMetadata, body } = parseBodyMetadata(trimmed);
  const metadata = {
    ...metadataHint,
    ...bodyMetadata
  };
  const channelName = channelProfile.name;
  const avatarSrc = resolveObsidianTarget2(channelProfile.avatar, slug);
  const cleanedBody = body.replace(/^\s+/, "");
  const segments = splitSegments(cleanedBody);
  const bodyHtml = renderSegments(segments, slug, channelName);
  let postedDisplay = metadata.postedLabel?.trim() || "";
  let dataPosted;
  if (postedDisplay) {
    const formatted = formatPostedLabel(postedDisplay, year);
    postedDisplay = formatted.display || postedDisplay;
    if (formatted.iso) {
      dataPosted = formatted.iso;
    }
    metadata.postedLabel = postedDisplay;
  }
  const timestamp = postedDisplay ? `Posted ${escapeHtml2(postedDisplay)}` : year ? `Posted ${escapeHtml2(year)}` : "Posted";
  const likeCount = formatCount(metadata.likes);
  const commentCount = formatCount(metadata.comments);
  if (!dataPosted) {
    dataPosted = postedDisplay || year || "";
  }
  const textSegments = segments.filter((segment) => segment.type === "text").map((segment) => normaliseWhitespace(segment.content)).join(" ").replace(/\s+/g, " ").trim();
  const shareSnippet = createShareSnippet2(textSegments || metadata.postedLabel || void 0);
  const anchorId = buildPostAnchorId(slug, metadata, shareSnippet);
  const shareLabel = metadata.postedLabel || year ? `Share YouTube community post (${metadata.postedLabel ?? year})` : "Share YouTube community post";
  const shareAttributes = [
    'type="button"',
    'class="yt-community-post__share article-share__button"',
    `aria-label="${escapeAttribute2(shareLabel)}"`,
    `data-share-url="#${escapeAttribute2(anchorId)}"`,
    `data-share-title="${escapeAttribute2(`${channelName} community post`)}"`
  ];
  if (shareSnippet) {
    shareAttributes.push(`data-share-text="${escapeAttribute2(shareSnippet)}"`);
  }
  shareAttributes.push('data-share-copied="URL copied"');
  const shareMarkup = `<div class="yt-community-post__share-container article-share">
      <button ${shareAttributes.join(" ")}>
        <span class="yt-community-post__share-icon" aria-hidden="true"></span>
      </button>
      <span class="article-share__feedback" aria-live="polite"></span>
    </div>`;
  const bodySection = bodyHtml.trim().length ? `<div class="yt-community-post__body">
      ${bodyHtml}
    </div>` : "";
  return `<article class="yt-community-post" id="${escapeAttribute2(anchorId)}" data-posted="${escapeAttribute2(dataPosted)}">
  <span class="yt-community-post__avatar">
    <img src="${escapeAttribute2(avatarSrc)}" alt="${escapeAttribute2(channelName)}" loading="lazy" width="48" height="48" />
  </span>
  <div class="yt-community-post__content">
    <div class="yt-community-post__header">
      <div class="yt-community-post__identity">
        <span class="yt-community-post__channel">${escapeHtml2(channelName)}</span>
        <span class="yt-community-post__timestamp">${timestamp}</span>
      </div>
      ${shareMarkup}
    </div>
    ${bodySection}
    <footer class="yt-community-post__footer">
      <div class="yt-community-post__actions" aria-hidden="true">
        <span class="yt-community-post__action">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14 1 7.59 7.41C7.22 7.78 7 8.3 7 8.83V19c0 1.1.9 2 2 2h8c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
          ${likeCount !== void 0 ? `<span class="yt-community-post__count">${escapeHtml2(likeCount)}</span>` : ""}
        </span>
        <span class="yt-community-post__action">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12l5 4V5c0-1.1-.9-2-2-2h-3z" /></svg>
          ${commentCount !== void 0 ? `<span class="yt-community-post__count">${escapeHtml2(commentCount)}</span>` : ""}
        </span>
      </div>
    </footer>
  </div>
</article>`;
}, "renderPost");
var YT_COMMUNITY_CSS = `
.yt-community-post {
  background: #202020;
  border: 1px solid #2f2f2f;
  border-radius: 16px;
  padding: 13px 18px 16px;
  color: #f1f1f1;
  max-width: min(640px, 100%);
  font-family: "Roboto", "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  scroll-margin-top: 120px;
  transition: box-shadow 0.24s ease;
}

.yt-community-post + .yt-community-post {
  margin-top: 20px;
}

.yt-community-post__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  row-gap: 4px;
  flex-wrap: wrap;
  width: 100%;
}
.yt-community-post__identity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  line-height: 1;
}

.yt-community-post__avatar {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background-color: transparent;
}

.yt-community-post__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  margin: 0;
  padding: 0;
}

.yt-community-post__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.yt-community-post__channel {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1;
}

.yt-community-post__timestamp {
  color: #a7a7a7;
  font-size: 0.78rem;
  line-height: 1;
}

.yt-community-post__share-container.article-share {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.yt-community-post__share-container.article-share .article-share__feedback {
  min-height: 0.8rem;
  text-align: right;
}

.yt-community-post__share.article-share__button {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
  transition: background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
}

.yt-community-post:hover .yt-community-post__share.article-share__button,
.yt-community-post__share.article-share__button:focus-visible {
  opacity: 1;
}

.yt-community-post__share.article-share__button:hover {
  color: var(--color-accent-deep);
}

.yt-community-post__share.article-share__button:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.yt-community-post__share-icon {
  width: 18px;
  height: 18px;
  display: block;
  background-color: currentColor;
  mask-image: url(/static/icons/share_icon.svg);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: url(/static/icons/share_icon.svg);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}

.yt-community-post__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.93rem;
}

.yt-community-post__text {
  line-height: 1.48;
  white-space: normal;
  word-break: break-word;
}

.yt-community-post__text br {
  content: "";
}

.yt-community-post__embed {
  margin: 0;
  padding: 0;
}

.yt-community-post__embed img {
  border-radius: 12px;
  width: 100%;
  height: auto;
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.yt-community-post__footer {
  margin-top: 4px;
}

.yt-community-post__actions {
  display: flex;
  gap: 16px;
  color: #b0b0b0;
  font-size: 0.82rem;
  pointer-events: none;
  user-select: none;
}

.yt-community-post__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: 0.9;
}

.yt-community-post__action svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.yt-community-post__count {
  font-size: 0.78rem;
  color: #cecece;
}

@media (hover: none) {
  .yt-community-post__share.article-share__button {
    opacity: 1;
  }
}

@keyframes yt-community-post-target {
  0% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0.55), 0 0 0 rgba(235, 28, 36, 0.12);
  }
  35% {
    box-shadow: 0 0 0 6px rgba(235, 28, 36, 0.3), 0 0 30px rgba(235, 28, 36, 0.45);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0);
  }
}

.yt-community-post:target {
  animation: yt-community-post-target 1.6s ease-out;
  box-shadow: 0 0 0 2px rgba(235, 28, 36, 0.45), 0 0 28px rgba(235, 28, 36, 0.32);
}

.yt-community-post:target .yt-community-post__share.article-share__button {
  opacity: 1;
}
`;
var YouTubeCommunityPosts = /* @__PURE__ */ __name(() => {
  return {
    name: "YouTubeCommunityPosts",
    markdownPlugins() {
      return [
        () => async (tree, file) => {
          const slug = typeof file?.data?.slug === "string" ? file.data.slug : void 0;
          if (!slug) {
            return;
          }
          const slugLower = slug.toLowerCase();
          const isCanonicalPage = slugLower === TARGET_SLUG;
          const root = tree;
          if (!Array.isArray(root.children)) {
            return;
          }
          let currentYear;
          for (let idx = 0; idx < root.children.length; idx++) {
            const child = root.children[idx];
            if (!child || typeof child !== "object") {
              continue;
            }
            if (isCanonicalPage && child.type === "heading" && Array.isArray(child.children)) {
              const text = collectText(child).toLowerCase();
              const match = text.match(/from\s+(\d{4})/);
              currentYear = match ? match[1] : currentYear;
              continue;
            }
            if (child.type !== "code") {
              continue;
            }
            const langRaw = typeof child.lang === "string" ? child.lang.trim() : "";
            const metaRaw = typeof child.meta === "string" ? child.meta.trim() : "";
            const headerRaw = [langRaw, metaRaw].filter((segment) => segment.length > 0).join(",");
            const headerResult = parseCommunityPostHeader(headerRaw);
            if (!headerResult) {
              continue;
            }
            const channelHandle = headerResult.metadata.channelHandle || DEFAULT_CHANNEL_HANDLE;
            const channelProfile = await getChannelProfile(channelHandle);
            let value = typeof child.value === "string" ? child.value : "";
            if (headerResult.inlineBody) {
              value = value.length > 0 ? `${headerResult.inlineBody}
${value}` : headerResult.inlineBody;
            }
            const html = renderPost({
              content: value,
              year: currentYear,
              slug,
              metadataHint: headerResult.metadata,
              channelProfile
            });
            if (!html) {
              continue;
            }
            root.children.splice(idx, 1, {
              type: "html",
              value: html
            });
          }
        }
      ];
    },
    externalResources() {
      return {
        css: [
          {
            content: YT_COMMUNITY_CSS,
            inline: true
          }
        ]
      };
    }
  };
}, "YouTubeCommunityPosts");

// quartz/plugins/transformers/infobox.ts
import { SKIP as SKIP2, visit as visit6 } from "unist-util-visit";
var normalizeWhitespace = /* @__PURE__ */ __name((value) => value.replace(/\s+/g, " ").trim(), "normalizeWhitespace");
var splitListValues = /* @__PURE__ */ __name((raw) => {
  if (!raw) {
    return [];
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  const parts = trimmed.split(/(?<!\\);/).map((part) => part.replace(/\\;/g, ";").trim()).filter((part) => part.length > 0);
  if (parts.length > 0) {
    return parts;
  }
  return [trimmed];
}, "splitListValues");
var parseInfoboxBlock = /* @__PURE__ */ __name((raw) => {
  const lines = raw.split(/\r?\n/);
  let title;
  const image = {};
  const items = [];
  let currentItem = null;
  for (const originalLine of lines) {
    const trimmed = originalLine.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("#")) {
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(1).trim();
      if (!content || !currentItem) {
        continue;
      }
      currentItem.values.push(content);
      continue;
    }
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const keyRaw = trimmed.slice(0, colonIndex).trim();
    const valueRaw = trimmed.slice(colonIndex + 1).trim();
    const key = keyRaw.toLowerCase();
    switch (key) {
      case "title": {
        title = valueRaw ? normalizeWhitespace(valueRaw) : void 0;
        currentItem = null;
        break;
      }
      case "image":
      case "image src":
      case "media": {
        image.src = valueRaw;
        currentItem = null;
        break;
      }
      case "image alt":
      case "alt": {
        image.alt = valueRaw ? normalizeWhitespace(valueRaw) : void 0;
        currentItem = null;
        break;
      }
      case "image caption":
      case "caption": {
        image.caption = valueRaw;
        currentItem = null;
        break;
      }
      default: {
        const values = splitListValues(valueRaw);
        const item = {
          label: keyRaw,
          values
        };
        items.push(item);
        currentItem = item;
        break;
      }
    }
  }
  const normalizedItems = items.map(({ label, values }) => {
    const distinct = values.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    if (distinct.length === 0) {
      return null;
    }
    return {
      label,
      value: distinct.length === 1 ? distinct[0] : distinct
    };
  }).filter((entry) => entry !== null);
  const hasImage = Boolean(image.src || image.alt || image.caption);
  const hasContent = Boolean(title || hasImage || normalizedItems.length > 0);
  if (!hasContent) {
    return null;
  }
  return {
    title,
    image: hasImage ? image : void 0,
    items: normalizedItems.map(({ label, value }) => ({
      label,
      value
    }))
  };
}, "parseInfoboxBlock");
var InfoboxBlock = /* @__PURE__ */ __name(() => {
  return {
    name: "InfoboxBlock",
    markdownPlugins() {
      return [
        () => (tree, file) => {
          let infoboxCaptured = false;
          visit6(tree, "code", (node, index, parent) => {
            const language = typeof node.lang === "string" ? node.lang.toLowerCase() : "";
            if (language !== "infobox") {
              return;
            }
            if (infoboxCaptured) {
              return;
            }
            const raw = typeof node.value === "string" ? node.value : "";
            const parsed = parseInfoboxBlock(raw);
            if (!parsed) {
              if (parent && typeof index === "number") {
                parent.children.splice(index, 1);
                return [SKIP2, index];
              }
              return;
            }
            file.data.infobox = parsed;
            file.data.infoboxSource = "code-block";
            infoboxCaptured = true;
            if (parent && typeof index === "number") {
              parent.children.splice(index, 1);
              return [SKIP2, index];
            }
          });
        }
      ];
    }
  };
}, "InfoboxBlock");

// quartz/plugins/transformers/mediaBox.ts
var OBSIDIAN_EMBED_PATTERN2 = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/;
var MEDIA_LANG_ALIASES = /* @__PURE__ */ new Set(["media-box", "image-box"]);
var keyMap = {
  title: "title",
  heading: "title",
  label: "title",
  media: "src",
  source: "src",
  image: "src",
  src: "src",
  file: "src",
  path: "src",
  alt: "alt",
  description: "caption",
  caption: "caption",
  credit: "credit",
  photographer: "credit",
  author: "credit",
  align: "align",
  alignment: "align",
  position: "align",
  wrap: "wrap",
  float: "wrap",
  width: "width",
  size: "width",
  link: "link",
  href: "link",
  type: "type",
  kind: "type",
  media_type: "type",
  poster: "poster",
  thumbnail: "poster",
  cover: "poster",
  autoplay: "autoplay",
  loop: "loop",
  muted: "muted"
};
var isExternalUrl3 = /* @__PURE__ */ __name((value) => /^(https?:)?\/\//i.test(value) || value.startsWith("data:"), "isExternalUrl");
var stripContentPrefix3 = /* @__PURE__ */ __name((target) => target.replace(/^[./]+/, "").replace(/^content\//i, ""), "stripContentPrefix");
var escapeHtml3 = /* @__PURE__ */ __name((value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"), "escapeHtml");
var escapeAttribute3 = /* @__PURE__ */ __name((value) => escapeHtml3(value), "escapeAttribute");
var sanitizeMultiline = /* @__PURE__ */ __name((lines) => lines.map((line) => line.trimEnd()).join("\n").trim(), "sanitizeMultiline");
var appendAssetVersion2 = /* @__PURE__ */ __name((url, version) => {
  if (!version) {
    return url;
  }
  return url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
}, "appendAssetVersion");
var resolveObsidianTarget3 = /* @__PURE__ */ __name((rawTarget, slug) => {
  const cleaned = rawTarget.trim();
  if (!cleaned) {
    return void 0;
  }
  if (isExternalUrl3(cleaned)) {
    return cleaned;
  }
  try {
    let targetPath = stripContentPrefix3(cleaned);
    if (!targetPath.includes("/")) {
      const matched = findAssetByBasename(targetPath);
      if (matched) {
        targetPath = matched;
      }
    }
    const targetSlug = slugifyFilePath(targetPath);
    if (!slug) {
      return appendAssetVersion2(targetSlug, getAssetVersion());
    }
    const baseDir = pathToRoot(slug);
    return appendAssetVersion2(joinSegments(baseDir, targetSlug), getAssetVersion());
  } catch {
    return cleaned;
  }
}, "resolveObsidianTarget");
var resolveMediaSource = /* @__PURE__ */ __name((raw, slug) => {
  const cleaned = raw.trim();
  if (!cleaned) {
    return void 0;
  }
  const match = cleaned.match(OBSIDIAN_EMBED_PATTERN2);
  if (match?.groups?.target) {
    return resolveObsidianTarget3(match.groups.target, slug);
  }
  if (isExternalUrl3(cleaned)) {
    return cleaned;
  }
  if (cleaned.startsWith("/")) {
    return appendAssetVersion2(cleaned, getAssetVersion());
  }
  if (!slug) {
    return cleaned;
  }
  let targetPath = stripContentPrefix3(cleaned);
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath);
    if (matched) {
      targetPath = matched;
    }
  }
  const targetSlug = slugifyFilePath(targetPath);
  return appendAssetVersion2(joinSegments(pathToRoot(slug), targetSlug), getAssetVersion());
}, "resolveMediaSource");
var resolveLinkTarget = /* @__PURE__ */ __name((raw, slug) => {
  const cleaned = raw.trim();
  if (!cleaned) {
    return void 0;
  }
  const match = cleaned.match(OBSIDIAN_EMBED_PATTERN2);
  if (match?.groups?.target) {
    return resolveObsidianTarget3(match.groups.target, slug) ?? cleaned;
  }
  if (isExternalUrl3(cleaned) || cleaned.startsWith("/")) {
    return cleaned;
  }
  if (!slug) {
    return cleaned;
  }
  let targetPath = stripContentPrefix3(cleaned);
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath);
    if (matched) {
      targetPath = matched;
    }
  }
  const targetSlug = slugifyFilePath(targetPath);
  return joinSegments(pathToRoot(slug), targetSlug);
}, "resolveLinkTarget");
var sanitizeCssValue = /* @__PURE__ */ __name((value) => {
  if (!value) {
    return void 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return void 0;
  }
  if (!/^[0-9a-zA-Z%.,()\s_-]+$/.test(trimmed)) {
    return void 0;
  }
  return trimmed;
}, "sanitizeCssValue");
var parseBoolean = /* @__PURE__ */ __name((value, defaultValue) => {
  if (!value) {
    return defaultValue;
  }
  const normalised = value.trim().toLowerCase();
  if (["true", "yes", "y", "1", "wrap", "on"].includes(normalised)) {
    return true;
  }
  if (["false", "no", "n", "0", "none", "off"].includes(normalised)) {
    return false;
  }
  return defaultValue;
}, "parseBoolean");
var normaliseAlign = /* @__PURE__ */ __name((value) => {
  if (!value) {
    return "center";
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "left" || trimmed === "start") {
    return "left";
  }
  if (trimmed === "right" || trimmed === "end") {
    return "right";
  }
  if (trimmed === "centre") {
    return "center";
  }
  return "center";
}, "normaliseAlign");
var inferMediaType = /* @__PURE__ */ __name((rawType, src) => {
  if (rawType) {
    const normalised = rawType.trim().toLowerCase();
    if (normalised === "video" || normalised === "audio" || normalised === "image") {
      return normalised;
    }
  }
  if (src.startsWith("data:") && src.includes("video")) {
    return "video";
  }
  if (src.startsWith("data:") && src.includes("audio")) {
    return "audio";
  }
  const withoutQuery = src.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(withoutQuery)) {
    return "video";
  }
  if (/\.(mp3|ogg|wav|m4a|flac|aac)$/.test(withoutQuery)) {
    return "audio";
  }
  return "image";
}, "inferMediaType");
var parseMediaBoxBlock = /* @__PURE__ */ __name((raw) => {
  const result = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = null;
  let buffer = [];
  const flushBuffer = /* @__PURE__ */ __name(() => {
    if (!currentKey) {
      buffer = [];
      return;
    }
    const combined = sanitizeMultiline(buffer);
    if (combined.length > 0) {
      result[currentKey] = combined;
    }
    buffer = [];
  }, "flushBuffer");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBuffer();
      currentKey = null;
      continue;
    }
    if (trimmed.startsWith("#")) {
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent > 0 && currentKey) {
      buffer.push(trimmed);
      continue;
    }
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      flushBuffer();
      currentKey = null;
      continue;
    }
    flushBuffer();
    const keyRaw = trimmed.slice(0, colonIndex).trim().toLowerCase();
    if (keyRaw === "video" || keyRaw === "audio") {
      const value2 = trimmed.slice(colonIndex + 1).trim();
      if (value2.length > 0) {
        result.src = value2;
      }
      result.type = keyRaw;
      currentKey = "src";
      buffer = value2 ? [value2] : [];
      continue;
    }
    const mapped = keyMap[keyRaw];
    if (!mapped) {
      currentKey = null;
      continue;
    }
    const value = trimmed.slice(colonIndex + 1).trim();
    result[mapped] = value;
    currentKey = mapped;
    buffer = value ? [value] : [];
  }
  flushBuffer();
  if (!result.src || !result.src.trim()) {
    return null;
  }
  return result;
}, "parseMediaBoxBlock");
var buildMediaMarkup = /* @__PURE__ */ __name((config3) => {
  const buildSourceTag = /* @__PURE__ */ __name((src, mediaType) => {
    const escapedSrc = escapeAttribute3(src);
    const withoutQuery = src.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
    const lookup = {
      image: {},
      video: {
        ".mp4": "video/mp4",
        ".m4v": "video/x-m4v",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".ogv": "video/ogg"
      },
      audio: {
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".oga": "audio/ogg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".flac": "audio/flac"
      }
    };
    let typeAttr = "";
    for (const [extension, mime] of Object.entries(lookup[mediaType])) {
      if (withoutQuery.endsWith(extension)) {
        typeAttr = ` type="${mime}"`;
        break;
      }
    }
    return `<source src="${escapedSrc}"${typeAttr} />`;
  }, "buildSourceTag");
  if (config3.mediaType === "image") {
    const imageTag = `<img src="${escapeAttribute3(config3.src)}" alt="${escapeAttribute3(
      config3.alt || "Media illustration"
    )}" loading="lazy" decoding="async" />`;
    if (config3.link) {
      return `<a class="media-box__link" href="${escapeAttribute3(config3.link)}"${isExternalUrl3(config3.link) ? ' target="_blank" rel="noopener"' : ""}>${imageTag}</a>`;
    }
    return imageTag;
  }
  if (config3.mediaType === "video") {
    const attrs = [
      `src="${escapeAttribute3(config3.src)}"`,
      "controls",
      "playsinline",
      'preload="metadata"',
      `aria-label="${escapeAttribute3(config3.alt || config3.title || "Embedded video")}"`
    ];
    if (config3.poster) {
      attrs.push(`poster="${escapeAttribute3(config3.poster)}"`);
    }
    if (config3.autoplay) {
      attrs.push("autoplay");
    }
    if (config3.muted || config3.autoplay) {
      attrs.push("muted");
    }
    if (config3.loop) {
      attrs.push("loop");
    }
    const fallback2 = escapeHtml3(config3.alt || config3.title || "Your browser cannot play this video.");
    return `<video ${attrs.join(" ")}>${buildSourceTag(config3.src, "video")}${fallback2}</video>`;
  }
  const audioAttrs = [
    `src="${escapeAttribute3(config3.src)}"`,
    "controls",
    'preload="metadata"',
    `aria-label="${escapeAttribute3(config3.alt || config3.title || "Embedded audio")}"`
  ];
  if (config3.autoplay) {
    audioAttrs.push("autoplay");
  }
  if (config3.loop) {
    audioAttrs.push("loop");
  }
  if (config3.muted) {
    audioAttrs.push("muted");
  }
  const fallback = escapeHtml3(config3.alt || config3.title || "Your browser cannot play this audio clip.");
  return `<audio ${audioAttrs.join(" ")}>${buildSourceTag(config3.src, "audio")}${fallback}</audio>`;
}, "buildMediaMarkup");
var buildMediaBoxHtml = /* @__PURE__ */ __name((config3) => {
  const classes = [
    "media-box",
    `media-box--align-${config3.align}`,
    `media-box--type-${config3.mediaType}`
  ];
  if (config3.wrap) {
    classes.push("media-box--wrap");
  } else {
    classes.push("media-box--no-wrap");
  }
  const styleParts = [];
  if (config3.width) {
    styleParts.push(`max-width: ${config3.width}`);
  }
  const styleAttr = styleParts.length > 0 ? ` style="${escapeAttribute3(styleParts.join("; "))}"` : "";
  const titleMarkup = config3.title ? `<header class="media-box__title">${escapeHtml3(config3.title)}</header>` : "";
  const mediaMarkup = buildMediaMarkup(config3);
  const captionParts = [];
  if (config3.caption) {
    const captionHtml = escapeHtml3(config3.caption).replace(/\r?\n/g, "<br />");
    captionParts.push(`<span class="media-box__caption-text">${captionHtml}</span>`);
  }
  if (config3.credit) {
    const creditHtml = escapeHtml3(config3.credit).replace(/\r?\n/g, "<br />");
    captionParts.push(`<span class="media-box__credit">${creditHtml}</span>`);
  }
  const captionMarkup = captionParts.length > 0 ? `<figcaption class="media-box__caption">${captionParts.join("")}</figcaption>` : "";
  return `<figure class="${classes.join(" ")}"${styleAttr}>${titleMarkup}<div class="media-box__media">${mediaMarkup}</div>${captionMarkup}</figure>`;
}, "buildMediaBoxHtml");
var MEDIA_BOX_CSS = `
.media-box {
  --media-box-background: color-mix(in srgb, var(--color-surface-overlay) 92%, transparent);
  background: var(--media-box-background);
  border: 1px solid color-mix(in srgb, var(--color-tone-muted) 35%, transparent);
  border-radius: 14px;
  padding: 0.9rem 0.95rem 1.05rem;
  display: grid;
  gap: 0.65rem;
  box-shadow: 0 1.15rem 2.1rem rgba(0, 0, 0, 0.14);
  margin: 1.75rem auto;
  max-width: min(100%, 420px);
  color: var(--color-tone-contrast);
}

.media-box__title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: center;
  margin: 0;
  color: var(--color-tone-primary);
}

.media-box__media {
  display: block;
}

.media-box__media img,
.media-box__media video,
.media-box__media audio {
  width: 100%;
  height: auto;
  border-radius: 10px;
  box-shadow: 0 0.75rem 1.45rem rgba(0, 0, 0, 0.18);
  display: block;
}

.media-box__media audio {
  box-shadow: none;
  border-radius: 8px;
}

.media-box__link {
  display: block;
}

.media-box__caption {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--color-tone-muted) 78%, var(--color-tone-contrast) 22%);
}

.media-box__caption-text {
  display: block;
}

.media-box__credit {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 85%, var(--color-tone-primary) 15%);
}

.media-box--align-left.media-box--wrap {
  float: left;
  margin: 0 1.5rem 1.25rem 0;
}

.media-box--align-right.media-box--wrap {
  float: right;
  margin: 0 0 1.25rem 1.5rem;
}

.media-box--align-center {
  margin-left: auto;
  margin-right: auto;
}

.media-box--align-left.media-box--no-wrap {
  margin-left: 0;
  margin-right: auto;
}

.media-box--align-right.media-box--no-wrap {
  margin-left: auto;
  margin-right: 0;
}

.media-box--wrap {
  max-width: min(100%, 340px);
}

.media-box--type-audio .media-box__media {
  padding-inline: clamp(0.4rem, 2vw, 1rem);
}

.media-box-cluster {
  margin: 1.75rem auto;
}

.media-box-cluster--inline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  align-items: start;
}

.media-box-cluster--inline .media-box {
  margin: 0;
  float: none;
}

.media-box-cluster--inline .media-box--align-left {
  justify-self: start;
}

.media-box-cluster--inline .media-box--align-center {
  justify-self: center;
}

.media-box-cluster--inline .media-box--align-right {
  justify-self: end;
}

@media (min-width: 901px) {
  .media-box-cluster--inline.media-box-cluster--three {
    grid-template-columns: repeat(3, minmax(220px, 1fr));
  }
}

@media (max-width: 900px) {
  .media-box--wrap {
    float: none !important;
    margin: 1.5rem auto !important;
  }

  .media-box-cluster--inline {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .media-box-cluster--inline .media-box {
    justify-self: center;
    max-width: min(100%, 420px);
  }
}
`;
var isMediaBoxCodeNode = /* @__PURE__ */ __name((node) => {
  if (!node || typeof node !== "object") {
    return false;
  }
  const maybe = node;
  if (maybe.type !== "code") {
    return false;
  }
  const lang = typeof maybe.lang === "string" ? maybe.lang.toLowerCase() : "";
  return MEDIA_LANG_ALIASES.has(lang);
}, "isMediaBoxCodeNode");
var createHtmlNode = /* @__PURE__ */ __name((value) => ({
  type: "html",
  value
}), "createHtmlNode");
var toMediaBoxConfig = /* @__PURE__ */ __name((node, slug) => {
  const raw = typeof node.value === "string" ? node.value : "";
  const parsed = parseMediaBoxBlock(raw);
  if (!parsed) {
    return null;
  }
  const srcResolved = resolveMediaSource(parsed.src ?? "", slug);
  if (!srcResolved) {
    return null;
  }
  const posterResolved = parsed.poster ? resolveMediaSource(parsed.poster, slug) : void 0;
  const mediaType = inferMediaType(parsed.type, srcResolved);
  const align = normaliseAlign(parsed.align);
  const wrap = parseBoolean(parsed.wrap, align !== "center");
  const width = sanitizeCssValue(parsed.width);
  const linkRaw = parsed.link ? parsed.link.trim() : void 0;
  const linkResolved = linkRaw ? resolveLinkTarget(linkRaw, slug) : void 0;
  return {
    title: parsed.title?.trim() || void 0,
    src: srcResolved,
    alt: parsed.alt?.trim() || void 0,
    caption: parsed.caption?.trim() || void 0,
    credit: parsed.credit?.trim() || void 0,
    align,
    wrap,
    width,
    link: mediaType === "image" && linkResolved && linkResolved.length > 0 ? linkResolved : void 0,
    mediaType,
    poster: posterResolved,
    autoplay: parseBoolean(parsed.autoplay, false),
    loop: parseBoolean(parsed.loop, false),
    muted: parseBoolean(parsed.muted, false)
  };
}, "toMediaBoxConfig");
var transformMediaBoxes = /* @__PURE__ */ __name((tree, slug) => {
  const process3 = /* @__PURE__ */ __name((node) => {
    if (!node || typeof node !== "object" || !Array.isArray(node.children)) {
      return;
    }
    const children = node.children;
    for (let index = 0; index < children.length; ) {
      const child = children[index];
      if (!isMediaBoxCodeNode(child)) {
        process3(child);
        index += 1;
        continue;
      }
      const group = [];
      let cursor = index;
      while (cursor < children.length) {
        const candidate = children[cursor];
        if (!isMediaBoxCodeNode(candidate)) {
          break;
        }
        group.push(candidate);
        cursor += 1;
      }
      const configs = group.map((code) => toMediaBoxConfig(code, slug));
      const validEntries = configs.filter((config3) => config3 !== null);
      if (validEntries.length === 0) {
        children.splice(index, group.length);
        continue;
      }
      const htmlFigures = validEntries.map((config3) => buildMediaBoxHtml(config3));
      const allNoWrap = validEntries.every((config3) => !config3.wrap);
      let replacements;
      if (validEntries.length > 1 && allNoWrap) {
        const alignSignature = validEntries.map((config3) => config3.align).join("|");
        let clusterClass = "media-box-cluster media-box-cluster--inline";
        if (validEntries.length === 3 && alignSignature === "left|center|right") {
          clusterClass += " media-box-cluster--three";
        }
        replacements = [
          createHtmlNode(`<div class="${clusterClass}">${htmlFigures.join("")}</div>`)
        ];
      } else {
        replacements = htmlFigures.map((value) => createHtmlNode(value));
      }
      children.splice(index, group.length, ...replacements);
      index += replacements.length;
    }
  }, "process");
  process3(tree);
}, "transformMediaBoxes");
var MediaBox = /* @__PURE__ */ __name(() => {
  return {
    name: "MediaBox",
    markdownPlugins() {
      return [
        () => (tree, file) => {
          const slug = typeof file?.data?.slug === "string" ? file.data.slug : void 0;
          transformMediaBoxes(tree, slug);
        }
      ];
    },
    externalResources() {
      return {
        css: [
          {
            inline: true,
            content: MEDIA_BOX_CSS
          }
        ]
      };
    }
  };
}, "MediaBox");

// quartz/plugins/filters/draft.ts
var RemoveDrafts = /* @__PURE__ */ __name(() => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [_tree, vfile]) {
    const draftFlag = vfile.data?.frontmatter?.draft === true || vfile.data?.frontmatter?.draft === "true";
    return !draftFlag;
  }
}), "RemoveDrafts");

// quartz/plugins/emitters/contentPage.tsx
import path7 from "path";

// quartz/components/Header.tsx
import { jsx } from "preact/jsx-runtime";
var Header = /* @__PURE__ */ __name(({ children }) => {
  const hasChildren = Array.isArray(children) ? children.length > 0 : children !== null && children !== void 0 && children !== false;
  return hasChildren ? /* @__PURE__ */ jsx("header", { children }) : null;
}, "Header");
Header.css = `
header {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 2rem 0;
  gap: 1.5rem;
}

header h1 {
  margin: 0;
  flex: auto;
}
`;
var Header_default = /* @__PURE__ */ __name((() => Header), "default");

// quartz/components/scripts/clipboard.inline.ts
var clipboard_inline_default = "";

// quartz/components/styles/clipboard.scss
var clipboard_default = "";

// quartz/components/Body.tsx
import { jsx as jsx2 } from "preact/jsx-runtime";
var Body = /* @__PURE__ */ __name(({ children }) => {
  return /* @__PURE__ */ jsx2("div", { id: "quartz-body", children });
}, "Body");
Body.afterDOMLoaded = clipboard_inline_default;
Body.css = clipboard_default;
var Body_default = /* @__PURE__ */ __name((() => Body), "default");

// quartz/components/renderPage.tsx
import { Fragment } from "preact";
import { render } from "preact-render-to-string";

// quartz/util/resources.tsx
import { randomUUID } from "crypto";
import { jsx as jsx3 } from "preact/jsx-runtime";
function JSResourceToScriptElement(resource, preserve) {
  const scriptType = resource.moduleType ?? "application/javascript";
  const spaPreserve = preserve ?? resource.spaPreserve;
  if (resource.contentType === "external") {
    return /* @__PURE__ */ jsx3("script", { src: resource.src, type: scriptType, "spa-preserve": spaPreserve }, resource.src);
  } else {
    const content = resource.script;
    return /* @__PURE__ */ jsx3(
      "script",
      {
        type: scriptType,
        "spa-preserve": spaPreserve,
        dangerouslySetInnerHTML: { __html: content }
      },
      randomUUID()
    );
  }
}
__name(JSResourceToScriptElement, "JSResourceToScriptElement");
function CSSResourceToStyleElement(resource, preserve) {
  const spaPreserve = preserve ?? resource.spaPreserve;
  if (resource.inline ?? false) {
    return /* @__PURE__ */ jsx3("style", { children: resource.content });
  } else {
    return /* @__PURE__ */ jsx3(
      "link",
      {
        href: resource.content,
        rel: "stylesheet",
        type: "text/css",
        "spa-preserve": spaPreserve
      },
      resource.content
    );
  }
}
__name(CSSResourceToStyleElement, "CSSResourceToStyleElement");
function concatenateResources(...resources) {
  return resources.filter((resource) => resource !== void 0).flat();
}
__name(concatenateResources, "concatenateResources");

// quartz/components/renderPage.tsx
import { visit as visit7 } from "unist-util-visit";
import { jsx as jsx4, jsxs } from "preact/jsx-runtime";
import { createElement } from "preact";
var headerRegex = new RegExp(/h[1-6]/);
function pageResources(baseDir, staticResources) {
  const assetVersion = getAssetVersion();
  const versioned = /* @__PURE__ */ __name((path14) => `${path14}?v=${assetVersion}`, "versioned");
  const contentIndexPath = versioned(joinSegments(baseDir, "static/contentIndex.json"));
  const contentIndexScript = `const fetchData = fetch("${contentIndexPath}").then(data => data.json())`;
  const resources = {
    css: [
      {
        content: versioned(joinSegments(baseDir, "index.css"))
      },
      ...staticResources.css
    ],
    js: [
      {
        src: versioned(joinSegments(baseDir, "prescript.js")),
        loadTime: "beforeDOMReady",
        contentType: "external"
      },
      {
        loadTime: "beforeDOMReady",
        contentType: "inline",
        spaPreserve: true,
        script: contentIndexScript
      },
      ...staticResources.js
    ],
    additionalHead: staticResources.additionalHead
  };
  resources.js.push({
    src: versioned(joinSegments(baseDir, "postscript.js")),
    loadTime: "afterDOMReady",
    moduleType: "module",
    contentType: "external"
  });
  return resources;
}
__name(pageResources, "pageResources");
function renderTranscludes(root, cfg, slug, componentData) {
  visit7(root, "element", (node, _index, _parent) => {
    if (node.tagName === "blockquote") {
      const classNames2 = node.properties?.className ?? [];
      if (classNames2.includes("transclude")) {
        const inner = node.children[0];
        const transcludeTarget = inner.properties["data-slug"] ?? slug;
        const page = componentData.allFiles.find((f) => f.slug === transcludeTarget);
        if (!page) {
          return;
        }
        let blockRef = node.properties.dataBlock;
        if (blockRef?.startsWith("#^")) {
          blockRef = blockRef.slice("#^".length);
          let blockNode = page.blocks?.[blockRef];
          if (blockNode) {
            if (blockNode.tagName === "li") {
              blockNode = {
                type: "element",
                tagName: "ul",
                properties: {},
                children: [blockNode]
              };
            }
            node.children = [
              normalizeHastElement(blockNode, slug, transcludeTarget),
              {
                type: "element",
                tagName: "a",
                properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
                children: [
                  { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal }
                ]
              }
            ];
          }
        } else if (blockRef?.startsWith("#") && page.htmlAst) {
          blockRef = blockRef.slice(1);
          let startIdx = void 0;
          let startDepth = void 0;
          let endIdx = void 0;
          for (const [i, el] of page.htmlAst.children.entries()) {
            if (!(el.type === "element" && el.tagName.match(headerRegex))) continue;
            const depth = Number(el.tagName.substring(1));
            if (startIdx === void 0 || startDepth === void 0) {
              if (el.properties?.id === blockRef) {
                startIdx = i;
                startDepth = depth;
              }
            } else if (depth <= startDepth) {
              endIdx = i;
              break;
            }
          }
          if (startIdx === void 0) {
            return;
          }
          node.children = [
            ...page.htmlAst.children.slice(startIdx, endIdx).map(
              (child) => normalizeHastElement(child, slug, transcludeTarget)
            ),
            {
              type: "element",
              tagName: "a",
              properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
              children: [
                { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal }
              ]
            }
          ];
        } else if (page.htmlAst) {
          node.children = [
            {
              type: "element",
              tagName: "h1",
              properties: {},
              children: [
                {
                  type: "text",
                  value: page.frontmatter?.title ?? i18n(cfg.locale).components.transcludes.transcludeOf({
                    targetSlug: page.slug
                  })
                }
              ]
            },
            ...page.htmlAst.children.map(
              (child) => normalizeHastElement(child, slug, transcludeTarget)
            ),
            {
              type: "element",
              tagName: "a",
              properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
              children: [
                { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal }
              ]
            }
          ];
        }
      }
    }
  });
}
__name(renderTranscludes, "renderTranscludes");
function renderPage(cfg, slug, componentData, components, pageResources2) {
  const root = clone(componentData.tree);
  renderTranscludes(root, cfg, slug, componentData);
  componentData.tree = root;
  const {
    head: Head,
    header,
    beforeBody,
    pageBody: Content2,
    afterBody,
    left,
    right,
    footer: Footer
  } = components;
  const Header2 = Header_default();
  const Body2 = Body_default();
  const renderQuartzComponent = /* @__PURE__ */ __name((component, props) => {
    if (typeof component === "function") {
      if (component.prototype && typeof component.prototype.render === "function") {
        const instance = new component(props);
        return instance?.render?.() ?? null;
      }
      return component(props);
    }
    return null;
  }, "renderQuartzComponent");
  const resolveToArray = /* @__PURE__ */ __name((node) => {
    if (node === null || node === void 0) {
      return [];
    }
    if (Array.isArray(node)) {
      return node.flatMap((child) => resolveToArray(child));
    }
    if (typeof node.type === "function") {
      const renderedChild = renderQuartzComponent(node.type, {
        ...node.props
      });
      return resolveToArray(renderedChild);
    }
    return [node];
  }, "resolveToArray");
  const renderedAfterBody = afterBody.flatMap(
    (BodyComponent) => resolveToArray(renderQuartzComponent(BodyComponent, { ...componentData }))
  );
  const mobileBacklinksNodes = [];
  const commentNodes = [];
  const footerNodes = [];
  for (const node of renderedAfterBody) {
    const nodeClass = typeof node?.props?.class === "string" ? node.props.class : "";
    const classList = new Set(nodeClass.split(/\s+/).filter(Boolean));
    if (classList.has("backlinks") && classList.has("mobile-only")) {
      mobileBacklinksNodes.push(node);
    } else if (classList.has("community-hub")) {
      commentNodes.push(node);
    } else {
      footerNodes.push(node);
    }
  }
  const commentsFragment = commentNodes.length > 0 ? /* @__PURE__ */ jsx4(Fragment, { children: commentNodes.map((node, index) => /* @__PURE__ */ jsx4(Fragment, { children: node }, `footer-comment-${index}`)) }) : /* @__PURE__ */ jsx4(Fragment, {});
  const LeftComponent = /* @__PURE__ */ jsx4("div", { class: "left sidebar", children: left.map((BodyComponent, index) => /* @__PURE__ */ createElement(
    BodyComponent,
    {
      ...componentData,
      key: BodyComponent.name ?? `left-${index}`
    }
  )) });
  const RightComponent = /* @__PURE__ */ jsx4("div", { class: "right sidebar", children: right.map((BodyComponent, index) => /* @__PURE__ */ createElement(
    BodyComponent,
    {
      ...componentData,
      key: BodyComponent.name ?? `right-${index}`
    }
  )) });
  const lang = componentData.fileData.frontmatter?.lang ?? cfg.locale?.split("-")[0] ?? "en";
  const direction = i18n(cfg.locale).direction ?? "ltr";
  const doc = /* @__PURE__ */ jsxs("html", { lang, dir: direction, "saved-theme": "dark", children: [
    /* @__PURE__ */ jsx4(Head, { ...componentData }),
    /* @__PURE__ */ jsx4("body", { "data-slug": slug, children: /* @__PURE__ */ jsx4("div", { id: "quartz-root", class: "page", children: /* @__PURE__ */ jsxs(Body2, { ...componentData, children: [
      LeftComponent,
      /* @__PURE__ */ jsxs("div", { class: "center", children: [
        /* @__PURE__ */ jsxs("div", { class: "page-header", children: [
          /* @__PURE__ */ jsx4(Header2, { ...componentData, children: header.map((HeaderComponent, index) => /* @__PURE__ */ createElement(
            HeaderComponent,
            {
              ...componentData,
              key: HeaderComponent.name ?? `header-${index}`
            }
          )) }),
          /* @__PURE__ */ jsx4("div", { class: "popover-hint", children: beforeBody.map((BodyComponent, index) => /* @__PURE__ */ createElement(
            BodyComponent,
            {
              ...componentData,
              key: BodyComponent.name ?? `before-${index}`
            }
          )) })
        ] }),
        /* @__PURE__ */ jsx4(Content2, { ...componentData }),
        mobileBacklinksNodes,
        footerNodes.length > 0 ? /* @__PURE__ */ jsx4("div", { class: "page-footer", children: footerNodes }) : null
      ] }),
      commentsFragment,
      RightComponent,
      /* @__PURE__ */ jsx4(Footer, { ...componentData })
    ] }) }) }),
    pageResources2.js.filter((resource) => resource.loadTime === "afterDOMReady").map((res) => JSResourceToScriptElement(res))
  ] });
  return "<!DOCTYPE html>\n" + render(doc);
}
__name(renderPage, "renderPage");

// quartz/util/jsx.tsx
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment as Fragment2, jsx as jsx5, jsxs as jsxs2 } from "preact/jsx-runtime";

// quartz/util/trace.ts
import { styleText } from "util";
import process2 from "process";
import { isMainThread } from "workerpool";
var rootFile = /.*at file:/;
function trace(msg, err) {
  let stack = err.stack ?? "";
  const lines = [];
  lines.push("");
  lines.push(
    "\n" + styleText(["bgRed", "black", "bold"], " ERROR ") + "\n\n" + styleText("red", ` ${msg}`) + (err.message.length > 0 ? `: ${err.message}` : "")
  );
  let reachedEndOfLegibleTrace = false;
  for (const line of stack.split("\n").slice(1)) {
    if (reachedEndOfLegibleTrace) {
      break;
    }
    if (!line.includes("node_modules")) {
      lines.push(` ${line}`);
      if (rootFile.test(line)) {
        reachedEndOfLegibleTrace = true;
      }
    }
  }
  const traceMsg = lines.join("\n");
  if (!isMainThread) {
    throw new Error(traceMsg);
  } else {
    console.error(traceMsg);
    process2.exit(1);
  }
}
__name(trace, "trace");

// quartz/util/jsx.tsx
import { jsx as jsx6 } from "preact/jsx-runtime";
var customComponents = {
  table: /* @__PURE__ */ __name((props) => /* @__PURE__ */ jsx6("div", { class: "table-container", children: /* @__PURE__ */ jsx6("table", { ...props }) }), "table")
};
function htmlToJsx(fp, tree) {
  try {
    return toJsxRuntime(tree, {
      Fragment: Fragment2,
      jsx: jsx5,
      jsxs: jsxs2,
      elementAttributeNameCase: "html",
      components: customComponents
    });
  } catch (e) {
    trace(`Failed to parse Markdown in \`${fp}\` into JSX`, e);
  }
}
__name(htmlToJsx, "htmlToJsx");

// quartz/components/pages/Content.tsx
import { jsx as jsx7 } from "preact/jsx-runtime";
var Content = /* @__PURE__ */ __name(({ fileData, tree }) => {
  const content = htmlToJsx(fileData.filePath, tree);
  const classes = fileData.frontmatter?.cssclasses ?? [];
  const classString = ["popover-hint", ...classes].join(" ");
  return /* @__PURE__ */ jsx7("article", { class: classString, children: content });
}, "Content");
var Content_default = /* @__PURE__ */ __name((() => Content), "default");

// quartz/components/styles/listPage.scss
var listPage_default = "";

// quartz/components/styles/folderDirectory.scss
var folderDirectory_default = "";

// quartz/components/Date.tsx
import { Fragment as Fragment3, jsx as jsx8 } from "preact/jsx-runtime";
function getDate(cfg, data) {
  if (!cfg.defaultDateType) {
    throw new Error(
      `Field 'defaultDateType' was not set in the configuration object of quartz.config.ts. See https://quartz.jzhao.xyz/configuration#general-configuration for more details.`
    );
  }
  return data.dates?.[cfg.defaultDateType];
}
__name(getDate, "getDate");
function formatDate(d, locale = "en-US") {
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}
__name(formatDate, "formatDate");
function Date2({ date, locale }) {
  if (!date) return /* @__PURE__ */ jsx8(Fragment3, {});
  return /* @__PURE__ */ jsx8("time", { datetime: date.toISOString(), children: formatDate(date, locale) });
}
__name(Date2, "Date");

// quartz/components/PageList.tsx
import { jsx as jsx9, jsxs as jsxs3 } from "preact/jsx-runtime";
function byDateAndAlphabetical(cfg) {
  return (f1, f2) => {
    if (f1.dates && f2.dates) {
      const d1 = getDate(cfg, f1);
      const d2 = getDate(cfg, f2);
      if (d1 && d2) {
        return d2.getTime() - d1.getTime();
      } else if (d1 && !d2) {
        return -1;
      } else if (!d1 && d2) {
        return 1;
      }
    } else if (f1.dates && !f2.dates) {
      return -1;
    } else if (!f1.dates && f2.dates) {
      return 1;
    }
    const f1Title = f1.frontmatter?.title.toLowerCase() ?? "";
    const f2Title = f2.frontmatter?.title.toLowerCase() ?? "";
    return f1Title.localeCompare(f2Title);
  };
}
__name(byDateAndAlphabetical, "byDateAndAlphabetical");
function byDateAndAlphabeticalFolderFirst(cfg) {
  return (f1, f2) => {
    const f1IsFolder = isFolderPath(f1.slug ?? "");
    const f2IsFolder = isFolderPath(f2.slug ?? "");
    if (f1IsFolder && !f2IsFolder) return -1;
    if (!f1IsFolder && f2IsFolder) return 1;
    if (f1.dates && f2.dates) {
      const d1 = getDate(cfg, f1);
      const d2 = getDate(cfg, f2);
      if (d1 && d2) {
        return d2.getTime() - d1.getTime();
      } else if (d1 && !d2) {
        return -1;
      } else if (!d1 && d2) {
        return 1;
      }
    } else if (f1.dates && !f2.dates) {
      return -1;
    } else if (!f1.dates && f2.dates) {
      return 1;
    }
    const f1Title = f1.frontmatter?.title.toLowerCase() ?? "";
    const f2Title = f2.frontmatter?.title.toLowerCase() ?? "";
    return f1Title.localeCompare(f2Title);
  };
}
__name(byDateAndAlphabeticalFolderFirst, "byDateAndAlphabeticalFolderFirst");
var PageList = /* @__PURE__ */ __name(({ cfg, fileData, allFiles, limit }) => {
  let list = allFiles.sort(byDateAndAlphabetical(cfg));
  if (limit) {
    list = list.slice(0, limit);
  }
  return /* @__PURE__ */ jsx9("ul", { class: "section-ul", children: list.map((page) => {
    const title = page.frontmatter?.title;
    const tags = page.frontmatter?.tags ?? [];
    const date = getDate(cfg, page);
    return /* @__PURE__ */ jsx9("li", { class: "section-li", children: /* @__PURE__ */ jsxs3("div", { class: "section-li-journal", children: [
      title && /* @__PURE__ */ jsx9("div", { class: "section-li-title", children: /* @__PURE__ */ jsx9("a", { href: resolveRelative(fileData.slug, page.slug), class: "internal", children: title }) }),
      /* @__PURE__ */ jsxs3("div", { class: "section-li-details", children: [
        date && /* @__PURE__ */ jsx9("p", { class: "meta", children: /* @__PURE__ */ jsx9(Date2, { date, locale: cfg.locale }) }),
        /* @__PURE__ */ jsx9("ul", { class: "tags", children: tags.map((tag) => /* @__PURE__ */ jsx9("li", { children: /* @__PURE__ */ jsxs3(
          "a",
          {
            class: "internal tag-link",
            href: resolveRelative(fileData.slug, `tags/${tag}`),
            children: [
              "#",
              tag
            ]
          }
        ) })) })
      ] })
    ] }) });
  }) });
}, "PageList");
PageList.css = `
.section-ul {
  margin-top: 2rem;
  padding: 0;
}

.section-li {
  list-style-type: none;
  margin-bottom: 2rem;
}

.section-li-title {
  font-family: var(--headerFont);
  font-size: 1.25rem;
  line-height: 1.5rem;
  margin-bottom: 0.5rem;
}

.section-li-title a {
  color: var(--dark);
  font-weight: 700;
}

.section-li-details {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.meta {
  margin: 0;
  font-family: var(--codeFont);
  color: var(--gray);
  font-size: 0.8rem;
}
`;

// quartz/util/snippet.ts
var OBSIDIAN_LINK_PATTERN2 = /\[\[(?<target>[^\]|]+)(\|(?<alias>[^\]]+))?\]\]/g;
var OBSIDIAN_EMBED_PATTERN3 = /!\[\[(?<target>[^\]]+)\]\]/g;
var MARKDOWN_LINK_PATTERN = /\[(?<label>[^\]]+)\]\((?<url>[^)]+)\)/g;
var MARKDOWN_IMAGE_PATTERN = /!\[(?<alt>[^\]]*)\]\((?<url>[^)]+)\)/g;
var ANGLED_LINK_PATTERN = /<(?<url>https?:[^>\s]+)>/g;
var INLINE_CODE_PATTERN = /`([^`]+)`/g;
var STRONG_PATTERN = /\*\*([^*]+)\*\*/g;
var EMPHASIS_PATTERN = /\*([^*]+)\*/g;
var STRONG_UNDERSCORE_PATTERN = /__([^_]+)__/g;
var EMPHASIS_UNDERSCORE_PATTERN = /_([^_]+)_/g;
var normaliseLinkTarget = /* @__PURE__ */ __name((target) => {
  const trimmed = target.trim();
  if (!trimmed) {
    return "";
  }
  const withoutEmbedPrefix = trimmed.replace(/^!+/, "");
  const withoutAnchor = withoutEmbedPrefix.split("#").at(0) ?? withoutEmbedPrefix;
  const lastSegment = withoutAnchor.split("/").filter(Boolean).pop() ?? withoutAnchor;
  const normalised = lastSegment.replace(/[_-]+/g, " ").trim();
  return normalised.length > 0 ? normalised : trimmed;
}, "normaliseLinkTarget");
var formatSnippetText = /* @__PURE__ */ __name((value) => {
  let formatted = value;
  formatted = formatted.replace(OBSIDIAN_EMBED_PATTERN3, "");
  formatted = formatted.replace(OBSIDIAN_LINK_PATTERN2, (...args) => {
    const groups = args[args.length - 1] ?? {};
    const fallbackTarget = args[1] ?? "";
    const target = groups.target ?? fallbackTarget;
    const aliasRaw = groups.alias ?? "";
    const aliasText = aliasRaw.trim().replace(/^\|/, "");
    if (aliasText.length > 0) {
      return aliasText;
    }
    return normaliseLinkTarget(target ?? "");
  });
  formatted = formatted.replace(MARKDOWN_IMAGE_PATTERN, (...args) => {
    const alt = args[1] ?? "";
    return alt.trim();
  });
  formatted = formatted.replace(MARKDOWN_LINK_PATTERN, (...args) => {
    const label = args[1] ?? "";
    return label.trim();
  });
  formatted = formatted.replace(ANGLED_LINK_PATTERN, (_, url) => url);
  formatted = formatted.replace(INLINE_CODE_PATTERN, (_, code) => code);
  formatted = formatted.replace(STRONG_PATTERN, (_, text) => text);
  formatted = formatted.replace(EMPHASIS_PATTERN, (_, text) => text);
  formatted = formatted.replace(STRONG_UNDERSCORE_PATTERN, (_, text) => text);
  formatted = formatted.replace(EMPHASIS_UNDERSCORE_PATTERN, (_, text) => text);
  return formatted;
}, "formatSnippetText");
var normalizeSnippet = /* @__PURE__ */ __name((value, limit = 240) => {
  if (!value) {
    return void 0;
  }
  const formatted = formatSnippetText(value);
  const compact = formatted.replace(/\s+/g, " ").trim();
  if (!compact) {
    return void 0;
  }
  if (compact.length <= limit) {
    return compact;
  }
  const truncated = compact.slice(0, limit - 1).trimEnd();
  return `${truncated}\u2026`;
}, "normalizeSnippet");

// quartz/components/pages/TagContent.tsx
import { Fragment as Fragment4, jsx as jsx10, jsxs as jsxs4 } from "preact/jsx-runtime";
var defaultOptions9 = {
  numPages: 10
};
var OBSIDIAN_EMBED_PATTERN4 = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/;
var isExternalUrl4 = /* @__PURE__ */ __name((url) => /^(https?:)?\/\//i.test(url), "isExternalUrl");
var stripContentPrefix4 = /* @__PURE__ */ __name((target) => target.replace(/^[./]+/, "").replace(/^content\//i, ""), "stripContentPrefix");
var appendAssetVersion3 = /* @__PURE__ */ __name((url, version) => version ? url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}` : url, "appendAssetVersion");
var resolveAssetReference = /* @__PURE__ */ __name((raw, baseSlug) => {
  if (typeof raw !== "string") {
    return void 0;
  }
  const cleaned = raw.trim();
  if (!cleaned) {
    return void 0;
  }
  const version = getAssetVersion();
  const embedMatch = cleaned.match(OBSIDIAN_EMBED_PATTERN4);
  if (embedMatch?.groups?.target) {
    const target2 = stripContentPrefix4(embedMatch.groups.target);
    try {
      const slug = slugifyFilePath(target2);
      return appendAssetVersion3(joinSegments(pathToRoot(baseSlug), slug), version);
    } catch {
      return void 0;
    }
  }
  if (isExternalUrl4(cleaned)) {
    return cleaned;
  }
  const target = stripContentPrefix4(cleaned);
  return appendAssetVersion3(joinSegments(pathToRoot(baseSlug), target), version);
}, "resolveAssetReference");
var getSnippetForPage = /* @__PURE__ */ __name((page, fallback) => {
  const frontmatter = page.frontmatter ?? {};
  const candidates = [
    typeof page.description === "string" ? page.description : void 0,
    typeof frontmatter.description === "string" ? frontmatter.description : void 0,
    typeof page.text === "string" ? page.text : void 0
  ];
  for (const candidate of candidates) {
    const snippet = normalizeSnippet(candidate);
    if (snippet) {
      return snippet;
    }
  }
  return fallback;
}, "getSnippetForPage");
var getPrimaryImage = /* @__PURE__ */ __name((page, slug) => {
  const frontmatter = page.frontmatter ?? {};
  const candidates = [
    page.infobox?.image?.src,
    frontmatter.cover,
    frontmatter.banner,
    frontmatter.image,
    frontmatter.thumbnail
  ];
  for (const candidate of candidates) {
    const resolved = resolveAssetReference(candidate, slug);
    if (resolved) {
      return resolved;
    }
  }
  return void 0;
}, "getPrimaryImage");
var pluralize = /* @__PURE__ */ __name((count, singular, plural) => `${count} ${count === 1 ? singular : plural}`, "pluralize");
var TagContent_default = /* @__PURE__ */ __name(((opts) => {
  const options2 = { ...defaultOptions9, ...opts };
  const TagContent = /* @__PURE__ */ __name((props) => {
    const { tree, fileData, allFiles, cfg } = props;
    const slug = fileData.slug;
    if (!(slug?.startsWith("tags/") || slug === "tags")) {
      throw new Error(`Component "TagContent" tried to render a non-tag page: ${slug}`);
    }
    const tag = simplifySlug(slug.slice("tags/".length));
    const allPagesWithTag = /* @__PURE__ */ __name((tag2) => allFiles.filter(
      (file) => (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes).includes(tag2)
    ), "allPagesWithTag");
    const content = tree.children.length === 0 ? fileData.description : htmlToJsx(fileData.filePath, tree);
    const cssClasses = fileData.frontmatter?.cssclasses ?? [];
    const classes = cssClasses.join(" ");
    if (tag === "/") {
      const tags = [
        ...new Set(
          allFiles.flatMap((data) => data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes)
        )
      ].sort((a, b) => a.localeCompare(b));
      const tagItemMap = /* @__PURE__ */ new Map();
      for (const tag2 of tags) {
        tagItemMap.set(tag2, allPagesWithTag(tag2));
      }
      return /* @__PURE__ */ jsxs4("div", { class: "popover-hint", children: [
        /* @__PURE__ */ jsx10("article", { class: classes, children: /* @__PURE__ */ jsx10("p", { children: content }) }),
        /* @__PURE__ */ jsx10("p", { children: i18n(cfg.locale).pages.tagContent.totalTags({ count: tags.length }) }),
        /* @__PURE__ */ jsx10("div", { children: tags.map((tag2) => {
          const pages = tagItemMap.get(tag2);
          const listProps = {
            ...props,
            allFiles: pages
          };
          const contentPage = allFiles.filter((file) => file.slug === `tags/${tag2}`).at(0);
          const root = contentPage?.htmlAst;
          const content2 = !root || root?.children.length === 0 ? contentPage?.description : htmlToJsx(contentPage.filePath, root);
          const tagListingPage = `/tags/${tag2}`;
          const href = resolveRelative(fileData.slug, tagListingPage);
          return /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx10("h2", { children: /* @__PURE__ */ jsx10("a", { class: "internal tag-link", href, children: tag2 }) }),
            content2 && /* @__PURE__ */ jsx10("p", { children: content2 }),
            /* @__PURE__ */ jsxs4("div", { class: "page-listing", children: [
              /* @__PURE__ */ jsxs4("p", { children: [
                i18n(cfg.locale).pages.tagContent.itemsUnderTag({ count: pages.length }),
                pages.length > options2.numPages && /* @__PURE__ */ jsxs4(Fragment4, { children: [
                  " ",
                  /* @__PURE__ */ jsx10("span", { children: i18n(cfg.locale).pages.tagContent.showingFirst({
                    count: options2.numPages
                  }) })
                ] })
              ] }),
              /* @__PURE__ */ jsx10(PageList, { limit: options2.numPages, ...listProps, sort: options2?.sort })
            ] })
          ] });
        }) })
      ] });
    } else {
      const pages = allPagesWithTag(tag);
      const sortFn = options2.sort ?? byDateAndAlphabeticalFolderFirst(cfg);
      const sortedPages = [...pages].sort(sortFn);
      const entriesSortSelectId = `tag-sort-${tag.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      return /* @__PURE__ */ jsxs4("div", { class: "popover-hint", children: [
        /* @__PURE__ */ jsx10("article", { class: classes, children: content }),
        sortedPages.length > 0 ? /* @__PURE__ */ jsx10("div", { class: "folder-directory", children: /* @__PURE__ */ jsxs4(
          "section",
          {
            class: "folder-directory__section",
            "aria-label": i18n(cfg.locale).pages.tagContent.itemsUnderTag({ count: sortedPages.length }),
            children: [
              /* @__PURE__ */ jsxs4("div", { class: "folder-directory__section-header", children: [
                /* @__PURE__ */ jsxs4("h2", { class: "folder-directory__section-title", children: [
                  "#",
                  tag
                ] }),
                /* @__PURE__ */ jsxs4("div", { class: "folder-directory__section-tools", children: [
                  /* @__PURE__ */ jsx10("span", { class: "folder-directory__section-hint", children: pluralize(sortedPages.length, "entry", "entries") }),
                  /* @__PURE__ */ jsxs4("label", { class: "folder-directory__sort", htmlFor: entriesSortSelectId, children: [
                    /* @__PURE__ */ jsx10("span", { class: "folder-directory__sort-label", children: "Sort by" }),
                    /* @__PURE__ */ jsxs4(
                      "select",
                      {
                        class: "folder-directory__sort-select",
                        id: entriesSortSelectId,
                        defaultValue: "newest",
                        "data-sort-target": "entries",
                        children: [
                          /* @__PURE__ */ jsx10("option", { value: "newest", children: "Date \xB7 Newest" }),
                          /* @__PURE__ */ jsx10("option", { value: "oldest", children: "Date \xB7 Oldest" }),
                          /* @__PURE__ */ jsx10("option", { value: "alpha", children: "Title \xB7 A \u2192 Z" }),
                          /* @__PURE__ */ jsx10("option", { value: "size", children: "Size \xB7 Longest" }),
                          /* @__PURE__ */ jsx10("option", { value: "shortest", children: "Size \xB7 Shortest" }),
                          /* @__PURE__ */ jsx10("option", { value: "random", children: "Random" })
                        ]
                      }
                    )
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx10("div", { class: "folder-directory__grid", "data-sort-grid": "entries", children: sortedPages.map((page) => {
                const slug2 = page.slug;
                if (!slug2) {
                  return null;
                }
                const frontmatter = page.frontmatter ?? {};
                const title = typeof frontmatter.title === "string" && frontmatter.title.length > 0 ? frontmatter.title : page.slug?.split("/").at(-1) ?? "Untitled";
                const link = resolveRelative(fileData.slug, slug2);
                const updated = page.dates ? getDate(cfg, page) : void 0;
                const snippet = getSnippetForPage(page);
                const hasSnippet = Boolean(snippet);
                const image = getPrimaryImage(page, slug2);
                const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
                const normalizedTitle = title.trim().toLocaleLowerCase();
                const datasetTitle = normalizedTitle.length > 0 ? normalizedTitle : title.toLocaleLowerCase();
                const pageText = typeof page.text === "string" ? page.text : "";
                const contentSize = pageText.replace(/\s+/g, " ").trim().length;
                const updatedTimestamp = updated ? updated.getTime() : 0;
                const safeSlugId = slug2.replace(/[^a-zA-Z0-9_-]/g, "-");
                const headingId = `directory-card-title-${safeSlugId}`;
                return /* @__PURE__ */ jsx10(
                  "article",
                  {
                    class: "directory-card",
                    "data-href": link,
                    "data-sort-title": datasetTitle,
                    "data-sort-updated": String(updatedTimestamp),
                    "data-sort-size": String(contentSize),
                    role: "link",
                    tabIndex: 0,
                    "aria-labelledby": headingId,
                    children: /* @__PURE__ */ jsxs4("div", { class: "directory-card__body", children: [
                      /* @__PURE__ */ jsxs4("div", { class: "directory-card__content", children: [
                        /* @__PURE__ */ jsx10("h3", { class: "directory-card__title", id: headingId, children: title }),
                        updated && /* @__PURE__ */ jsxs4("p", { class: "directory-card__meta", children: [
                          "Updated ",
                          /* @__PURE__ */ jsx10(Date2, { date: updated, locale: cfg.locale })
                        ] }),
                        hasSnippet && /* @__PURE__ */ jsx10("p", { class: "directory-card__excerpt", children: snippet })
                      ] }),
                      image && /* @__PURE__ */ jsx10("div", { class: "directory-card__media", children: /* @__PURE__ */ jsx10("img", { src: image, alt: "", loading: "lazy", decoding: "async", "data-no-zoom": "true" }) }),
                      tags.length > 0 && /* @__PURE__ */ jsx10("ul", { class: "directory-card__tags directory-card__tags--after-media", children: tags.map((tagName) => /* @__PURE__ */ jsx10("li", { class: "directory-card__tag", children: /* @__PURE__ */ jsxs4(
                        "a",
                        {
                          class: "directory-card__tag-link",
                          href: resolveRelative(fileData.slug, `tags/${tagName}`),
                          children: [
                            "#",
                            tagName
                          ]
                        }
                      ) }, tagName)) })
                    ] })
                  },
                  slug2
                );
              }) })
            ]
          }
        ) }) : /* @__PURE__ */ jsx10("div", { class: "folder-directory", children: /* @__PURE__ */ jsxs4("section", { class: "folder-directory__section", "aria-label": "Empty tag", children: [
          /* @__PURE__ */ jsxs4("div", { class: "folder-directory__section-header", children: [
            /* @__PURE__ */ jsxs4("h2", { class: "folder-directory__section-title", children: [
              "#",
              tag
            ] }),
            /* @__PURE__ */ jsx10("span", { class: "folder-directory__section-hint", children: "0 entries" })
          ] }),
          /* @__PURE__ */ jsx10("p", { class: "folder-directory__summary", children: "No entries are currently tagged with this label." })
        ] }) })
      ] });
    }
  }, "TagContent");
  TagContent.afterDOMLoaded = `
    (() => {
      const SORT_SELECT_SELECTOR = '.folder-directory__sort-select'
      const sortBindings = new Map()

      const parseSortNumber = (value) => {
        if (typeof value !== 'string' || value.length === 0) {
          return 0
        }
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : 0
      }

      const sortComparators = {
        newest: (a, b) => parseSortNumber(b.dataset.sortUpdated) - parseSortNumber(a.dataset.sortUpdated),
        oldest: (a, b) => parseSortNumber(a.dataset.sortUpdated) - parseSortNumber(b.dataset.sortUpdated),
        alpha: (a, b) => {
          const titleA = (a.dataset.sortTitle ?? '').toString()
          const titleB = (b.dataset.sortTitle ?? '').toString()
          return titleA.localeCompare(titleB)
        },
        size: (a, b) => parseSortNumber(b.dataset.sortSize) - parseSortNumber(a.dataset.sortSize),
        shortest: (a, b) => parseSortNumber(a.dataset.sortSize) - parseSortNumber(b.dataset.sortSize),
      }

      const getSortGridForSelect = (select) => {
        if (!(select instanceof HTMLSelectElement)) {
          return null
        }
        const target = select.getAttribute('data-sort-target')
        if (!target) {
          return null
        }
        const section = select.closest('.folder-directory__section')
        if (!section) {
          return null
        }
        const grid = section.querySelector('.folder-directory__grid[data-sort-grid="' + target + '"]')
        return grid instanceof HTMLElement ? grid : null
      }

      const applySortForSelect = (select) => {
        const grid = getSortGridForSelect(select)
        if (!grid) {
          return
        }

        const cards = Array.from(grid.querySelectorAll('.directory-card'))
        if (cards.length === 0) {
          return
        }

        const sortKey = select.value
        const comparator = sortComparators[sortKey] ?? sortComparators.newest
        const decorated = cards.map((card, index) => ({ card, index, random: Math.random() }))
        decorated.sort((a, b) => {
          if (sortKey === 'random') {
            const randomDiff = a.random - b.random
            return randomDiff !== 0 ? randomDiff : a.index - b.index
          }

          const result = comparator(a.card, b.card)
          return result !== 0 ? result : a.index - b.index
        })
        decorated.forEach(({ card }) => grid.appendChild(card))
      }

      const cleanupSortControls = () => {
        sortBindings.forEach((handler, element) => {
          element.removeEventListener('change', handler)
        })
        sortBindings.clear()
      }

      const pruneSortBindings = () => {
        Array.from(sortBindings.entries()).forEach(([element, handler]) => {
          if (!(element instanceof HTMLSelectElement) || !element.isConnected) {
            element.removeEventListener('change', handler)
            sortBindings.delete(element)
          }
        })
      }

      const bindSortControls = () => {
        pruneSortBindings()
        const selects = document.querySelectorAll(SORT_SELECT_SELECTOR)
        selects.forEach((element) => {
          if (!(element instanceof HTMLSelectElement)) {
            return
          }
          if (!element.closest('.folder-directory')) {
            return
          }
          if (!sortBindings.has(element)) {
            const handler = () => applySortForSelect(element)
            element.addEventListener('change', handler)
            sortBindings.set(element, handler)
          }
          applySortForSelect(element)
        })
      }

      const selector = '.directory-card[data-href]'
      let handlersBound = false

      const resolveCard = (target) =>
        target instanceof Element ? target.closest(selector) : null

      const isTagLink = (target) =>
        target instanceof Element && target.closest('.directory-card__tag-link')

      const navigate = (href, openInNewTab) => {
        if (!href) {
          return
        }

        const url = new URL(href, window.location.toString())
        if (openInNewTab) {
          window.open(url.toString(), '_blank', 'noopener')
          return
        }

        if (typeof window.spaNavigate === 'function') {
          window.spaNavigate(url)
        } else {
          window.location.assign(url)
        }
      }

      const handleClick = (event) => {
        if (event.defaultPrevented) {
          return
        }

        const card = resolveCard(event.target)
        if (!card) {
          return
        }

        if (isTagLink(event.target)) {
          return
        }

        if (window.getSelection && window.getSelection().toString().length > 0) {
          return
        }

        if (event.button !== 0) {
          return
        }

        event.preventDefault()
        navigate(card.getAttribute('data-href'), event.metaKey || event.ctrlKey)
      }

      const handleAuxClick = (event) => {
        if (event.defaultPrevented || event.button !== 1) {
          return
        }

        const card = resolveCard(event.target)
        if (!card || isTagLink(event.target)) {
          return
        }

        event.preventDefault()
        navigate(card.getAttribute('data-href'), true)
      }

      const handleKeydown = (event) => {
        if (event.defaultPrevented) {
          return
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }

        const target = event.target
        if (!(target instanceof HTMLElement)) {
          return
        }

        if (!target.matches(selector)) {
          return
        }

        event.preventDefault()
        navigate(target.getAttribute('data-href'), event.metaKey || event.ctrlKey)
      }

      const bindHandlers = () => {
        if (handlersBound) {
          return
        }

        document.addEventListener('click', handleClick)
        document.addEventListener('auxclick', handleAuxClick)
        document.addEventListener('keydown', handleKeydown)
        handlersBound = true

        window.addCleanup?.(() => {
          document.removeEventListener('click', handleClick)
          document.removeEventListener('auxclick', handleAuxClick)
          document.removeEventListener('keydown', handleKeydown)
          handlersBound = false
        })
      }

      const handleNav = () => {
        bindHandlers()
        bindSortControls()
      }

      document.addEventListener('nav', handleNav)
      handleNav()

      window.addCleanup?.(() => {
        document.removeEventListener('nav', handleNav)
        cleanupSortControls()
      })
    })()
  `;
  TagContent.css = concatenateResources(folderDirectory_default, listPage_default, PageList.css);
  return TagContent;
}), "default");

// quartz/components/pages/FolderContent.tsx
import { Fragment as Fragment5 } from "preact";

// quartz/util/fileTrie.ts
var FileTrieNode = class _FileTrieNode {
  static {
    __name(this, "FileTrieNode");
  }
  isFolder;
  children;
  slugSegments;
  // prefer showing the file path segment over the slug segment
  // so that folders that dont have index files can be shown as is
  // without dashes in the slug
  fileSegmentHint;
  displayNameOverride;
  data;
  constructor(segments, data) {
    this.children = [];
    this.slugSegments = segments;
    this.data = data ?? null;
    this.isFolder = false;
    this.displayNameOverride = void 0;
  }
  get displayName() {
    const nonIndexTitle = this.data?.title === "index" ? void 0 : this.data?.title;
    return this.displayNameOverride ?? nonIndexTitle ?? this.fileSegmentHint ?? this.slugSegment ?? "";
  }
  set displayName(name) {
    this.displayNameOverride = name;
  }
  get slug() {
    const path14 = joinSegments(...this.slugSegments);
    if (this.isFolder) {
      return joinSegments(path14, "index");
    }
    return path14;
  }
  get slugSegment() {
    return this.slugSegments[this.slugSegments.length - 1];
  }
  makeChild(path14, file) {
    const fullPath = [...this.slugSegments, path14[0]];
    const child = new _FileTrieNode(fullPath, file);
    this.children.push(child);
    return child;
  }
  insert(path14, file) {
    if (path14.length === 0) {
      throw new Error("path is empty");
    }
    this.isFolder = true;
    const segment = path14[0];
    if (path14.length === 1) {
      if (segment === "index") {
        this.data ??= file;
      } else {
        this.makeChild(path14, file);
      }
    } else if (path14.length > 1) {
      const child = this.children.find((c) => c.slugSegment === segment) ?? this.makeChild(path14, void 0);
      const fileParts = file.filePath.split("/");
      child.fileSegmentHint = fileParts.at(-path14.length);
      child.insert(path14.slice(1), file);
    }
  }
  // Add new file to trie
  add(file) {
    this.insert(file.slug.split("/"), file);
  }
  findNode(path14) {
    if (path14.length === 0 || path14.length === 1 && path14[0] === "index") {
      return this;
    }
    return this.children.find((c) => c.slugSegment === path14[0])?.findNode(path14.slice(1));
  }
  ancestryChain(path14) {
    if (path14.length === 0 || path14.length === 1 && path14[0] === "index") {
      return [this];
    }
    const child = this.children.find((c) => c.slugSegment === path14[0]);
    if (!child) {
      return void 0;
    }
    const childPath = child.ancestryChain(path14.slice(1));
    if (!childPath) {
      return void 0;
    }
    return [this, ...childPath];
  }
  /**
   * Filter trie nodes. Behaves similar to `Array.prototype.filter()`, but modifies tree in place
   */
  filter(filterFn) {
    this.children = this.children.filter(filterFn);
    this.children.forEach((child) => child.filter(filterFn));
  }
  /**
   * Map over trie nodes. Behaves similar to `Array.prototype.map()`, but modifies tree in place
   */
  map(mapFn) {
    mapFn(this);
    this.children.forEach((child) => child.map(mapFn));
  }
  /**
   * Sort trie nodes according to sort/compare function
   */
  sort(sortFn) {
    this.children = this.children.sort(sortFn);
    this.children.forEach((e) => e.sort(sortFn));
  }
  static fromEntries(entries) {
    const trie = new _FileTrieNode([]);
    entries.forEach(([, entry]) => trie.add(entry));
    return trie;
  }
  /**
   * Get all entries in the trie
   * in the a flat array including the full path and the node
   */
  entries() {
    const traverse = /* @__PURE__ */ __name((node) => {
      const result = [[node.slug, node]];
      return result.concat(...node.children.map(traverse));
    }, "traverse");
    return traverse(this);
  }
  /**
   * Get all folder paths in the trie
   * @returns array containing folder state for trie
   */
  getFolderPaths() {
    return this.entries().filter(([_, node]) => node.isFolder).map(([path14, _]) => path14);
  }
};

// quartz/util/ctx.ts
function trieFromAllFiles(allFiles) {
  const trie = new FileTrieNode([]);
  allFiles.forEach((file) => {
    if (file.frontmatter) {
      trie.add({
        ...file,
        slug: file.slug,
        title: file.frontmatter.title,
        filePath: file.filePath
      });
    }
  });
  return trie;
}
__name(trieFromAllFiles, "trieFromAllFiles");

// quartz/components/pages/FolderContent.tsx
import { jsx as jsx11, jsxs as jsxs5 } from "preact/jsx-runtime";
var defaultOptions10 = {
  showFolderCount: true,
  showSubfolders: true
};
var OBSIDIAN_EMBED_PATTERN5 = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/;
var isExternalUrl5 = /* @__PURE__ */ __name((url) => /^(https?:)?\/\//i.test(url), "isExternalUrl");
var stripContentPrefix5 = /* @__PURE__ */ __name((target) => target.replace(/^[./]+/, "").replace(/^content\//i, ""), "stripContentPrefix");
var appendAssetVersion4 = /* @__PURE__ */ __name((url, version) => version ? url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}` : url, "appendAssetVersion");
var resolveAssetReference2 = /* @__PURE__ */ __name((raw, baseSlug) => {
  if (typeof raw !== "string") {
    return void 0;
  }
  const cleaned = raw.trim();
  if (!cleaned) {
    return void 0;
  }
  const version = getAssetVersion();
  const embedMatch = cleaned.match(OBSIDIAN_EMBED_PATTERN5);
  if (embedMatch?.groups?.target) {
    const target2 = stripContentPrefix5(embedMatch.groups.target);
    try {
      const slug = slugifyFilePath(target2);
      return appendAssetVersion4(joinSegments(pathToRoot(baseSlug), slug), version);
    } catch {
      return void 0;
    }
  }
  if (isExternalUrl5(cleaned)) {
    return cleaned;
  }
  const target = stripContentPrefix5(cleaned);
  return appendAssetVersion4(joinSegments(pathToRoot(baseSlug), target), version);
}, "resolveAssetReference");
var getSnippetForPage2 = /* @__PURE__ */ __name((page, fallback) => {
  const frontmatter = page.frontmatter ?? {};
  const candidates = [
    typeof page.description === "string" ? page.description : void 0,
    typeof frontmatter.description === "string" ? frontmatter.description : void 0,
    typeof page.text === "string" ? page.text : void 0
  ];
  for (const candidate of candidates) {
    const snippet = normalizeSnippet(candidate);
    if (snippet) {
      return snippet;
    }
  }
  return fallback;
}, "getSnippetForPage");
var getPrimaryImage2 = /* @__PURE__ */ __name((page, slug) => {
  const frontmatter = page.frontmatter ?? {};
  const candidates = [
    page.infobox?.image?.src,
    frontmatter.cover,
    frontmatter.banner,
    frontmatter.image,
    frontmatter.thumbnail
  ];
  for (const candidate of candidates) {
    const resolved = resolveAssetReference2(candidate, slug);
    if (resolved) {
      return resolved;
    }
  }
  return void 0;
}, "getPrimaryImage");
var getInitials = /* @__PURE__ */ __name((title) => {
  const parts = title.split(/\s+/).map((segment) => segment.trim()).filter((segment) => segment.length > 0).slice(0, 2).map((segment) => segment[0]?.toUpperCase() ?? "");
  const initials = parts.join("");
  return initials.length > 0 ? initials : title.slice(0, 2).toUpperCase();
}, "getInitials");
var pluralize2 = /* @__PURE__ */ __name((count, singular, plural) => `${count} ${count === 1 ? singular : plural}`, "pluralize");
var FOLDER_DESCRIPTION_BASENAME = "foldercontentdescription";
var isFolderDescriptionSlug = /* @__PURE__ */ __name((slug) => Boolean(slug && slug.split("/").at(-1)?.toLowerCase() === FOLDER_DESCRIPTION_BASENAME), "isFolderDescriptionSlug");
var FolderContent_default = /* @__PURE__ */ __name(((opts) => {
  const options2 = { ...defaultOptions10, ...opts };
  const FolderContent = /* @__PURE__ */ __name((props) => {
    const { tree, fileData, allFiles, cfg } = props;
    const trie = props.ctx.trie ??= trieFromAllFiles(allFiles);
    const folder = trie.findNode(fileData.slug.split("/"));
    if (!folder) {
      return null;
    }
    const getMostRecentDates = /* @__PURE__ */ __name((node) => {
      let maybeDates;
      for (const child of node.children) {
        if (child.data?.dates) {
          const childDates = child.data.dates;
          if (!maybeDates) {
            maybeDates = { ...childDates };
          } else {
            if (childDates.created > maybeDates.created) {
              maybeDates.created = childDates.created;
            }
            if (childDates.modified > maybeDates.modified) {
              maybeDates.modified = childDates.modified;
            }
            if (childDates.published > maybeDates.published) {
              maybeDates.published = childDates.published;
            }
          }
        }
      }
      return maybeDates ?? {
        created: /* @__PURE__ */ new Date(),
        modified: /* @__PURE__ */ new Date(),
        published: /* @__PURE__ */ new Date()
      };
    }, "getMostRecentDates");
    const entries = folder.children.map((node) => {
      if (node.data) {
        if (isFolderDescriptionSlug(node.data.slug)) {
          return null;
        }
        return { node, data: node.data };
      }
      if (node.isFolder && options2.showSubfolders) {
        const synthetic = {
          slug: node.slug,
          dates: getMostRecentDates(node),
          frontmatter: {
            title: node.displayName,
            tags: []
          }
        };
        return { node, data: synthetic };
      }
      return null;
    }).filter((entry) => entry !== null) ?? [];
    const sortFn = options2.sort ?? byDateAndAlphabeticalFolderFirst(cfg);
    const sortedEntries = [...entries].sort((a, b) => sortFn(a.data, b.data));
    const folderEntries = options2.showSubfolders ? sortedEntries.filter((entry) => entry.node.isFolder) : [];
    const pageEntries = sortedEntries.filter((entry) => !entry.node.isFolder || !options2.showSubfolders);
    const entriesSortSelectId = `folder-sort-${(fileData.slug ?? "entries").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const countRenderableChildren = /* @__PURE__ */ __name((node) => node.children.filter((child) => {
      if (child.data && isFolderDescriptionSlug(child.data.slug)) {
        return false;
      }
      return child.data || child.isFolder;
    }).length, "countRenderableChildren");
    const cssClasses = fileData.frontmatter?.cssclasses ?? [];
    const classes = cssClasses.join(" ");
    const content = tree.children.length === 0 ? fileData.description : htmlToJsx(fileData.filePath, tree);
    return /* @__PURE__ */ jsxs5("div", { class: "popover-hint", children: [
      /* @__PURE__ */ jsx11("article", { class: classes, children: content }),
      /* @__PURE__ */ jsxs5("div", { class: "folder-directory", children: [
        folderEntries.length > 0 && /* @__PURE__ */ jsxs5("section", { class: "folder-directory__section", "aria-label": "Subfolders", children: [
          /* @__PURE__ */ jsxs5("div", { class: "folder-directory__section-header", children: [
            /* @__PURE__ */ jsx11("h2", { class: "folder-directory__section-title", children: "Collections" }),
            /* @__PURE__ */ jsx11("span", { class: "folder-directory__section-hint", children: pluralize2(folderEntries.length, "subfolder", "subfolders") })
          ] }),
          /* @__PURE__ */ jsx11("div", { class: "folder-directory__grid folder-directory__grid--subfolders", children: folderEntries.map((entry) => {
            const slug = entry.data.slug;
            if (!slug) {
              return null;
            }
            const title = entry.data.frontmatter?.title ?? entry.node.displayName ?? slug.split("/").at(-1) ?? "Untitled";
            const link = resolveRelative(fileData.slug, slug);
            const childCount = pluralize2(countRenderableChildren(entry.node), "item", "items");
            const updated = entry.data.dates ? getDate(cfg, entry.data) : void 0;
            const snippet = getSnippetForPage2(entry.data);
            const hasSnippet = Boolean(snippet);
            const initials = getInitials(title);
            const previewCandidates = entry.node.children.filter((child) => {
              if (!child.data || child.isFolder) {
                return false;
              }
              return !isFolderDescriptionSlug(child.data.slug);
            });
            const previewPages = previewCandidates.slice(0, 12);
            const totalPreviewCount = previewCandidates.length;
            const safeSlugId = slug.replace(/[^a-zA-Z0-9_-]/g, "-");
            const headingId = `directory-card-title-${safeSlugId}`;
            return /* @__PURE__ */ jsx11("article", { class: "directory-card directory-card--folder", "aria-labelledby": headingId, children: /* @__PURE__ */ jsx11("a", { class: "directory-card__link", href: link, "aria-labelledby": headingId, children: /* @__PURE__ */ jsx11("div", { class: "directory-card__body directory-card__body--folder", children: /* @__PURE__ */ jsxs5("div", { class: "directory-card__content directory-card__content--folder", children: [
              /* @__PURE__ */ jsxs5("div", { class: "directory-card__topline", children: [
                /* @__PURE__ */ jsxs5("div", { class: "directory-card__header", children: [
                  /* @__PURE__ */ jsx11("span", { class: "folder-directory__subfolder-icon", "aria-hidden": "true", children: initials }),
                  /* @__PURE__ */ jsxs5("div", { children: [
                    /* @__PURE__ */ jsx11("h3", { class: "directory-card__title", id: headingId, children: title }),
                    /* @__PURE__ */ jsxs5("p", { class: "directory-card__meta", children: [
                      childCount,
                      updated && /* @__PURE__ */ jsxs5(Fragment5, { children: [
                        " \xB7 ",
                        "Updated ",
                        /* @__PURE__ */ jsx11(Date2, { date: updated, locale: cfg.locale })
                      ] })
                    ] })
                  ] })
                ] }),
                previewPages.length > 0 && /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    class: "directory-card__preview-wrap",
                    "aria-label": `Highlights from ${title}`,
                    "data-preview-total": totalPreviewCount,
                    children: [
                      /* @__PURE__ */ jsx11("div", { class: "directory-card__preview-list", children: previewPages.map((child) => {
                        const childData = child.data;
                        const childFrontmatter = childData.frontmatter ?? {};
                        const childTitle = typeof childFrontmatter.title === "string" && childFrontmatter.title.length > 0 ? childFrontmatter.title : child.displayName ?? childData.slug?.split("/").at(-1) ?? "Untitled";
                        return /* @__PURE__ */ jsx11("div", { class: "directory-card__preview-card", children: /* @__PURE__ */ jsx11("p", { class: "directory-card__preview-title", children: childTitle }) }, childData.slug ?? childTitle);
                      }) }),
                      /* @__PURE__ */ jsx11("span", { class: "directory-card__preview-more", "aria-hidden": "true", hidden: true, children: ". . ." })
                    ]
                  }
                )
              ] }),
              hasSnippet && /* @__PURE__ */ jsx11("p", { class: "directory-card__excerpt", children: snippet })
            ] }) }) }) }, slug);
          }) })
        ] }),
        pageEntries.length > 0 && /* @__PURE__ */ jsxs5("section", { class: "folder-directory__section", "aria-label": "Entries", children: [
          /* @__PURE__ */ jsxs5("div", { class: "folder-directory__section-header", children: [
            /* @__PURE__ */ jsx11("h2", { class: "folder-directory__section-title", children: "Entries" }),
            /* @__PURE__ */ jsxs5("div", { class: "folder-directory__section-tools", children: [
              /* @__PURE__ */ jsx11("span", { class: "folder-directory__section-hint", children: pluralize2(pageEntries.length, "entry", "entries") }),
              /* @__PURE__ */ jsxs5("label", { class: "folder-directory__sort", htmlFor: entriesSortSelectId, children: [
                /* @__PURE__ */ jsx11("span", { class: "folder-directory__sort-label", children: "Sort by" }),
                /* @__PURE__ */ jsxs5(
                  "select",
                  {
                    class: "folder-directory__sort-select",
                    id: entriesSortSelectId,
                    defaultValue: "newest",
                    "data-sort-target": "entries",
                    children: [
                      /* @__PURE__ */ jsx11("option", { value: "newest", children: "Date \xB7 Newest" }),
                      /* @__PURE__ */ jsx11("option", { value: "oldest", children: "Date \xB7 Oldest" }),
                      /* @__PURE__ */ jsx11("option", { value: "alpha", children: "Title \xB7 A \u2192 Z" }),
                      /* @__PURE__ */ jsx11("option", { value: "size", children: "Size \xB7 Longest" }),
                      /* @__PURE__ */ jsx11("option", { value: "shortest", children: "Size \xB7 Shortest" }),
                      /* @__PURE__ */ jsx11("option", { value: "random", children: "Random" })
                    ]
                  }
                )
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx11("div", { class: "folder-directory__grid", "data-sort-grid": "entries", children: pageEntries.map((entry) => {
            const slug = entry.data.slug;
            if (!slug) {
              return null;
            }
            const frontmatter = entry.data.frontmatter ?? {};
            const title = typeof frontmatter.title === "string" && frontmatter.title.length > 0 ? frontmatter.title : entry.node.displayName ?? slug.split("/").at(-1) ?? "Untitled";
            const link = resolveRelative(fileData.slug, slug);
            const updated = entry.data.dates ? getDate(cfg, entry.data) : void 0;
            const snippet = getSnippetForPage2(entry.data);
            const hasSnippet = Boolean(snippet);
            const image = getPrimaryImage2(entry.data, slug);
            const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
            const safeSlugId = slug.replace(/[^a-zA-Z0-9_-]/g, "-");
            const headingId = `directory-card-title-${safeSlugId}`;
            const normalizedTitle = title.trim().toLocaleLowerCase();
            const datasetTitle = normalizedTitle.length > 0 ? normalizedTitle : title.toLocaleLowerCase();
            const pageText = typeof entry.data.text === "string" ? entry.data.text : "";
            const contentSize = pageText.replace(/\s+/g, " ").trim().length;
            const updatedTimestamp = updated ? updated.getTime() : 0;
            return /* @__PURE__ */ jsxs5(
              "article",
              {
                class: "directory-card",
                "data-sort-title": datasetTitle,
                "data-sort-updated": String(updatedTimestamp),
                "data-sort-size": String(contentSize),
                "aria-labelledby": headingId,
                children: [
                  /* @__PURE__ */ jsx11("a", { class: "directory-card__link", href: link, "aria-labelledby": headingId, children: /* @__PURE__ */ jsxs5("div", { class: "directory-card__body", children: [
                    /* @__PURE__ */ jsxs5("div", { class: "directory-card__content", children: [
                      /* @__PURE__ */ jsx11("h3", { class: "directory-card__title", id: headingId, children: title }),
                      updated && /* @__PURE__ */ jsxs5("p", { class: "directory-card__meta", children: [
                        "Updated ",
                        /* @__PURE__ */ jsx11(Date2, { date: updated, locale: cfg.locale })
                      ] }),
                      hasSnippet && /* @__PURE__ */ jsx11("p", { class: "directory-card__excerpt", children: snippet })
                    ] }),
                    image && /* @__PURE__ */ jsx11("div", { class: "directory-card__media", children: /* @__PURE__ */ jsx11("img", { src: image, alt: "", loading: "lazy", decoding: "async", "data-no-zoom": "true" }) })
                  ] }) }),
                  tags.length > 0 && /* @__PURE__ */ jsx11("ul", { class: "directory-card__tags directory-card__tags--after-media", children: tags.map((tag) => /* @__PURE__ */ jsx11("li", { class: "directory-card__tag", children: /* @__PURE__ */ jsxs5(
                    "a",
                    {
                      class: "directory-card__tag-link",
                      href: resolveRelative(fileData.slug, `tags/${tag}`),
                      children: [
                        "#",
                        tag
                      ]
                    }
                  ) }, tag)) })
                ]
              },
              slug
            );
          }) })
        ] })
      ] })
    ] });
  }, "FolderContent");
  FolderContent.afterDOMLoaded = `
    (() => {
      const SORT_SELECT_SELECTOR = '.folder-directory__sort-select'
      const sortBindings = new Map()

      const parseSortNumber = (value) => {
        if (typeof value !== 'string' || value.length === 0) {
          return 0
        }
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : 0
      }

      const sortComparators = {
        newest: (a, b) => parseSortNumber(b.dataset.sortUpdated) - parseSortNumber(a.dataset.sortUpdated),
        oldest: (a, b) => parseSortNumber(a.dataset.sortUpdated) - parseSortNumber(b.dataset.sortUpdated),
        alpha: (a, b) => {
          const titleA = (a.dataset.sortTitle ?? '').toString()
          const titleB = (b.dataset.sortTitle ?? '').toString()
          return titleA.localeCompare(titleB)
        },
        size: (a, b) => parseSortNumber(b.dataset.sortSize) - parseSortNumber(a.dataset.sortSize),
        shortest: (a, b) => parseSortNumber(a.dataset.sortSize) - parseSortNumber(b.dataset.sortSize),
      }

      const getSortGridForSelect = (select) => {
        if (!(select instanceof HTMLSelectElement)) {
          return null
        }
        const target = select.getAttribute('data-sort-target')
        if (!target) {
          return null
        }
        const section = select.closest('.folder-directory__section')
        if (!section) {
          return null
        }
        const grid = section.querySelector('.folder-directory__grid[data-sort-grid="' + target + '"]')
        return grid instanceof HTMLElement ? grid : null
      }

      const applySortForSelect = (select) => {
        const grid = getSortGridForSelect(select)
        if (!grid) {
          return
        }

        const cards = Array.from(grid.querySelectorAll('.directory-card'))
        if (cards.length === 0) {
          return
        }

        const sortKey = select.value
        const comparator = sortComparators[sortKey] ?? sortComparators.newest
        const decorated = cards.map((card, index) => ({ card, index, random: Math.random() }))
        decorated.sort((a, b) => {
          if (sortKey === 'random') {
            const randomDiff = a.random - b.random
            return randomDiff !== 0 ? randomDiff : a.index - b.index
          }

          const result = comparator(a.card, b.card)
          return result !== 0 ? result : a.index - b.index
        })
        decorated.forEach(({ card }) => grid.appendChild(card))
      }

      const cleanupSortControls = () => {
        sortBindings.forEach((handler, element) => {
          element.removeEventListener('change', handler)
        })
        sortBindings.clear()
      }

      const bindSortControls = () => {
        cleanupSortControls()
        const selects = document.querySelectorAll(SORT_SELECT_SELECTOR)
        selects.forEach((element) => {
          if (!(element instanceof HTMLSelectElement)) {
            return
          }
          const handler = () => applySortForSelect(element)
          element.addEventListener('change', handler)
          sortBindings.set(element, handler)
          applySortForSelect(element)
        })
      }

      const previewSelector = '.directory-card__preview-wrap'
      const previewElements = new Set()
      const previewObservers = new Map()
      let previewResizeHandler = null

      const getViewportPreviewCount = () => {
        const width = window.innerWidth || document.documentElement.clientWidth || 0
        const height = window.innerHeight || document.documentElement.clientHeight || 1
        const aspect = height > 0 ? width / height : 1

        if (width >= 1600 && aspect >= 1.5) {
          return 5
        }
        if (width >= 1280 && aspect >= 1.3) {
          return 4
        }
        if (width >= 960) {
          return 3
        }
        if (width >= 640) {
          return 2
        }
        return 1
      }

      const schedulePreviewUpdate = (wrap) => {
        window.requestAnimationFrame(() => updatePreviewLayout(wrap))
      }

      const updatePreviewLayout = (wrap) => {
        if (!(wrap instanceof HTMLElement)) {
          return
        }

        if (!wrap.isConnected) {
          const observer = previewObservers.get(wrap)
          if (observer) {
            observer.disconnect()
            previewObservers.delete(wrap)
          }
          previewElements.delete(wrap)
          return
        }

        const list = wrap.querySelector('.directory-card__preview-list')
        if (!(list instanceof HTMLElement)) {
          return
        }

        const cards = Array.from(list.querySelectorAll('.directory-card__preview-card'))
        const ellipsis = wrap.querySelector('.directory-card__preview-more')
        const total = Number.parseInt(wrap.getAttribute('data-preview-total') ?? '', 10) || cards.length

        if (cards.length === 0) {
          if (ellipsis) {
            ellipsis.hidden = total <= 0
          }
          return
        }

        const style = window.getComputedStyle(list)
        const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0
        const available = list.getBoundingClientRect().width
        const sampleCard = cards[0]
        const cardWidth = sampleCard ? sampleCard.getBoundingClientRect().width : 0

        let widthCapacity = Number.POSITIVE_INFINITY
        if (Number.isFinite(available) && available > 0 && Number.isFinite(cardWidth) && cardWidth > 0) {
          const maxByWidth = Math.floor((available + gap) / (cardWidth + gap))
          if (Number.isFinite(maxByWidth)) {
            widthCapacity = Math.max(1, maxByWidth)
          }
        }

        let baseline = Number.parseInt(wrap.getAttribute('data-preview-visible') ?? '', 10)
        if (!Number.isFinite(baseline) || baseline <= 0) {
          baseline = getViewportPreviewCount()
          if (!Number.isFinite(baseline) || baseline < 1) {
            baseline = 1
          }
          baseline = Math.min(baseline, cards.length)
          if (Number.isFinite(widthCapacity) && widthCapacity > 0) {
            baseline = Math.min(baseline, widthCapacity)
          }
          wrap.setAttribute('data-preview-visible', String(baseline))
        }

        let visibleCount = baseline
        if (Number.isFinite(widthCapacity) && widthCapacity > 0) {
          visibleCount = Math.min(visibleCount, widthCapacity)
        }

        visibleCount = Math.max(1, Math.min(visibleCount, cards.length))

        cards.forEach((card, index) => {
          card.toggleAttribute('hidden', index >= visibleCount)
        })

        const hiddenRendered = cards.length > visibleCount
        const shouldShowEllipsis = hiddenRendered || total > visibleCount
        if (ellipsis) {
          ellipsis.hidden = !shouldShowEllipsis
        }
      }

      const ensurePreviewResizeHandler = () => {
        if (previewResizeHandler) {
          return
        }

        previewResizeHandler = () => {
          previewElements.forEach((wrap) => schedulePreviewUpdate(wrap))
        }

        window.addEventListener('resize', previewResizeHandler)

        window.addCleanup?.(() => {
          if (previewResizeHandler) {
            window.removeEventListener('resize', previewResizeHandler)
            previewResizeHandler = null
          }
        })
      }

      const setupPreviewLayouts = () => {
        const wraps = document.querySelectorAll(previewSelector)
        wraps.forEach((element) => {
          if (!(element instanceof HTMLElement)) {
            return
          }

          previewElements.add(element)

          if (!previewObservers.has(element) && typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(() => schedulePreviewUpdate(element))
            observer.observe(element)
            previewObservers.set(element, observer)
          }

          schedulePreviewUpdate(element)
        })

        if (previewElements.size > 0) {
          ensurePreviewResizeHandler()
        }
      }

      const cleanupPreviews = () => {
        previewObservers.forEach((observer) => {
          if (observer && typeof observer.disconnect === 'function') {
            observer.disconnect()
          }
        })
        previewObservers.clear()
        previewElements.clear()
      }

      const handleNav = () => {
        bindSortControls()
        setupPreviewLayouts()
      }

      document.addEventListener('nav', handleNav)
      handleNav()

      window.addCleanup?.(() => {
        cleanupSortControls()
        cleanupPreviews()
        document.removeEventListener('nav', handleNav)
      })
    })()
  `;
  FolderContent.css = concatenateResources(folderDirectory_default);
  return FolderContent;
}), "default");

// quartz/components/pages/404.tsx
import { jsx as jsx12, jsxs as jsxs6 } from "preact/jsx-runtime";
var NotFound = /* @__PURE__ */ __name(({ cfg }) => {
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`);
  const baseDir = url.pathname;
  return /* @__PURE__ */ jsxs6("article", { class: "popover-hint", children: [
    /* @__PURE__ */ jsx12("h1", { children: "404" }),
    /* @__PURE__ */ jsx12("p", { children: i18n(cfg.locale).pages.error.notFound }),
    /* @__PURE__ */ jsx12("a", { href: baseDir, children: i18n(cfg.locale).pages.error.home })
  ] });
}, "NotFound");
var __default = /* @__PURE__ */ __name((() => NotFound), "default");

// quartz/components/scripts/shareButton.inline.ts
var shareButton_inline_default = "";

// quartz/components/ArticleHeader.tsx
import { jsx as jsx13, jsxs as jsxs7 } from "preact/jsx-runtime";
var resolveShareUrl = /* @__PURE__ */ __name((cfg, slug) => {
  if (!slug) {
    return void 0;
  }
  const relativePath = slug === "index" ? "/" : `/${slug}`;
  const normalizedPath = relativePath.endsWith("/") ? relativePath : `${relativePath}/`;
  const rawBase = cfg.baseUrl?.trim();
  if (!rawBase) {
    return normalizedPath;
  }
  const normalizedBase = rawBase.startsWith("http") ? rawBase : `https://${rawBase}`;
  try {
    return new URL(normalizedPath, normalizedBase).toString();
  } catch {
    return normalizedPath;
  }
}, "resolveShareUrl");
var ArticleHeader = /* @__PURE__ */ __name((props) => {
  const { cfg, fileData, displayClass } = props;
  const title = fileData.frontmatter?.title ?? fileData.slug ?? "";
  const updatedDate = fileData.dates ? getDate(cfg, fileData) : void 0;
  const shareUrl = resolveShareUrl(cfg, fileData.slug);
  const shareText = fileData.description ?? fileData.frontmatter?.description ?? "";
  if (!title && !updatedDate) {
    return null;
  }
  return /* @__PURE__ */ jsxs7("header", { class: classNames(displayClass, "article-header"), children: [
    /* @__PURE__ */ jsxs7("div", { class: "article-header__content", children: [
      title && /* @__PURE__ */ jsx13("h1", { class: "article-title", children: title }),
      updatedDate && /* @__PURE__ */ jsxs7("div", { class: "article-header__meta", children: [
        /* @__PURE__ */ jsx13("span", { class: "article-header__meta-label", children: "Updated" }),
        /* @__PURE__ */ jsx13(Date2, { date: updatedDate, locale: cfg.locale })
      ] })
    ] }),
    shareUrl && /* @__PURE__ */ jsx13("div", { class: "article-header__actions", children: /* @__PURE__ */ jsxs7("div", { class: "article-share", children: [
      /* @__PURE__ */ jsx13(
        "button",
        {
          type: "button",
          class: "article-share__button",
          "aria-label": `Share ${title}`,
          "data-share-url": shareUrl,
          "data-share-title": title,
          "data-share-text": shareText || void 0,
          "data-share-copied": "Link copied!",
          "data-share-error": "Sharing not available.",
          "data-share-cancel": "Share cancelled.",
          children: /* @__PURE__ */ jsx13("span", { class: "article-share__icon", "aria-hidden": "true" })
        }
      ),
      /* @__PURE__ */ jsx13("span", { class: "article-share__feedback", "aria-live": "polite" })
    ] }) })
  ] });
}, "ArticleHeader");
var articleHeaderStyles = `
.article-header {
  margin: 2rem 0 1.85rem;
  padding-bottom: 0.85rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  border-bottom: 1px solid var(--color-accent-deep);
}

.article-header__content {
  flex: 1 1 auto;
  min-width: 0;
}

.article-header__actions {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex: 0 0 auto;
}

.article-header .article-title {
  margin: 0;
  color: var(--color-tone-contrast);
}

.article-header__meta {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin-top: 0.6rem;
  color: var(--color-tone-subtle);
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}

.article-header__meta time {
  color: inherit;
  font-weight: 500;
}

.article-header__meta-label {
  font-weight: 500;
  letter-spacing: 0.01em;
}

.article-share {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 0.2rem;
  min-width: fit-content;
  align-self: flex-end;
  margin-top: auto;
}

.article-share__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-accent-bright);
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease, transform 160ms ease;
}

.article-share__button:hover {
  color: var(--color-accent-deep);
  background: color-mix(in srgb, var(--color-accent-bright) 16%, transparent);
}

.article-share__button:active {
  transform: translateY(1px);
  background: color-mix(in srgb, var(--color-accent-deep) 18%, transparent);
}

.article-share__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
}

.article-share__button:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.article-share__icon {
  width: 20px;
  height: 20px;
  display: block;
  background-color: currentColor;
  mask-image: url(/static/icons/share_icon.svg);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: url(/static/icons/share_icon.svg);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}

.article-share__feedback {
  min-height: 1rem;
  font-size: 0.76rem;
  letter-spacing: 0.03em;
  color: var(--color-tone-primary);
  transition: opacity 160ms ease;
  opacity: 0;
}

.article-share__feedback[data-state="success"] {
  color: var(--color-feedback-success);
  opacity: 1;
}

.article-share__feedback[data-state="error"] {
  color: var(--color-feedback-error);
  opacity: 1;
}

@media (max-width: 640px) {
  .article-header {
    flex-direction: column;
    align-items: stretch;
  }

  .article-header__actions {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .article-share {
    align-items: flex-start;
  }
}
`;
ArticleHeader.css = articleHeaderStyles;
ArticleHeader.afterDOMLoaded = shareButton_inline_default;
var ArticleHeader_default = /* @__PURE__ */ __name((() => ArticleHeader), "default");

// quartz/components/ArticleTitle.tsx
import { jsx as jsx14 } from "preact/jsx-runtime";
var ArticleTitle = /* @__PURE__ */ __name(({ fileData, displayClass }) => {
  const title = fileData.frontmatter?.title;
  if (title) {
    return /* @__PURE__ */ jsx14("h1", { class: classNames(displayClass, "article-title"), children: title });
  } else {
    return null;
  }
}, "ArticleTitle");
ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
}
`;
var ArticleTitle_default = /* @__PURE__ */ __name((() => ArticleTitle), "default");

// quartz/components/Canvas.tsx
import { jsx as jsx15, jsxs as jsxs8 } from "preact/jsx-runtime";
var DEFAULT_CANVAS_PATH = "static/canvas/html";
var normalizeCanvasPath = /* @__PURE__ */ __name((path14) => {
  if (!path14) {
    return null;
  }
  const trimmed = path14.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}, "normalizeCanvasPath");
var joinUrl = /* @__PURE__ */ __name((...segments) => {
  if (segments.length === 0) {
    return "";
  }
  return segments.filter((segment) => typeof segment === "string" && segment.length > 0).map((segment, index) => {
    if (index === 0) {
      return segment.replace(/\/+$/g, "");
    }
    return segment.replace(/^\/+|\/+$/g, "");
  }).join("/");
}, "joinUrl");
var normalizeHandle = /* @__PURE__ */ __name((handle) => {
  if (!handle) {
    return null;
  }
  const trimmed = handle.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.replace(/\.html?$/i, "");
}, "normalizeHandle");
var normalizeFrontmatterString = /* @__PURE__ */ __name((value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, "normalizeFrontmatterString");
var splitCanvasReference = /* @__PURE__ */ __name((raw) => {
  const segments = raw.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return { handle: null, subPath: null };
  }
  const fileName = segments.pop();
  const handle = normalizeHandle(fileName);
  const subPath = segments.length > 0 ? segments.join("/") : null;
  return { handle, subPath };
}, "splitCanvasReference");
var pickCanvasReference = /* @__PURE__ */ __name((frontmatter) => {
  const candidates = [frontmatter?.canvas, frontmatter?.canvasSlug, frontmatter?.canvasFile];
  for (const candidate of candidates) {
    const normalized = normalizeFrontmatterString(candidate);
    if (!normalized) {
      continue;
    }
    const { handle, subPath } = splitCanvasReference(normalized);
    if (handle) {
      return { handle, subPath };
    }
  }
  return null;
}, "pickCanvasReference");
var hasCanvasFrontmatter = /* @__PURE__ */ __name((frontmatter) => {
  return pickCanvasReference(frontmatter) !== null;
}, "hasCanvasFrontmatter");
var Canvas_default = /* @__PURE__ */ __name(((options2) => {
  const normalizedCanvasPath = normalizeCanvasPath(options2?.canvasPath) ?? DEFAULT_CANVAS_PATH;
  const Canvas = /* @__PURE__ */ __name((props) => {
    const { fileData, displayClass } = props;
    if (fileData.frontmatter?.draft) {
      return null;
    }
    const canvasReference = pickCanvasReference(fileData.frontmatter);
    if (!canvasReference) {
      return null;
    }
    const frontmatterCanvasPath = normalizeCanvasPath(
      normalizeFrontmatterString(fileData.frontmatter?.canvasPath) ?? canvasReference.subPath ?? void 0
    );
    const resolvedCanvasPath = frontmatterCanvasPath ?? normalizedCanvasPath;
    if (!resolvedCanvasPath) {
      return null;
    }
    const rootPath = fileData.slug ? pathToRoot(fileData.slug) : ".";
    const prefix = rootPath === "." ? "" : rootPath;
    const iframeSrc = encodeURI(joinUrl(prefix, resolvedCanvasPath, `${canvasReference.handle}.html`));
    const description = typeof fileData.frontmatter?.canvasDescription === "string" ? fileData.frontmatter?.canvasDescription : typeof fileData.frontmatter?.description === "string" ? fileData.frontmatter?.description : null;
    const title = fileData.frontmatter?.title ?? canvasReference.handle.split("-").map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ");
    return /* @__PURE__ */ jsxs8("section", { class: classNames(displayClass, "canvas-container"), "data-canvas": canvasReference.handle, children: [
      /* @__PURE__ */ jsxs8("div", { class: "canvas-frame", children: [
        /* @__PURE__ */ jsx15(
          "iframe",
          {
            src: iframeSrc,
            title: `Canvas visualization: ${title}`,
            allow: "fullscreen",
            scrolling: "no"
          }
        ),
        /* @__PURE__ */ jsxs8("div", { class: "canvas-loading", role: "status", "aria-live": "polite", children: [
          /* @__PURE__ */ jsx15("span", { class: "canvas-spinner", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx15("span", { class: "canvas-loading__text", children: "Loading canvas\u2026" })
        ] })
      ] }),
      description ? /* @__PURE__ */ jsx15("p", { class: "canvas-caption", children: description }) : null
    ] });
  }, "Canvas");
  Canvas.css = `
.canvas-container {
  margin: 2rem 0 1.5rem;
  width: 100%;
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.page-footer > .canvas-container {
  width: 100%;
}

.canvas-frame {
  position: relative;
  width: 100%;
  height: clamp(30rem, 75vh, 62rem);
  background: var(--lightgray);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.15);
  transition: box-shadow 150ms ease, transform 150ms ease;
}

.canvas-frame:hover {
  transform: translateY(-2px);
  box-shadow: 0 1.4rem 2.6rem rgba(0, 0, 0, 0.18);
}

.canvas-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  overflow: hidden;
  display: block;
}

.canvas-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.9));
  color: var(--darkgray);
  transition: opacity 200ms ease, visibility 200ms ease;
  z-index: 1;
}

.canvas-loading.is-hidden {
  opacity: 0;
  visibility: hidden;
}

.canvas-loading.is-error {
  background: rgba(255, 232, 230, 0.95);
  color: var(--color-accent-deep);
}

.canvas-spinner {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  border: 0.35rem solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--secondary);
  animation: canvas-spin 1s linear infinite;
}

.canvas-caption {
  margin: 0.75rem auto 0;
  max-width: 48rem;
  text-align: center;
  color: var(--darkgray);
  font-size: 0.95rem;
}

@keyframes canvas-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .canvas-frame {
    height: clamp(24rem, 60vh, 50rem);
  }
}
`;
  Canvas.afterDOMLoaded = `
  document.querySelectorAll('.canvas-frame').forEach((wrapper) => {
    if (wrapper.dataset.initialized === 'true') {
      return
    }

    const iframe = wrapper.querySelector('iframe')
    const loader = wrapper.querySelector('.canvas-loading')
    const text = loader?.querySelector('.canvas-loading__text')

    if (!iframe || !loader) {
      return
    }

    const markInitialized = () => {
      wrapper.dataset.initialized = 'true'
    }

    const hideLoader = () => {
      if (!loader.classList.contains('is-hidden')) {
        loader.classList.add('is-hidden')
        loader.classList.remove('is-error')
      }
      iframe.dataset.canvasLoaded = 'true'
      markInitialized()
    }

    const showError = () => {
      loader.classList.remove('is-hidden')
      loader.classList.add('is-error')
      if (text) {
        text.textContent = 'Canvas failed to load. Check your exported files.'
      }
      markInitialized()
    }

    function handleLoad() {
      hideLoader()
      iframe.removeEventListener('load', handleLoad)
      iframe.removeEventListener('error', handleError)
    }

    function handleError() {
      showError()
      iframe.removeEventListener('load', handleLoad)
      iframe.removeEventListener('error', handleError)
    }

    iframe.addEventListener('load', handleLoad)
    iframe.addEventListener('error', handleError)

    const iframeAlreadyLoaded = () => {
      if (iframe.dataset.canvasLoaded === 'true') {
        return true
      }

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (doc && doc.readyState === 'complete') {
          return true
        }
      } catch (error) {
        // accessing contentDocument can throw for cross-origin iframes; ignore
      }

      // fallback for browsers that expose readyState/complete differently
      // @ts-ignore non-standard property
      if (typeof iframe.readyState === 'string' && iframe.readyState === 'complete') {
        return true
      }

      return false
    }

    if (iframeAlreadyLoaded()) {
      hideLoader()
    }
  })
`;
  return Canvas;
}), "default");

// quartz/util/theme.ts
var DEFAULT_SANS_SERIF = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
var DEFAULT_MONO = "ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace";
function getFontSpecificationName(spec) {
  if (typeof spec === "string") {
    return spec;
  }
  return spec.name;
}
__name(getFontSpecificationName, "getFontSpecificationName");
function formatFontSpecification(type, spec) {
  if (typeof spec === "string") {
    spec = { name: spec };
  }
  const defaultIncludeWeights = type === "header" ? [400, 700] : [400, 600];
  const defaultIncludeItalic = type === "body";
  const weights = spec.weights ?? defaultIncludeWeights;
  const italic = spec.includeItalic ?? defaultIncludeItalic;
  const features = [];
  if (italic) {
    features.push("ital");
  }
  if (weights.length > 1) {
    const weightSpec = italic ? weights.flatMap((w) => [`0,${w}`, `1,${w}`]).sort().join(";") : weights.join(";");
    features.push(`wght@${weightSpec}`);
  }
  if (features.length > 0) {
    return `${spec.name}:${features.join(",")}`;
  }
  return spec.name;
}
__name(formatFontSpecification, "formatFontSpecification");
function googleFontHref(theme) {
  const { header, body, code } = theme.typography;
  const headerFont = formatFontSpecification("header", header);
  const bodyFont = formatFontSpecification("body", body);
  const codeFont = formatFontSpecification("code", code);
  return `https://fonts.googleapis.com/css2?family=${headerFont}&family=${bodyFont}&family=${codeFont}&display=swap`;
}
__name(googleFontHref, "googleFontHref");
function googleFontSubsetHref(theme, text) {
  const title = theme.typography.title || theme.typography.header;
  const titleFont = formatFontSpecification("title", title);
  return `https://fonts.googleapis.com/css2?family=${titleFont}&text=${encodeURIComponent(text)}&display=swap`;
}
__name(googleFontSubsetHref, "googleFontSubsetHref");
var fontMimeMap = {
  truetype: "ttf",
  woff: "woff",
  woff2: "woff2",
  opentype: "otf"
};
async function processGoogleFonts(stylesheet) {
  const fontSourceRegex = /url\((https:\/\/fonts.gstatic.com\/.+(?:\/|(?:kit=))(.+?)[.&].+?)\)\sformat\('(\w+?)'\);/g;
  const fontFiles = [];
  let processedStylesheet = stylesheet;
  let match;
  while ((match = fontSourceRegex.exec(stylesheet)) !== null) {
    const url = match[1];
    const filename = match[2];
    const extension = fontMimeMap[match[3].toLowerCase()];
    const staticUrl = `/static/fonts/${filename}.${extension}`;
    processedStylesheet = processedStylesheet.replace(url, staticUrl);
    fontFiles.push({ url, filename, extension });
  }
  return { processedStylesheet, fontFiles };
}
__name(processGoogleFonts, "processGoogleFonts");
function joinStyles(theme, ...stylesheet) {
  const serializeCssVariables = /* @__PURE__ */ __name((vars) => {
    if (!vars || Object.keys(vars).length === 0) {
      return "";
    }
    return Object.entries(vars).map(([key, value]) => `  --${key}: ${value};`).join("\n");
  }, "serializeCssVariables");
  const lightModeCustomVars = serializeCssVariables(theme.colors.lightMode.cssVars);
  const darkModeCustomVars = serializeCssVariables(theme.colors.darkMode.cssVars);
  const rootLines = [
    ":root {",
    `  --light: ${theme.colors.lightMode.light};`,
    `  --lightgray: ${theme.colors.lightMode.lightgray};`,
    `  --gray: ${theme.colors.lightMode.gray};`,
    `  --darkgray: ${theme.colors.lightMode.darkgray};`,
    `  --dark: ${theme.colors.lightMode.dark};`,
    `  --secondary: ${theme.colors.lightMode.secondary};`,
    `  --tertiary: ${theme.colors.lightMode.tertiary};`,
    `  --highlight: ${theme.colors.lightMode.highlight};`,
    `  --textHighlight: ${theme.colors.lightMode.textHighlight};`
  ];
  if (lightModeCustomVars) {
    rootLines.push(lightModeCustomVars);
  }
  rootLines.push(
    `  --titleFont: "${getFontSpecificationName(theme.typography.title || theme.typography.header)}", ${DEFAULT_SANS_SERIF};`,
    `  --headerFont: "${getFontSpecificationName(theme.typography.header)}", ${DEFAULT_SANS_SERIF};`,
    `  --bodyFont: "${getFontSpecificationName(theme.typography.body)}", ${DEFAULT_SANS_SERIF};`,
    `  --codeFont: "${getFontSpecificationName(theme.typography.code)}", ${DEFAULT_MONO};`,
    "}"
  );
  const darkLines = [
    ':root[saved-theme="dark"] {',
    `  --light: ${theme.colors.darkMode.light};`,
    `  --lightgray: ${theme.colors.darkMode.lightgray};`,
    `  --gray: ${theme.colors.darkMode.gray};`,
    `  --darkgray: ${theme.colors.darkMode.darkgray};`,
    `  --dark: ${theme.colors.darkMode.dark};`,
    `  --secondary: ${theme.colors.darkMode.secondary};`,
    `  --tertiary: ${theme.colors.darkMode.tertiary};`,
    `  --highlight: ${theme.colors.darkMode.highlight};`,
    `  --textHighlight: ${theme.colors.darkMode.textHighlight};`
  ];
  if (darkModeCustomVars) {
    darkLines.push(darkModeCustomVars);
  }
  darkLines.push("}");
  const combinedStyles = stylesheet.join("\n\n");
  return `
${combinedStyles}

${rootLines.join("\n")}

${darkLines.join("\n")}
`;
}
__name(joinStyles, "joinStyles");

// quartz/util/og.tsx
import readingTime from "reading-time";
import { jsx as jsx16, jsxs as jsxs9 } from "preact/jsx-runtime";

// quartz/plugins/emitters/ogImage.tsx
import sharp from "sharp";
import satori from "satori";

// quartz/util/emoji.ts
var U200D = String.fromCharCode(8205);

// quartz/plugins/emitters/helpers.ts
import path6 from "path";
import fs3 from "fs";
var write = /* @__PURE__ */ __name(async ({ ctx, slug, ext, content }) => {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext);
  const dir = path6.dirname(pathToPage);
  await fs3.promises.mkdir(dir, { recursive: true });
  await fs3.promises.writeFile(pathToPage, content);
  return pathToPage;
}, "write");

// quartz/plugins/emitters/ogImage.tsx
import { Fragment as Fragment6, jsx as jsx17, jsxs as jsxs10 } from "preact/jsx-runtime";
var CustomOgImagesEmitterName = "CustomOgImages";

// quartz/components/Head.tsx
import { Fragment as Fragment7, jsx as jsx18, jsxs as jsxs11 } from "preact/jsx-runtime";
var Head_default = /* @__PURE__ */ __name((() => {
  const Head = /* @__PURE__ */ __name(({
    cfg,
    fileData,
    externalResources,
    ctx
  }) => {
    const titleSuffix = cfg.pageTitleSuffix ?? "";
    const baseTitle = fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title;
    const title = fileData.slug === "index" ? "7/10 Tone Wiki" : `${baseTitle}${titleSuffix}`;
    const description = fileData.frontmatter?.socialDescription ?? fileData.frontmatter?.description ?? unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description);
    const { css, js, additionalHead } = externalResources;
    const rawBaseUrl = cfg.baseUrl ?? "example.com";
    const normalizedBaseUrl = rawBaseUrl.startsWith("http") ? rawBaseUrl : `https://${rawBaseUrl}`;
    const url = new URL(normalizedBaseUrl);
    const path14 = url.pathname;
    const baseDir = fileData.slug === "404" ? path14 : pathToRoot(fileData.slug);
    const assetVersion = getAssetVersion();
    const iconPath = `${joinSegments(baseDir, "static/icon.png")}?v=${assetVersion}`;
    const canonicalSlug = simplifySlug(fileData.slug);
    const socialUrl = fileData.slug === "404" ? url.toString() : joinSegments(url.origin, canonicalSlug);
    const usesCustomOgImage = ctx.cfg.plugins.emitters.some(
      (e) => e.name === CustomOgImagesEmitterName
    );
    const ogImageDefaultPath = cfg.baseUrl ? new URL("/static/og-image.png", normalizedBaseUrl).toString() : void 0;
    return /* @__PURE__ */ jsxs11("head", { children: [
      /* @__PURE__ */ jsx18("title", { children: title }),
      /* @__PURE__ */ jsx18("meta", { charSet: "utf-8" }),
      cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && /* @__PURE__ */ jsxs11(Fragment7, { children: [
        /* @__PURE__ */ jsx18("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }),
        /* @__PURE__ */ jsx18("link", { rel: "preconnect", href: "https://fonts.gstatic.com" }),
        /* @__PURE__ */ jsx18("link", { rel: "stylesheet", href: googleFontHref(cfg.theme) }),
        cfg.theme.typography.title && /* @__PURE__ */ jsx18("link", { rel: "stylesheet", href: googleFontSubsetHref(cfg.theme, cfg.pageTitle) })
      ] }),
      /* @__PURE__ */ jsx18("link", { rel: "preconnect", href: "https://cdnjs.cloudflare.com", crossOrigin: "anonymous" }),
      /* @__PURE__ */ jsx18("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }),
      /* @__PURE__ */ jsx18("meta", { name: "og:site_name", content: cfg.pageTitle }),
      /* @__PURE__ */ jsx18("meta", { property: "og:title", content: title }),
      /* @__PURE__ */ jsx18("meta", { property: "og:type", content: "website" }),
      /* @__PURE__ */ jsx18("meta", { name: "twitter:card", content: "summary_large_image" }),
      /* @__PURE__ */ jsx18("meta", { name: "twitter:title", content: title }),
      /* @__PURE__ */ jsx18("meta", { name: "twitter:description", content: description }),
      /* @__PURE__ */ jsx18("meta", { property: "og:description", content: description }),
      /* @__PURE__ */ jsx18("meta", { property: "og:image:alt", content: description }),
      !usesCustomOgImage && ogImageDefaultPath && /* @__PURE__ */ jsxs11(Fragment7, { children: [
        /* @__PURE__ */ jsx18("meta", { property: "og:image", content: ogImageDefaultPath }),
        /* @__PURE__ */ jsx18("meta", { property: "og:image:url", content: ogImageDefaultPath }),
        /* @__PURE__ */ jsx18("meta", { name: "twitter:image", content: ogImageDefaultPath }),
        /* @__PURE__ */ jsx18(
          "meta",
          {
            property: "og:image:type",
            content: `image/${getFileExtension(ogImageDefaultPath) ?? "png"}`
          }
        )
      ] }),
      cfg.baseUrl && /* @__PURE__ */ jsxs11(Fragment7, { children: [
        /* @__PURE__ */ jsx18("meta", { property: "twitter:domain", content: url.host }),
        /* @__PURE__ */ jsx18("meta", { property: "og:url", content: socialUrl }),
        /* @__PURE__ */ jsx18("meta", { property: "twitter:url", content: socialUrl })
      ] }),
      /* @__PURE__ */ jsx18("link", { rel: "icon", href: iconPath }),
      /* @__PURE__ */ jsx18("meta", { name: "description", content: description }),
      /* @__PURE__ */ jsx18("meta", { name: "generator", content: "Quartz" }),
      css.map((resource) => CSSResourceToStyleElement(resource, true)),
      js.filter((resource) => resource.loadTime === "beforeDOMReady").map((res) => JSResourceToScriptElement(res, true)),
      additionalHead.map((resource) => {
        if (typeof resource === "function") {
          return resource(fileData);
        } else {
          return resource;
        }
      })
    ] });
  }, "Head");
  return Head;
}), "default");

// quartz/components/PageTitle.tsx
import { jsx as jsx19, jsxs as jsxs12 } from "preact/jsx-runtime";
var PageTitle = /* @__PURE__ */ __name(({ fileData, cfg, displayClass }) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title;
  const baseDir = pathToRoot(fileData.slug);
  const assetVersion = `?v=${getAssetVersion()}`;
  const logoPath = `${joinSegments(baseDir, "static/wiki_logo.png")}${assetVersion}`;
  const bannerPath = `${joinSegments(baseDir, "static/branding/banner.png")}${assetVersion}`;
  return /* @__PURE__ */ jsx19("div", { class: classNames(displayClass, "page-title-container"), children: /* @__PURE__ */ jsxs12("a", { class: "page-title-link", href: baseDir, "aria-label": title, "data-no-popover": "true", children: [
    /* @__PURE__ */ jsx19(
      "img",
      {
        class: "logo-desktop Logo site-logo",
        src: logoPath,
        alt: title,
        loading: "lazy",
        decoding: "async",
        "data-no-zoom": "true"
      }
    ),
    /* @__PURE__ */ jsx19("span", { class: "banner-wrapper", children: /* @__PURE__ */ jsx19(
      "img",
      {
        class: "banner-mobile",
        src: bannerPath,
        alt: title,
        loading: "lazy",
        decoding: "async",
        "data-no-zoom": "true"
      }
    ) })
  ] }) });
}, "PageTitle");
PageTitle.css = `
.page-title-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.page-title-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-decoration: none;
  cursor: pointer;
}

.logo-desktop {
  display: block;
  max-width: clamp(200px, 16vw, 260px);
  width: min(100%, clamp(200px, 16vw, 260px));
  height: auto;
}

.banner-wrapper {
  display: none;
  width: 100%;
  max-height: 7.5rem;
  aspect-ratio: 3 / 1;
  border-radius: 0;
  overflow: hidden;
}

.banner-mobile {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

@media screen and (max-width: 800px) {
  .page-title-container {
    margin-inline: calc(-1 * clamp(0.75rem, 3vw, 2.5rem));
    width: calc(100% + 2 * clamp(0.75rem, 3vw, 2.5rem));
  }

  .logo-desktop {
    display: none;
  }

  .banner-wrapper {
    display: block;
  }

  .banner-mobile {
    height: 100%;
  }
}
`;
var PageTitle_default = /* @__PURE__ */ __name((() => PageTitle), "default");

// quartz/components/styles/contentMeta.scss
var contentMeta_default = "";

// quartz/components/ContentMeta.tsx
import { jsx as jsx20, jsxs as jsxs13 } from "preact/jsx-runtime";
var ContentMeta_default = /* @__PURE__ */ __name((() => {
  const ContentMetadata = /* @__PURE__ */ __name(({ cfg, fileData, displayClass }) => {
    if (!fileData.dates) {
      return null;
    }
    const updatedDate = getDate(cfg, fileData);
    if (!updatedDate) {
      return null;
    }
    return /* @__PURE__ */ jsxs13("div", { class: classNames(displayClass, "content-meta"), children: [
      /* @__PURE__ */ jsx20("span", { class: "content-meta__label", children: "Updated" }),
      /* @__PURE__ */ jsx20(Date2, { date: updatedDate, locale: cfg.locale })
    ] });
  }, "ContentMetadata");
  ContentMetadata.css = contentMeta_default;
  return ContentMetadata;
}), "default");

// quartz/components/Spacer.tsx
import { jsx as jsx21 } from "preact/jsx-runtime";

// quartz/components/styles/legacyToc.scss
var legacyToc_default = "";

// quartz/components/styles/toc.scss
var toc_default = "";

// quartz/components/scripts/toc.inline.ts
var toc_inline_default = "";

// quartz/components/OverflowList.tsx
import { jsx as jsx22, jsxs as jsxs14 } from "preact/jsx-runtime";
var OverflowList = /* @__PURE__ */ __name(({
  children,
  ...props
}) => {
  return /* @__PURE__ */ jsxs14("ul", { ...props, class: [props.class, "overflow"].filter(Boolean).join(" "), id: props.id, children: [
    children,
    /* @__PURE__ */ jsx22("li", { class: "overflow-end" })
  ] });
}, "OverflowList");
var numLists = 0;
var OverflowList_default = /* @__PURE__ */ __name(() => {
  const id = `list-${numLists++}`;
  return {
    OverflowList: /* @__PURE__ */ __name((props) => /* @__PURE__ */ jsx22(OverflowList, { ...props, id }), "OverflowList"),
    overflowListAfterDOMLoaded: `
document.addEventListener("nav", () => {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const parentUl = entry.target.parentElement
      if (!parentUl) return
      if (entry.isIntersecting) {
        parentUl.classList.remove("gradient-active")
      } else {
        parentUl.classList.add("gradient-active")
      }
    }
  })

  const ul = document.getElementById("${id}")
  if (!ul) return

  const end = ul.querySelector(".overflow-end")
  if (!end) return

  observer.observe(end)
  window.addCleanup(() => observer.disconnect())

  const scrollHostCandidate = ul.closest(".explorer-content, .toc-content, .backlinks-content")
  const scrollContainer = scrollHostCandidate instanceof HTMLElement ? scrollHostCandidate : ul
  const hostCandidate =
    scrollContainer.closest(".explorer") ||
    scrollContainer.closest(".toc-container") ||
    scrollContainer.closest(".backlinks-container")
  const proxyHost = hostCandidate instanceof HTMLElement ? hostCandidate : scrollContainer

  if (!(proxyHost instanceof HTMLElement)) {
    return
  }

  const wheelHandler = (event) => {
    if (proxyHost.classList.contains("collapsed") || scrollContainer.classList.contains("collapsed")) {
      return
    }

    if (scrollContainer.scrollHeight <= scrollContainer.clientHeight + 1) {
      return
    }

    const multiplier =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? scrollContainer.clientHeight
          : 1
    const delta = event.deltaY * multiplier
    if (delta === 0) {
      return
    }

    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight
    const nextScroll = Math.min(maxScroll, Math.max(0, scrollContainer.scrollTop + delta))

    if (nextScroll === scrollContainer.scrollTop) {
      return
    }

    scrollContainer.scrollTop = nextScroll
    event.preventDefault()
    event.stopPropagation()
  }

  const wheelTargets = []

  const registerWheelTarget = (element) => {
    if (!element || element.dataset.scrollProxyBound === "true") {
      return
    }

    element.addEventListener("wheel", wheelHandler, { passive: false })
    element.dataset.scrollProxyBound = "true"
    wheelTargets.push(element)
  }

  registerWheelTarget(proxyHost)
  if (scrollContainer !== proxyHost) {
    registerWheelTarget(scrollContainer)
  }

  window.addCleanup(() => {
    wheelTargets.forEach((element) => {
      element.removeEventListener("wheel", wheelHandler)
      if (element.dataset.scrollProxyBound === "true") {
        delete element.dataset.scrollProxyBound
      }
    })
  })
})
`
  };
}, "default");

// quartz/components/TableOfContents.tsx
import { jsx as jsx23, jsxs as jsxs15 } from "preact/jsx-runtime";
var defaultOptions11 = {
  layout: "modern",
  defaultCollapsed: false
};
var numTocs = 0;
var TableOfContents_default = /* @__PURE__ */ __name(((opts) => {
  const layout = opts?.layout ?? defaultOptions11.layout;
  const layoutCollapsedOverride = opts?.defaultCollapsed;
  const { OverflowList: OverflowList2, overflowListAfterDOMLoaded } = OverflowList_default();
  const TableOfContents2 = /* @__PURE__ */ __name(({
    fileData,
    displayClass,
    cfg
  }) => {
    if (!fileData.toc) {
      return null;
    }
    const id = `toc-${numTocs++}`;
    const initiallyCollapsed = layoutCollapsedOverride !== void 0 ? layoutCollapsedOverride : fileData.collapseToc ?? defaultOptions11.defaultCollapsed;
    return /* @__PURE__ */ jsx23("div", { class: classNames(displayClass, "toc"), children: /* @__PURE__ */ jsxs15("div", { class: "toc-container", children: [
      /* @__PURE__ */ jsxs15(
        "button",
        {
          type: "button",
          class: initiallyCollapsed ? "collapsed toc-header" : "toc-header",
          "aria-controls": id,
          "aria-expanded": !initiallyCollapsed,
          children: [
            /* @__PURE__ */ jsx23("h3", { children: i18n(cfg.locale).components.tableOfContents.title }),
            /* @__PURE__ */ jsx23(
              "svg",
              {
                xmlns: "http://www.w3.org/2000/svg",
                width: "20",
                height: "20",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                class: "fold",
                children: /* @__PURE__ */ jsx23("polyline", { points: "6 9 12 15 18 9" })
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsx23("span", { class: "toc-scroll-indicator", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx23(
        OverflowList2,
        {
          id,
          class: initiallyCollapsed ? "collapsed toc-content" : "toc-content",
          children: fileData.toc.map((tocEntry) => /* @__PURE__ */ jsx23("li", { class: `depth-${tocEntry.depth}`, children: /* @__PURE__ */ jsx23("a", { href: `#${tocEntry.slug}`, "data-for": tocEntry.slug, children: tocEntry.text }) }, tocEntry.slug))
        }
      )
    ] }) });
  }, "TableOfContents");
  TableOfContents2.css = toc_default;
  TableOfContents2.afterDOMLoaded = concatenateResources(toc_inline_default, overflowListAfterDOMLoaded);
  const LegacyTableOfContents = /* @__PURE__ */ __name(({ fileData, cfg }) => {
    if (!fileData.toc) {
      return null;
    }
    const initiallyCollapsed = layoutCollapsedOverride !== void 0 ? layoutCollapsedOverride : fileData.collapseToc ?? defaultOptions11.defaultCollapsed;
    return /* @__PURE__ */ jsxs15("details", { class: "toc", open: !initiallyCollapsed, children: [
      /* @__PURE__ */ jsx23("summary", { children: /* @__PURE__ */ jsx23("h3", { children: i18n(cfg.locale).components.tableOfContents.title }) }),
      /* @__PURE__ */ jsx23("ul", { children: fileData.toc.map((tocEntry) => /* @__PURE__ */ jsx23("li", { class: `depth-${tocEntry.depth}`, children: /* @__PURE__ */ jsx23("a", { href: `#${tocEntry.slug}`, "data-for": tocEntry.slug, children: tocEntry.text }) }, tocEntry.slug)) })
    ] });
  }, "LegacyTableOfContents");
  LegacyTableOfContents.css = legacyToc_default;
  return layout === "modern" ? TableOfContents2 : LegacyTableOfContents;
}), "default");

// quartz/components/styles/explorer.scss
var explorer_default = "";

// quartz/components/scripts/explorer.inline.ts
var explorer_inline_default = "";

// quartz/components/Explorer.tsx
import { jsx as jsx24, jsxs as jsxs16 } from "preact/jsx-runtime";
var defaultOptions12 = {
  folderDefaultState: "collapsed",
  folderClickBehavior: "link",
  useSavedState: true,
  startCollapsed: true,
  mapFn: /* @__PURE__ */ __name((node) => {
    return node;
  }, "mapFn"),
  sortFn: /* @__PURE__ */ __name((a, b) => {
    if (!a.isFolder && !b.isFolder || a.isFolder && b.isFolder) {
      return a.displayName.localeCompare(b.displayName, void 0, {
        numeric: true,
        sensitivity: "base"
      });
    }
    if (!a.isFolder && b.isFolder) {
      return 1;
    } else {
      return -1;
    }
  }, "sortFn"),
  filterFn: /* @__PURE__ */ __name((node) => {
    const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : "";
    if (segment === "explorables") {
      return true;
    }
    const hiddenSegments = /* @__PURE__ */ new Set([
      "tags",
      "canvases",
      "guides",
      "media",
      "contribute",
      "timelines",
      "puzzles"
    ]);
    return !hiddenSegments.has(segment);
  }, "filterFn"),
  order: ["filter", "map", "sort"]
};
var numExplorers = 0;
var Explorer_default = /* @__PURE__ */ __name(((userOpts) => {
  const opts = { ...defaultOptions12, ...userOpts };
  const { OverflowList: OverflowList2, overflowListAfterDOMLoaded } = OverflowList_default();
  const Explorer = /* @__PURE__ */ __name((componentProps) => {
    const { cfg, displayClass } = componentProps;
    const id = `explorer-${numExplorers++}`;
    const rootClasses = classNames(
      displayClass,
      "explorer",
      opts.startCollapsed ? "collapsed" : ""
    );
    const HeaderSlot = opts.headerSlot;
    return /* @__PURE__ */ jsxs16(
      "div",
      {
        class: rootClasses,
        "data-behavior": opts.folderClickBehavior,
        "data-collapsed": opts.folderDefaultState,
        "data-savestate": opts.useSavedState,
        "data-data-fns": JSON.stringify({
          order: opts.order,
          sortFn: opts.sortFn.toString(),
          filterFn: opts.filterFn.toString(),
          mapFn: opts.mapFn.toString()
        }),
        children: [
          /* @__PURE__ */ jsxs16("div", { class: "explorer-header", children: [
            /* @__PURE__ */ jsx24(
              "button",
              {
                type: "button",
                class: "explorer-toggle mobile-explorer hide-until-loaded",
                "data-mobile": true,
                "aria-controls": id,
                "aria-expanded": opts.folderDefaultState !== "collapsed",
                children: /* @__PURE__ */ jsxs16(
                  "svg",
                  {
                    xmlns: "http://www.w3.org/2000/svg",
                    width: "24",
                    height: "24",
                    viewBox: "0 0 24 24",
                    "stroke-width": "2",
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round",
                    class: "lucide-menu",
                    children: [
                      /* @__PURE__ */ jsx24("line", { x1: "4", x2: "20", y1: "12", y2: "12" }),
                      /* @__PURE__ */ jsx24("line", { x1: "4", x2: "20", y1: "6", y2: "6" }),
                      /* @__PURE__ */ jsx24("line", { x1: "4", x2: "20", y1: "18", y2: "18" })
                    ]
                  }
                )
              }
            ),
            /* @__PURE__ */ jsxs16(
              "button",
              {
                type: "button",
                class: "title-button explorer-toggle desktop-explorer",
                "data-mobile": false,
                "aria-expanded": opts.folderDefaultState !== "collapsed",
                children: [
                  /* @__PURE__ */ jsx24("h2", { children: opts.title ?? i18n(cfg.locale).components.explorer.title }),
                  /* @__PURE__ */ jsx24(
                    "svg",
                    {
                      xmlns: "http://www.w3.org/2000/svg",
                      width: "20",
                      height: "20",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "2",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                      class: "fold",
                      children: /* @__PURE__ */ jsx24("polyline", { points: "6 9 12 15 18 9" })
                    }
                  )
                ]
              }
            ),
            HeaderSlot ? /* @__PURE__ */ jsx24("div", { class: "explorer-header-slot", children: /* @__PURE__ */ jsx24(HeaderSlot, { ...componentProps }) }) : null
          ] }),
          /* @__PURE__ */ jsx24(
            "div",
            {
              id,
              class: "explorer-content",
              "aria-expanded": opts.folderDefaultState !== "collapsed",
              role: "group",
              children: /* @__PURE__ */ jsx24(OverflowList2, { class: "explorer-ul" })
            }
          ),
          /* @__PURE__ */ jsx24("template", { id: "template-file", children: /* @__PURE__ */ jsx24("li", { children: /* @__PURE__ */ jsx24("a", { href: "#" }) }) }),
          /* @__PURE__ */ jsx24("template", { id: "template-folder", children: /* @__PURE__ */ jsxs16("li", { children: [
            /* @__PURE__ */ jsxs16("div", { class: "folder-container", children: [
              /* @__PURE__ */ jsx24(
                "svg",
                {
                  xmlns: "http://www.w3.org/2000/svg",
                  width: "12",
                  height: "12",
                  viewBox: "5 8 14 8",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": "2",
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  class: "folder-icon",
                  children: /* @__PURE__ */ jsx24("polyline", { points: "6 9 12 15 18 9" })
                }
              ),
              /* @__PURE__ */ jsx24("div", { children: /* @__PURE__ */ jsx24("button", { class: "folder-button", children: /* @__PURE__ */ jsx24("span", { class: "folder-title" }) }) })
            ] }),
            /* @__PURE__ */ jsx24("div", { class: "folder-outer", children: /* @__PURE__ */ jsx24("ul", { class: "content" }) })
          ] }) })
        ]
      }
    );
  }, "Explorer");
  Explorer.css = explorer_default;
  Explorer.afterDOMLoaded = concatenateResources(explorer_inline_default, overflowListAfterDOMLoaded);
  return Explorer;
}), "default");

// quartz/components/TagList.tsx
import { jsx as jsx25 } from "preact/jsx-runtime";
var TagList = /* @__PURE__ */ __name(({ fileData, displayClass }) => {
  const tags = fileData.frontmatter?.tags;
  if (tags && tags.length > 0) {
    return /* @__PURE__ */ jsx25("ul", { class: classNames(displayClass, "tags"), children: tags.map((tag) => {
      const linkDest = resolveRelative(fileData.slug, `tags/${tag}`);
      return /* @__PURE__ */ jsx25("li", { children: /* @__PURE__ */ jsx25("a", { href: linkDest, class: "internal tag-link", children: tag }) }, tag);
    }) });
  } else {
    return null;
  }
}, "TagList");
TagList.css = `
.tags {
  list-style: none;
  display: flex;
  padding-left: 0;
  gap: 0.4rem;
  margin: 1rem 0;
  flex-wrap: wrap;
}

.section-li > .section > .tags {
  justify-content: flex-end;
}
  
.tags > li {
  display: inline-block;
  white-space: nowrap;
  margin: 0;
  overflow-wrap: normal;
}

a.internal.tag-link {
  border-radius: 8px;
  background-color: var(--highlight);
  padding: 0.2rem 0.4rem;
  margin: 0 0.1rem;
}
`;
var TagList_default = /* @__PURE__ */ __name((() => TagList), "default");

// quartz/components/scripts/graph.inline.ts
var graph_inline_default = "";

// quartz/components/styles/graph.scss
var graph_default = "";

// quartz/components/Graph.tsx
import { jsx as jsx26, jsxs as jsxs17 } from "preact/jsx-runtime";
var defaultOptions13 = {
  localGraph: {
    drag: true,
    zoom: true,
    depth: 1,
    scale: 1.1,
    autoZoom: {
      enabled: true,
      padding: 1.2,
      zoomLevels: {
        nodes1: 6,
        nodes2: 5,
        nodes3: 3.5,
        nodes4: 3,
        nodes5: 2.7,
        nodes6: 2.4,
        nodes7to9: 2.1,
        nodes10to15: 1.7,
        nodes15to25: 1.2,
        nodesAbove25: 1
      }
    },
    repelForce: 0.5,
    centerForce: 0.3,
    linkDistance: 30,
    fontSize: 0.8,
    opacityScale: 1.6,
    labelVisibility: {
      minAlpha: 0.05,
      maxAlpha: 1,
      startZoom: 1,
      endZoom: 2.9
    },
    showTags: true,
    removeTags: [],
    focusOnHover: false,
    enableRadial: false
  },
  globalGraph: {
    drag: true,
    zoom: true,
    depth: -1,
    scale: 0.9,
    autoZoom: {
      enabled: true,
      padding: 1.15,
      zoomLevels: {
        nodes1: 2.4,
        nodes2: 2.2,
        nodes3: 2,
        nodes4: 1.85,
        nodes5: 1.75,
        nodes6: 1.65,
        nodes7to9: 1.5,
        nodes10to15: 1.2,
        nodes15to25: 1,
        nodesAbove25: 0.85
      }
    },
    repelForce: 0.5,
    centerForce: 0.2,
    linkDistance: 30,
    fontSize: 0.75,
    opacityScale: 1.4,
    labelVisibility: {
      minAlpha: 0.2,
      maxAlpha: 1,
      startZoom: 0.9,
      endZoom: 2.4
    },
    showTags: true,
    removeTags: [],
    focusOnHover: true,
    enableRadial: true
  }
};
var Graph_default = /* @__PURE__ */ __name(((opts) => {
  const Graph = /* @__PURE__ */ __name(({ displayClass, cfg }) => {
    const localGraph = { ...defaultOptions13.localGraph, ...opts?.localGraph };
    const globalGraph = { ...defaultOptions13.globalGraph, ...opts?.globalGraph };
    const controlDefaults = {
      repelForce: globalGraph.repelForce ?? 0.5,
      centerForce: globalGraph.centerForce ?? 0.2,
      linkDistance: globalGraph.linkDistance ?? 30
    };
    return /* @__PURE__ */ jsxs17("div", { class: classNames(displayClass, "graph"), children: [
      /* @__PURE__ */ jsxs17(
        "div",
        {
          class: "graph__heading-row",
          style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
          children: [
            /* @__PURE__ */ jsx26("h3", { children: i18n(cfg.locale).components.graph.title }),
            /* @__PURE__ */ jsx26("button", { class: "graph__show-full", type: "button", children: "SHOW FULL GRAPH" })
          ]
        }
      ),
      /* @__PURE__ */ jsx26("div", { class: "graph-outer", children: /* @__PURE__ */ jsx26("div", { class: "graph-container", "data-cfg": JSON.stringify(localGraph) }) }),
      /* @__PURE__ */ jsx26(
        "div",
        {
          class: "global-graph-outer",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Full graph preview",
          children: /* @__PURE__ */ jsxs17("div", { class: "global-graph-content", children: [
            /* @__PURE__ */ jsxs17("aside", { class: "global-graph-controls", "data-graph-controls": true, children: [
              /* @__PURE__ */ jsxs17("div", { class: "graph-controls__header", children: [
                /* @__PURE__ */ jsx26("h4", { class: "graph-controls__title", children: "Graph Controls" }),
                /* @__PURE__ */ jsx26(
                  "button",
                  {
                    class: "graph-controls__close",
                    type: "button",
                    "data-graph-close": true,
                    "aria-label": "Close full graph",
                    children: /* @__PURE__ */ jsx26("span", { "aria-hidden": "true", children: "\xD7" })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs17("div", { class: "graph-controls__body", children: [
                /* @__PURE__ */ jsxs17("label", { class: "graph-control", for: "graph-slider-repel", children: [
                  /* @__PURE__ */ jsx26("span", { class: "graph-control__label", children: "Repel Force" }),
                  /* @__PURE__ */ jsxs17("div", { class: "graph-control__range", children: [
                    /* @__PURE__ */ jsx26(
                      "input",
                      {
                        class: "graph-control__slider",
                        type: "range",
                        min: "0.1",
                        max: "2",
                        step: "0.05",
                        id: "graph-slider-repel",
                        value: controlDefaults.repelForce.toString(),
                        "data-graph-slider": "repelForce",
                        "aria-label": "Repel force"
                      }
                    ),
                    /* @__PURE__ */ jsx26("span", { class: "graph-control__value", "data-graph-value": "repelForce", children: controlDefaults.repelForce.toFixed(2) })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs17("label", { class: "graph-control", for: "graph-slider-center", children: [
                  /* @__PURE__ */ jsx26("span", { class: "graph-control__label", children: "Center Force" }),
                  /* @__PURE__ */ jsxs17("div", { class: "graph-control__range", children: [
                    /* @__PURE__ */ jsx26(
                      "input",
                      {
                        class: "graph-control__slider",
                        type: "range",
                        min: "0",
                        max: "2",
                        step: "0.05",
                        id: "graph-slider-center",
                        value: controlDefaults.centerForce.toString(),
                        "data-graph-slider": "centerForce",
                        "aria-label": "Center force"
                      }
                    ),
                    /* @__PURE__ */ jsx26("span", { class: "graph-control__value", "data-graph-value": "centerForce", children: controlDefaults.centerForce.toFixed(2) })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs17("label", { class: "graph-control", for: "graph-slider-distance", children: [
                  /* @__PURE__ */ jsx26("span", { class: "graph-control__label", children: "Link Distance" }),
                  /* @__PURE__ */ jsxs17("div", { class: "graph-control__range", children: [
                    /* @__PURE__ */ jsx26(
                      "input",
                      {
                        class: "graph-control__slider",
                        type: "range",
                        min: "12",
                        max: "160",
                        step: "2",
                        id: "graph-slider-distance",
                        value: controlDefaults.linkDistance.toString(),
                        "data-graph-slider": "linkDistance",
                        "aria-label": "Link distance"
                      }
                    ),
                    /* @__PURE__ */ jsxs17("span", { class: "graph-control__value", "data-graph-value": "linkDistance", children: [
                      Math.round(controlDefaults.linkDistance),
                      " px"
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs17("div", { class: "graph-controls__toggles", children: [
                  /* @__PURE__ */ jsxs17("label", { class: "graph-toggle", children: [
                    /* @__PURE__ */ jsx26(
                      "input",
                      {
                        type: "checkbox",
                        class: "graph-toggle__input",
                        "data-graph-toggle": "showSinglets",
                        defaultChecked: true
                      }
                    ),
                    /* @__PURE__ */ jsx26("span", { class: "graph-toggle__label", children: "Show singlets" })
                  ] }),
                  /* @__PURE__ */ jsxs17("label", { class: "graph-toggle", children: [
                    /* @__PURE__ */ jsx26(
                      "input",
                      {
                        type: "checkbox",
                        class: "graph-toggle__input",
                        "data-graph-toggle": "highlightVisited",
                        defaultChecked: true
                      }
                    ),
                    /* @__PURE__ */ jsx26("span", { class: "graph-toggle__label", children: "Highlight visited notes" })
                  ] }),
                  /* @__PURE__ */ jsxs17("label", { class: "graph-toggle", children: [
                    /* @__PURE__ */ jsx26(
                      "input",
                      {
                        type: "checkbox",
                        class: "graph-toggle__input",
                        "data-graph-toggle": "focusOnHover",
                        defaultChecked: globalGraph.focusOnHover !== false
                      }
                    ),
                    /* @__PURE__ */ jsx26("span", { class: "graph-toggle__label", children: "Focus neighbors on hover" })
                  ] })
                ] }),
                /* @__PURE__ */ jsx26("div", { class: "graph-controls__info", children: /* @__PURE__ */ jsx26("p", { children: "Adjust the layout forces or toggle visibility to explore clusters. Boost the center force to pull everything inward, or crank up the repel force for a wider spread." }) })
              ] }),
              /* @__PURE__ */ jsx26("div", { class: "graph-controls__footer", children: /* @__PURE__ */ jsx26("button", { class: "graph-controls__reset", type: "button", "data-graph-reset": true, children: "Reset Controls" }) })
            ] }),
            /* @__PURE__ */ jsxs17("div", { class: "global-graph-stage", children: [
              /* @__PURE__ */ jsx26(
                "div",
                {
                  class: "global-graph-container",
                  "data-cfg": JSON.stringify(globalGraph),
                  "data-graph-mode": "global"
                }
              ),
              /* @__PURE__ */ jsxs17("div", { class: "graph-zoom", "data-graph-zoom-controls": true, children: [
                /* @__PURE__ */ jsx26("button", { type: "button", class: "graph-zoom__button", "data-graph-zoom": "in", "aria-label": "Zoom in", children: "+" }),
                /* @__PURE__ */ jsx26("button", { type: "button", class: "graph-zoom__button", "data-graph-zoom": "out", "aria-label": "Zoom out", children: "\u2212" })
              ] })
            ] })
          ] })
        }
      )
    ] });
  }, "Graph");
  Graph.css = graph_default;
  Graph.afterDOMLoaded = graph_inline_default;
  return Graph;
}), "default");

// quartz/components/styles/backlinks.scss
var backlinks_default = "";

// quartz/components/scripts/backlinks.inline.ts
var backlinks_inline_default = "";

// quartz/components/Backlinks.tsx
import { jsx as jsx27, jsxs as jsxs18 } from "preact/jsx-runtime";
var defaultOptions14 = {
  hideWhenEmpty: true
};
var Backlinks_default = /* @__PURE__ */ __name(((opts) => {
  const options2 = { ...defaultOptions14, ...opts };
  const { OverflowList: OverflowList2, overflowListAfterDOMLoaded } = OverflowList_default();
  let backlinksInstance = 0;
  const Backlinks = /* @__PURE__ */ __name(({
    fileData,
    allFiles,
    displayClass,
    cfg
  }) => {
    const slug = simplifySlug(fileData.slug);
    const backlinkFiles = allFiles.filter((file) => file.links?.includes(slug));
    if (options2.hideWhenEmpty && backlinkFiles.length == 0) {
      return null;
    }
    const containerId = `backlinks-${backlinksInstance++}`;
    return /* @__PURE__ */ jsx27("div", { class: classNames(displayClass, "backlinks"), children: /* @__PURE__ */ jsxs18("div", { class: "backlinks-container collapsed", children: [
      /* @__PURE__ */ jsxs18(
        "button",
        {
          type: "button",
          class: "backlinks-header collapsed",
          "aria-expanded": "false",
          "aria-controls": containerId,
          children: [
            /* @__PURE__ */ jsx27("h3", { children: i18n(cfg.locale).components.backlinks.title }),
            /* @__PURE__ */ jsx27(
              "svg",
              {
                xmlns: "http://www.w3.org/2000/svg",
                width: "20",
                height: "20",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "aria-hidden": "true",
                class: "fold",
                children: /* @__PURE__ */ jsx27("polyline", { points: "6 9 12 15 18 9" })
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsx27(OverflowList2, { id: containerId, class: "backlinks-content collapsed", children: backlinkFiles.length > 0 ? backlinkFiles.map((f) => /* @__PURE__ */ jsx27("li", { children: /* @__PURE__ */ jsx27("a", { href: resolveRelative(fileData.slug, f.slug), class: "internal", children: f.frontmatter?.title }) }, f.slug ?? f.filePath ?? f.frontmatter?.title ?? "backlink")) : /* @__PURE__ */ jsx27("li", { children: i18n(cfg.locale).components.backlinks.noBacklinksFound }) })
    ] }) });
  }, "Backlinks");
  Backlinks.css = backlinks_default;
  Backlinks.afterDOMLoaded = concatenateResources(backlinks_inline_default, overflowListAfterDOMLoaded);
  return Backlinks;
}), "default");

// quartz/components/styles/search.scss
var search_default = "";

// quartz/components/scripts/search.inline.ts
var search_inline_default = "";

// quartz/components/Search.tsx
import { jsx as jsx28, jsxs as jsxs19 } from "preact/jsx-runtime";
var defaultOptions15 = {
  enablePreview: true,
  variant: "card"
};
var Search_default = /* @__PURE__ */ __name(((userOpts) => {
  const Search = /* @__PURE__ */ __name(({ displayClass, cfg }) => {
    const opts = { ...defaultOptions15, ...userOpts };
    const searchPlaceholder = i18n(cfg.locale).components.search.searchBarPlaceholder;
    return /* @__PURE__ */ jsxs19("div", { class: classNames(displayClass, "search", opts.variant === "inline" ? "search-inline" : ""), children: [
      /* @__PURE__ */ jsxs19("button", { class: "search-button", children: [
        /* @__PURE__ */ jsxs19("svg", { role: "img", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 19.9 19.7", children: [
          /* @__PURE__ */ jsx28("title", { children: "Search" }),
          /* @__PURE__ */ jsxs19("g", { class: "search-path", fill: "none", children: [
            /* @__PURE__ */ jsx28("path", { "stroke-linecap": "square", d: "M18.5 18.3l-5.4-5.4" }),
            /* @__PURE__ */ jsx28("circle", { cx: "8", cy: "8", r: "7" })
          ] })
        ] }),
        /* @__PURE__ */ jsx28("p", { children: i18n(cfg.locale).components.search.title })
      ] }),
      /* @__PURE__ */ jsx28("div", { class: "search-container", children: /* @__PURE__ */ jsxs19("div", { class: "search-space", children: [
        /* @__PURE__ */ jsx28(
          "input",
          {
            autocomplete: "off",
            class: "search-bar",
            name: "search",
            type: "text",
            "aria-label": searchPlaceholder,
            placeholder: searchPlaceholder
          }
        ),
        /* @__PURE__ */ jsx28("div", { class: "search-layout", "data-preview": opts.enablePreview })
      ] }) })
    ] });
  }, "Search");
  Search.afterDOMLoaded = search_inline_default;
  Search.css = search_default;
  return Search;
}), "default");

// quartz/components/Footer.tsx
var Footer_default = /* @__PURE__ */ __name((() => {
  const Footer = /* @__PURE__ */ __name(() => null, "Footer");
  return Footer;
}), "default");

// quartz/components/DesktopOnly.tsx
import { jsx as jsx29 } from "preact/jsx-runtime";
var DesktopOnly_default = /* @__PURE__ */ __name(((component) => {
  const Component = component;
  const DesktopOnly = /* @__PURE__ */ __name((props) => {
    return /* @__PURE__ */ jsx29(Component, { displayClass: "desktop-only", ...props });
  }, "DesktopOnly");
  DesktopOnly.displayName = component.displayName;
  DesktopOnly.afterDOMLoaded = component?.afterDOMLoaded;
  DesktopOnly.beforeDOMLoaded = component?.beforeDOMLoaded;
  DesktopOnly.css = component?.css;
  return DesktopOnly;
}), "default");

// quartz/components/MobileOnly.tsx
import { jsx as jsx30 } from "preact/jsx-runtime";
var MobileOnly_default = /* @__PURE__ */ __name(((component) => {
  const Component = component;
  const MobileOnly = /* @__PURE__ */ __name((props) => {
    return /* @__PURE__ */ jsx30(Component, { displayClass: "mobile-only", ...props });
  }, "MobileOnly");
  MobileOnly.displayName = component.displayName;
  MobileOnly.afterDOMLoaded = component?.afterDOMLoaded;
  MobileOnly.beforeDOMLoaded = component?.beforeDOMLoaded;
  MobileOnly.css = component?.css;
  return MobileOnly;
}), "default");

// quartz/components/styles/breadcrumbs.scss
var breadcrumbs_default = "";

// quartz/components/Breadcrumbs.tsx
import { jsx as jsx31, jsxs as jsxs20 } from "preact/jsx-runtime";
var defaultOptions16 = {
  spacerSymbol: "\u276F",
  rootName: "Home",
  resolveFrontmatterTitle: true,
  showCurrentPage: true
};
function formatCrumb(displayName, baseSlug, currentSlug) {
  return {
    displayName: displayName.replaceAll("-", " "),
    path: resolveRelative(baseSlug, currentSlug)
  };
}
__name(formatCrumb, "formatCrumb");
var Breadcrumbs_default = /* @__PURE__ */ __name(((opts) => {
  const options2 = { ...defaultOptions16, ...opts };
  const Breadcrumbs = /* @__PURE__ */ __name(({
    fileData,
    allFiles,
    displayClass,
    ctx
  }) => {
    const trie = ctx.trie ??= trieFromAllFiles(allFiles);
    const slugParts = fileData.slug.split("/");
    const pathNodes = trie.ancestryChain(slugParts);
    if (!pathNodes) {
      return null;
    }
    const crumbs = pathNodes.map((node, idx) => {
      const crumb = formatCrumb(node.displayName, fileData.slug, simplifySlug(node.slug));
      if (idx === 0) {
        crumb.displayName = options2.rootName;
      }
      if (idx === pathNodes.length - 1) {
        crumb.path = "";
      }
      return crumb;
    });
    if (!options2.showCurrentPage) {
      crumbs.pop();
    }
    return /* @__PURE__ */ jsx31("nav", { class: classNames(displayClass, "breadcrumb-container"), "aria-label": "breadcrumbs", children: crumbs.map((crumb, index) => /* @__PURE__ */ jsxs20("div", { class: "breadcrumb-element", children: [
      /* @__PURE__ */ jsx31("a", { href: crumb.path, children: crumb.displayName }),
      index !== crumbs.length - 1 && /* @__PURE__ */ jsx31("p", { children: ` ${options2.spacerSymbol} ` })
    ] })) });
  }, "Breadcrumbs");
  Breadcrumbs.css = breadcrumbs_default;
  return Breadcrumbs;
}), "default");

// quartz/components/scripts/comments.inline.ts
var comments_inline_default = "";

// quartz/components/Comments.tsx
import { Fragment as Fragment8, jsx as jsx32, jsxs as jsxs21 } from "preact/jsx-runtime";
function boolToStringBool(b) {
  return b ? "1" : "0";
}
__name(boolToStringBool, "boolToStringBool");
var Comments_default = /* @__PURE__ */ __name(((opts) => {
  const Comments = /* @__PURE__ */ __name((props) => {
    const { displayClass, fileData, cfg } = props;
    const disableComment = typeof fileData.frontmatter?.comments !== "undefined" && (!fileData.frontmatter?.comments || fileData.frontmatter?.comments === "false");
    if (disableComment) {
      return /* @__PURE__ */ jsx32(Fragment8, {});
    }
    const MobileAppend = opts.mobileAppend;
    const DesktopCompanion = opts.desktopCompanion;
    const renderMobileAppend = /* @__PURE__ */ __name(() => MobileAppend ? /* @__PURE__ */ jsx32("div", { class: "community-hub__mobile-append", children: /* @__PURE__ */ jsx32(MobileAppend, { ...props, displayClass: "mobile-only" }) }) : null, "renderMobileAppend");
    const companionNode = DesktopCompanion ? /* @__PURE__ */ jsx32("div", { class: "community-hub__companion", children: /* @__PURE__ */ jsx32("div", { class: "community-companion", children: /* @__PURE__ */ jsx32(DesktopCompanion, { ...props }) }) }) : null;
    const communityShell = /* @__PURE__ */ __name((content) => /* @__PURE__ */ jsxs21("section", { class: classNames(displayClass, "community-hub"), children: [
      /* @__PURE__ */ jsx32("hr", { class: "community-hub__divider", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs21("div", { class: "community-hub__columns", children: [
        /* @__PURE__ */ jsx32("div", { class: "community-hub__comments", children: content }),
        companionNode
      ] })
    ] }), "communityShell");
    if (opts.provider === "giscus") {
      const options3 = opts.options;
      return communityShell(
        /* @__PURE__ */ jsxs21("div", { class: "comments-wrapper", "data-provider": "giscus", children: [
          /* @__PURE__ */ jsx32(
            "div",
            {
              class: "comments giscus",
              "data-provider": "giscus",
              "data-repo": options3.repo,
              "data-repo-id": options3.repoId,
              "data-category": options3.category,
              "data-category-id": options3.categoryId,
              "data-mapping": options3.mapping ?? "url",
              "data-strict": boolToStringBool(options3.strict ?? true),
              "data-reactions-enabled": boolToStringBool(options3.reactionsEnabled ?? true),
              "data-input-position": options3.inputPosition ?? "bottom",
              "data-light-theme": options3.lightTheme ?? "light",
              "data-dark-theme": options3.darkTheme ?? "dark",
              "data-theme-url": options3.themeUrl ?? `https://${cfg.baseUrl ?? "example.com"}/static/giscus`,
              "data-lang": options3.lang ?? "en"
            }
          ),
          renderMobileAppend()
        ] })
      );
    }
    const options2 = opts.options;
    const resolveUtterancesIssueTerm = /* @__PURE__ */ __name(() => {
      if (typeof options2.issueTerm === "string") {
        const trimmed = options2.issueTerm.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
      const slugValue = typeof fileData.slug === "string" ? fileData.slug.trim() : "";
      if (slugValue.length > 0) {
        return `slug:${slugValue}`;
      }
      const pathValue = typeof fileData.filePath === "string" ? fileData.filePath.trim() : "";
      if (pathValue.length > 0) {
        return `path:${pathValue}`;
      }
      const titleValue = typeof fileData.frontmatter?.title === "string" ? fileData.frontmatter.title.trim() : "";
      if (titleValue.length > 0) {
        return `title:${titleValue}`;
      }
      return "slug:index";
    }, "resolveUtterancesIssueTerm");
    const utterancesIssueTerm = resolveUtterancesIssueTerm();
    return communityShell(
      /* @__PURE__ */ jsxs21("div", { class: "comments-wrapper", "data-provider": "utterances", children: [
        /* @__PURE__ */ jsx32(
          "div",
          {
            class: "comments utterances",
            "data-provider": "utterances",
            "data-repo": options2.repo,
            "data-issue-term": utterancesIssueTerm,
            "data-label": options2.label ?? "",
            "data-theme": options2.theme ?? "github-dark"
          }
        ),
        renderMobileAppend()
      ] })
    );
  }, "Comments");
  Comments.afterDOMLoaded = comments_inline_default;
  return Comments;
}), "default");

// quartz/components/ConditionalRender.tsx
import { jsx as jsx33 } from "preact/jsx-runtime";
var ConditionalRender_default = /* @__PURE__ */ __name(((config3) => {
  const ConditionalRender = /* @__PURE__ */ __name((props) => {
    if (config3.condition(props)) {
      return /* @__PURE__ */ jsx33(config3.component, { ...props });
    }
    return null;
  }, "ConditionalRender");
  ConditionalRender.afterDOMLoaded = config3.component.afterDOMLoaded;
  ConditionalRender.beforeDOMLoaded = config3.component.beforeDOMLoaded;
  ConditionalRender.css = config3.component.css;
  return ConditionalRender;
}), "default");

// quartz/components/styles/linksHeader.scss
var linksHeader_default = "";

// quartz/components/LinksHeader.tsx
import { jsx as jsx34, jsxs as jsxs22 } from "preact/jsx-runtime";
var navLinks = [
  {
    href: "/",
    label: "Home",
    iconSlug: "home"
  },
  {
    href: "/Characters/",
    label: "Characters",
    iconSlug: "characters"
  },
  {
    href: "/Concepts/",
    label: "Concepts",
    iconSlug: "concepts"
  },
  {
    href: "/Discord/",
    label: "Discord",
    iconSlug: "discord"
  },
  {
    href: "/YouTube/",
    label: "YouTube",
    iconSlug: "youtube"
  },
  {
    href: "/Explorables/",
    label: "Explorables",
    iconSlug: "explorables"
  },
  {
    href: "/Contribute/",
    label: "Contribute",
    iconSlug: "contribute",
    alignRight: true
  }
];
var LinksHeader_default = /* @__PURE__ */ __name((() => {
  const LinksHeader = /* @__PURE__ */ __name(() => {
    return /* @__PURE__ */ jsx34("div", { id: "links-header-container", children: /* @__PURE__ */ jsx34("nav", { id: "links-header", children: navLinks.map(({ href, label, iconSlug, alignRight }) => {
      const classes = ["links-header-item", `links-header-item--${iconSlug}`];
      if (alignRight) {
        classes.push("links-header-item--right");
      }
      return /* @__PURE__ */ jsxs22("a", { class: classes.join(" "), href, children: [
        iconSlug === "contribute" ? /* @__PURE__ */ jsx34("span", { class: "links-header-icon links-header-icon--image", "aria-hidden": "true", children: /* @__PURE__ */ jsx34("img", { src: "/static/icons/plus-icon.svg", alt: "" }) }) : /* @__PURE__ */ jsx34("span", { class: `links-header-icon links-header-icon--${iconSlug}`, "aria-hidden": "true" }),
        /* @__PURE__ */ jsx34("span", { children: label })
      ] }, href);
    }) }) });
  }, "LinksHeader");
  LinksHeader.css = linksHeader_default;
  return LinksHeader;
}), "default");

// quartz/components/scripts/discordWidget.inline.ts
var discordWidget_inline_default = "";

// quartz/components/DiscordWidget.tsx
import { jsx as jsx35, jsxs as jsxs23 } from "preact/jsx-runtime";
var WIDGET_SRC = "https://discord.com/widget?id=1389902002737250314&theme=dark";
var FILTER_ID = "discord-widget-redify";
var TOP_BAND_HOLD_STOP = 0.098;
var TOP_BAND_TRANSITION_STOP = 0.271;
var DEFAULT_WIDGET_HEIGHT = 500;
var TOP_BAND_TARGET_PX = TOP_BAND_TRANSITION_STOP * DEFAULT_WIDGET_HEIGHT;
var widgetInstanceCounter = 0;
var buildTopBandGradientData = /* @__PURE__ */ __name((holdStop, transitionStop) => {
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='1' height='1'>
  <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0' stop-color='white' stop-opacity='1'/>
    <stop offset='${holdStop}' stop-color='white' stop-opacity='1'/>
    <stop offset='${transitionStop}' stop-color='black' stop-opacity='0'/>
    <stop offset='1' stop-color='black' stop-opacity='0'/>
  </linearGradient>
  <rect width='1' height='1' fill='url(#g)'/>
</svg>`.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}, "buildTopBandGradientData");
var buildFilterId = /* @__PURE__ */ __name(() => `${FILTER_ID}-${++widgetInstanceCounter}`, "buildFilterId");
var FilterDefinition = /* @__PURE__ */ __name(({
  filterId,
  gradientData
}) => /* @__PURE__ */ jsx35("svg", { class: "discord-widget__filters", "aria-hidden": "true", focusable: "false", width: "0", height: "0", children: /* @__PURE__ */ jsxs23(
  "filter",
  {
    id: filterId,
    "color-interpolation-filters": "sRGB",
    filterUnits: "objectBoundingBox",
    primitiveUnits: "objectBoundingBox",
    x: "0",
    y: "0",
    width: "1",
    height: "1",
    children: [
      /* @__PURE__ */ jsx35(
        "feColorMatrix",
        {
          in: "SourceGraphic",
          type: "matrix",
          values: "0.6813 -0.3187 0.6373 0 0  0.2743 1.2743 -0.5486 0 0  0.8047 0.8047 -0.6094 0 0  0 0 0 1 0",
          result: "tinted"
        }
      ),
      /* @__PURE__ */ jsx35(
        "feImage",
        {
          x: "0",
          y: "0",
          width: "1",
          height: "1",
          preserveAspectRatio: "none",
          href: gradientData,
          xlinkHref: gradientData,
          result: "topGradient"
        }
      ),
      /* @__PURE__ */ jsx35(
        "feColorMatrix",
        {
          in: "topGradient",
          type: "matrix",
          values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0",
          result: "topMask"
        }
      ),
      /* @__PURE__ */ jsx35("feComposite", { in: "tinted", in2: "topMask", operator: "in", result: "tintedTop" }),
      /* @__PURE__ */ jsx35("feComposite", { in: "SourceGraphic", in2: "topMask", operator: "out", result: "originalBottom" }),
      /* @__PURE__ */ jsxs23("feMerge", { children: [
        /* @__PURE__ */ jsx35("feMergeNode", { in: "tintedTop" }),
        /* @__PURE__ */ jsx35("feMergeNode", { in: "originalBottom" })
      ] })
    ]
  }
) }), "FilterDefinition");
var DiscordWidget_default = /* @__PURE__ */ __name(((options2) => {
  const variant = options2?.variant ?? "sidebar";
  const DiscordWidget = /* @__PURE__ */ __name(({ displayClass }) => {
    const filterId = buildFilterId();
    const initialGradient = buildTopBandGradientData(TOP_BAND_HOLD_STOP, TOP_BAND_TRANSITION_STOP);
    return /* @__PURE__ */ jsxs23(
      "div",
      {
        class: classNames(displayClass, "discord-widget", `discord-widget--${variant}`),
        "data-filter-id": filterId,
        "data-top-band-hold-stop": String(TOP_BAND_HOLD_STOP),
        "data-top-band-transition-stop": String(TOP_BAND_TRANSITION_STOP),
        "data-top-band-target-px": String(TOP_BAND_TARGET_PX),
        children: [
          /* @__PURE__ */ jsx35(FilterDefinition, { filterId, gradientData: initialGradient }),
          /* @__PURE__ */ jsx35(
            "iframe",
            {
              class: "discord-widget__iframe",
              src: WIDGET_SRC,
              title: "710 Discord",
              loading: "lazy",
              allowTransparency: true,
              frameBorder: "0",
              sandbox: "allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts",
              style: { filter: `url(#${filterId})` }
            }
          )
        ]
      }
    );
  }, "DiscordWidget");
  DiscordWidget.css = `
.discord-widget {
  width: 100%;
  display: flex;
  justify-content: center;
}
.discord-widget__filters {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.discord-widget__iframe {
  width: min(100%, var(--discord-widget-max-width, 350px));
  height: var(--discord-widget-height, 500px);
  border: none;
  border-radius: 12px;
  background-color: var(--color-panel-depth);
}

.discord-widget--banner {
  max-width: none;
  margin-top: 2rem;
}

.discord-widget--banner .discord-widget__iframe {
  --discord-widget-max-width: 100%;
  --discord-widget-height: 420px;
}

.discord-widget--sidebar {
  width: min(100%, var(--discord-widget-max-width, 350px));
  display: inline-flex;
}

.discord-widget--sidebar .discord-widget__iframe {
  width: 100%;
}

@media (max-width: 480px) {
  .discord-widget__iframe {
    --discord-widget-height: 420px;
  }

  .discord-widget--banner .discord-widget__iframe {
    --discord-widget-height: 360px;
  }
}
`;
  DiscordWidget.afterDOMLoaded = discordWidget_inline_default;
  return DiscordWidget;
}), "default");

// quartz/components/InfoBox.tsx
import { Fragment as Fragment9 } from "preact";
import { jsx as jsx36, jsxs as jsxs24 } from "preact/jsx-runtime";
var isExternalUrl6 = /* @__PURE__ */ __name((url) => /^(https?:)?\/\//i.test(url), "isExternalUrl");
var OBSIDIAN_EMBED_PATTERN6 = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/;
var OBSIDIAN_WIKILINK_PATTERN = /\[\[([^|\]#]+)?(#[^|\]]+)?(?:\|([^\]]+))?\]\]/g;
var stripContentPrefix6 = /* @__PURE__ */ __name((target) => target.replace(/^[./]+/, "").replace(/^content\//i, ""), "stripContentPrefix");
var normalizeString = /* @__PURE__ */ __name((value) => {
  if (value === null || value === void 0) {
    return void 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : void 0;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return void 0;
}, "normalizeString");
var intersperse = /* @__PURE__ */ __name((values, separator) => values.flatMap((node, index) => index === 0 ? [node] : [separator, node]), "intersperse");
var findSlugMatch = /* @__PURE__ */ __name((target, ctx) => {
  const sanitized = stripContentPrefix6(target);
  const withExt = sanitized.endsWith(".md") ? sanitized : `${sanitized}.md`;
  try {
    const candidateRaw = slugifyFilePath(withExt, true);
    const candidate = candidateRaw.replace(/\.+$/, "");
    if (ctx.allSlugs.includes(candidate)) {
      return candidate;
    }
    const lowerCandidate = candidate.toLowerCase();
    return ctx.allSlugs.find((slug) => {
      const lowerSlug = slug.toLowerCase();
      return lowerSlug === lowerCandidate || lowerSlug.endsWith(`/${lowerCandidate}`);
    });
  } catch {
    return void 0;
  }
}, "findSlugMatch");
var getTitleForSlug = /* @__PURE__ */ __name((slug, ctx) => {
  const pathSegments = slug.split("/");
  const node = ctx.trie?.findNode(pathSegments);
  return node?.data?.title ?? node?.displayName ?? pathSegments.at(-1);
}, "getTitleForSlug");
var renderTextWithWikilinks = /* @__PURE__ */ __name((raw, slug, ctx) => {
  const nodes = [];
  let lastIndex = 0;
  raw.replace(OBSIDIAN_WIKILINK_PATTERN, (match, target = "", anchor = "", alias) => {
    const index = raw.indexOf(match, lastIndex);
    if (index > lastIndex) {
      nodes.push(raw.slice(lastIndex, index));
    }
    const trimmedTarget = target.trim();
    const trimmedAlias = alias?.trim();
    const slugMatch = trimmedTarget ? findSlugMatch(trimmedTarget, ctx) : void 0;
    const anchorValue = anchor?.trim() ?? "";
    if (slugMatch) {
      const href = transformLink(slug, `${slugMatch}${anchorValue}`, {
        strategy: "shortest",
        allSlugs: ctx.allSlugs
      });
      const label = trimmedAlias ?? getTitleForSlug(slugMatch, ctx) ?? trimmedTarget;
      nodes.push(
        /* @__PURE__ */ jsx36("a", { href, class: "internal", children: label })
      );
    } else {
      const fallback = trimmedAlias ?? (trimmedTarget.length > 0 ? trimmedTarget : match);
      nodes.push(fallback);
    }
    lastIndex = index + match.length;
    return match;
  });
  if (lastIndex < raw.length) {
    nodes.push(raw.slice(lastIndex));
  }
  if (nodes.length === 0) {
    return "";
  }
  if (nodes.length === 1) {
    return nodes[0];
  }
  return nodes;
}, "renderTextWithWikilinks");
var normalizeValue = /* @__PURE__ */ __name((value, slug, ctx) => {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => normalizeValue(entry, slug, ctx)).filter((entry) => Boolean(entry));
    if (normalized.length === 0) {
      return void 0;
    }
    const combinedKey = normalized.map((entry) => entry.key).join("|");
    const children = intersperse(normalized.map((entry) => entry.node), ", ");
    return { node: /* @__PURE__ */ jsx36(Fragment9, { children }), key: combinedKey };
  }
  const text = normalizeString(value);
  if (!text) {
    return void 0;
  }
  return { node: renderTextWithWikilinks(text, slug, ctx), key: text };
}, "normalizeValue");
var appendAssetVersion5 = /* @__PURE__ */ __name((url, version) => {
  if (!version) {
    return url;
  }
  return url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
}, "appendAssetVersion");
var resolveObsidianTarget4 = /* @__PURE__ */ __name((rawTarget, slug) => {
  const version = getAssetVersion();
  if (isExternalUrl6(rawTarget)) {
    return rawTarget;
  }
  const targetWithoutExt = stripContentPrefix6(rawTarget);
  const targetSlug = slugifyFilePath(targetWithoutExt);
  const baseDir = pathToRoot(slug);
  return appendAssetVersion5(joinSegments(baseDir, targetSlug), version);
}, "resolveObsidianTarget");
var resolveImageSource = /* @__PURE__ */ __name((raw, slug) => {
  const cleaned = raw.trim();
  if (!cleaned) {
    return void 0;
  }
  const obsidianMatch = cleaned.match(OBSIDIAN_EMBED_PATTERN6);
  if (obsidianMatch?.groups?.target) {
    return resolveObsidianTarget4(obsidianMatch.groups.target, slug);
  }
  if (isExternalUrl6(cleaned)) {
    return cleaned;
  }
  const version = getAssetVersion();
  const target = stripContentPrefix6(cleaned);
  return appendAssetVersion5(joinSegments(pathToRoot(slug), target), version);
}, "resolveImageSource");
var parseItems = /* @__PURE__ */ __name((rawItems, slug, ctx) => {
  if (!Array.isArray(rawItems)) {
    return [];
  }
  const parsed = [];
  rawItems.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const label = normalizeString(item.label);
    if (!label) {
      return;
    }
    const normalized = normalizeValue(item.value, slug, ctx);
    if (!normalized) {
      return;
    }
    parsed.push({ label, value: normalized.node, key: `${label}-${index}-${normalized.key}` });
  });
  return parsed;
}, "parseItems");
var parseInfoBox = /* @__PURE__ */ __name((fileData, slug, ctx) => {
  const frontmatter = fileData.frontmatter ?? {};
  const rawCandidate = fileData.infobox ?? frontmatter?.infobox;
  const raw = rawCandidate;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const title = normalizeString(raw.title);
  const items = parseItems(raw.items, slug, ctx);
  const imageSrcRaw = normalizeString(raw.image?.src);
  const imageSrc = imageSrcRaw ? resolveImageSource(imageSrcRaw, slug) : void 0;
  const imageAlt = normalizeString(raw.image?.alt);
  const imageCaption = normalizeString(raw.image?.caption);
  const imageCaptionNode = imageCaption ? renderTextWithWikilinks(imageCaption, slug, ctx) : void 0;
  if (!title && !imageSrc && items.length === 0) {
    return null;
  }
  const image = imageSrc ? {
    src: imageSrc,
    alt: imageAlt,
    caption: imageCaptionNode
  } : void 0;
  return {
    title,
    image,
    items
  };
}, "parseInfoBox");
var InfoBox_default = /* @__PURE__ */ __name((() => {
  const InfoBox = /* @__PURE__ */ __name(({ fileData, displayClass, ctx }) => {
    if (!fileData?.slug) {
      return null;
    }
    const infobox = parseInfoBox(fileData, fileData.slug, ctx);
    if (!infobox) {
      return null;
    }
    return /* @__PURE__ */ jsxs24("aside", { class: classNames(displayClass, "infobox"), role: "complementary", "aria-label": "Infobox", children: [
      infobox.title ? /* @__PURE__ */ jsx36("h3", { class: "infobox__title", children: infobox.title }) : null,
      infobox.image ? /* @__PURE__ */ jsxs24("figure", { class: "infobox__media", children: [
        /* @__PURE__ */ jsx36(
          "img",
          {
            src: infobox.image.src,
            alt: infobox.image.alt ?? infobox.title ?? "Infobox image",
            loading: "lazy",
            decoding: "async"
          }
        ),
        infobox.image.caption ? /* @__PURE__ */ jsx36("figcaption", { children: infobox.image.caption }) : null
      ] }) : null,
      infobox.items.length > 0 ? /* @__PURE__ */ jsx36("dl", { class: "infobox__facts", children: infobox.items.map(({ label, value, key }) => /* @__PURE__ */ jsxs24("div", { class: "infobox__fact", children: [
        /* @__PURE__ */ jsx36("dt", { children: label }),
        /* @__PURE__ */ jsx36("dd", { children: value })
      ] }, key)) }) : null
    ] });
  }, "InfoBox");
  InfoBox.css = `
.infobox {
  float: right;
  margin: 0 0 1.5rem 1.5rem;
  width: clamp(220px, 28vw, 320px);
  background: var(--lightgray);
  border: 1px solid var(--color-tone-subtle);
  border-radius: 14px;
  padding: 1.25rem 1.25rem 1.5rem;
  box-shadow: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.12);
  position: sticky;
  top: clamp(1.5rem, 6vh, 4rem);
  z-index: 2;
  color: var(--color-tone-primary);
}

.infobox__title {
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 1rem 0;
  text-align: center;
  color: var(--color-tone-contrast);
  font-family: var(--font-thematic);
}

.infobox__media {
  margin: 0 0 0.75rem 0;
  display: grid;
  gap: 0.3rem;
}

.infobox__media img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  box-shadow: 0 0.75rem 1.5rem rgba(0, 0, 0, 0.18);
  background: var(--lightgray);
}


.infobox__media figcaption {
  font-size: 0.85rem;
  color: var(--color-tone-primary);
  text-align: center;
  margin: 0;
  line-height: 1.3;
}

.infobox__facts {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.infobox__fact {
  display: grid;
  gap: 0.35rem;
}

.infobox__fact dt {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-tone-contrast);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: var(--font-thematic);
}

.infobox__fact dd {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.35;
  color: var(--color-tone-primary);
}

@media (max-width: 1024px) {
  .infobox {
    position: relative;
    top: auto;
    float: none;
    margin: 1.5rem auto;
    width: min(100%, 420px);
  }
}
  `;
  return InfoBox;
}), "default");

// quartz/components/scripts/homepage.inline.ts
var homepage_inline_default = "";

// quartz/components/HomepageFeatures.tsx
import { jsx as jsx37, jsxs as jsxs25 } from "preact/jsx-runtime";
var DEFAULT_LINKS = {
  archive: {
    label: "Archival Channel",
    href: "https://www.youtube.com/@710ToneArchiveChannel",
    description: "Follow the archive channel and view lost 7/10 Tone media",
    iconSlug: "youtube"
  },
  discord: {
    label: "Join the Discord",
    href: "https://discord.gg/2ByK7Xcmy4",
    description: "Swap theories and work puzzles with fellow sleuths",
    iconSlug: "discord"
  },
  reddit: {
    label: "Visit r/710Tone",
    href: "https://www.reddit.com/r/710Tone/",
    description: "Browse community finds and share what you uncover",
    iconSlug: "reddit"
  }
};
var toLink = /* @__PURE__ */ __name((candidate, fallback) => {
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }
  const label = typeof candidate.label === "string" && candidate.label.trim().length > 0 ? candidate.label.trim() : fallback.label;
  const href = typeof candidate.href === "string" && candidate.href.trim().length > 0 ? candidate.href.trim() : fallback.href;
  const description = typeof candidate.description === "string" && candidate.description.trim().length > 0 ? candidate.description.trim() : fallback.description;
  const iconSlug = typeof candidate.iconSlug === "string" && candidate.iconSlug.trim().length > 0 ? candidate.iconSlug.trim() : fallback.iconSlug;
  return { label, href, description, iconSlug };
}, "toLink");
var HomepageFeatures_default = /* @__PURE__ */ __name((() => {
  const HomepageFeatures = /* @__PURE__ */ __name(({ displayClass, fileData }) => {
    const frontmatter = fileData.frontmatter ?? {};
    const linksRaw = frontmatter.homepageLinks;
    const homepageLinks = linksRaw && typeof linksRaw === "object" ? linksRaw : {};
    const archiveLink = toLink(homepageLinks.archive, DEFAULT_LINKS.archive);
    const discordLink = toLink(homepageLinks.discord, DEFAULT_LINKS.discord);
    const redditLink = toLink(homepageLinks.reddit, DEFAULT_LINKS.reddit);
    return /* @__PURE__ */ jsxs25("section", { class: classNames(displayClass, "home-features"), "data-home-root": true, children: [
      /* @__PURE__ */ jsxs25("section", { class: "home-recent", children: [
        /* @__PURE__ */ jsx37("h2", { class: "home-recent__title", children: "Recently updated" }),
        /* @__PURE__ */ jsx37("div", { class: "home-recent__scroller", children: /* @__PURE__ */ jsx37("ol", { class: "home-recent__list", "data-home-recent-list": true, children: /* @__PURE__ */ jsx37("li", { class: "home-recent__empty", children: "Loading recent updates\u2026" }) }) })
      ] }),
      /* @__PURE__ */ jsxs25("div", { class: "home-actions", children: [
        /* @__PURE__ */ jsxs25("div", { class: "home-card home-random", children: [
          /* @__PURE__ */ jsxs25("div", { class: "home-random__frame", children: [
            /* @__PURE__ */ jsx37(
              "button",
              {
                type: "button",
                class: "home-random__trigger",
                "data-home-random-trigger": true,
                "aria-label": "Roll a random article",
                children: /* @__PURE__ */ jsx37(
                  "span",
                  {
                    class: "home-random__dice",
                    "aria-hidden": "true",
                    "data-home-random-dice": true,
                    "data-face": "5",
                    children: /* @__PURE__ */ jsxs25("span", { class: "home-random__dice-face", children: [
                      /* @__PURE__ */ jsx37("span", { class: "home-random__pip home-random__pip--top-left" }),
                      /* @__PURE__ */ jsx37("span", { class: "home-random__pip home-random__pip--top-right" }),
                      /* @__PURE__ */ jsx37("span", { class: "home-random__pip home-random__pip--mid-left" }),
                      /* @__PURE__ */ jsx37("span", { class: "home-random__pip home-random__pip--center" }),
                      /* @__PURE__ */ jsx37("span", { class: "home-random__pip home-random__pip--mid-right" }),
                      /* @__PURE__ */ jsx37("span", { class: "home-random__pip home-random__pip--bottom-left" }),
                      /* @__PURE__ */ jsx37("span", { class: "home-random__pip home-random__pip--bottom-right" })
                    ] })
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx37("div", { class: "home-random__panel", "data-home-random-panel": true, children: /* @__PURE__ */ jsx37("div", { class: "home-random__card", "data-home-random-card": true, children: /* @__PURE__ */ jsxs25(
              "div",
              {
                class: "home-random-card home-random-card--placeholder",
                "data-home-random-placeholder": true,
                "aria-hidden": "true",
                children: [
                  /* @__PURE__ */ jsx37("h3", { class: "home-random-card__title", "data-home-random-placeholder-title": true, children: "Try a random article!" }),
                  /* @__PURE__ */ jsx37("p", { class: "home-random-card__placeholder-copy", "data-home-random-placeholder-copy": true, children: "Tap the die to roll the archive." })
                ]
              }
            ) }) })
          ] }),
          /* @__PURE__ */ jsx37("p", { class: "home-random__empty", "data-home-random-empty": true, hidden: true, children: "No eligible pages yet." })
        ] }),
        /* @__PURE__ */ jsxs25("div", { class: "home-card home-links", children: [
          /* @__PURE__ */ jsx37("h3", { class: "home-card__title", children: "Stay connected" }),
          /* @__PURE__ */ jsxs25("div", { class: "home-links__stack", children: [
            /* @__PURE__ */ jsxs25(
              "a",
              {
                class: "home-link-card",
                href: archiveLink.href,
                target: "_blank",
                rel: "noopener noreferrer",
                children: [
                  /* @__PURE__ */ jsx37(
                    "span",
                    {
                      class: `home-link-card__icon home-link-card__icon--${archiveLink.iconSlug}`,
                      "aria-hidden": "true"
                    }
                  ),
                  /* @__PURE__ */ jsxs25("span", { class: "home-link-card__copy", children: [
                    /* @__PURE__ */ jsx37("span", { class: "home-link-card__label", children: archiveLink.label }),
                    /* @__PURE__ */ jsx37("span", { class: "home-link-card__description", children: archiveLink.description })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsxs25(
              "a",
              {
                class: "home-link-card",
                href: discordLink.href,
                target: "_blank",
                rel: "noopener noreferrer",
                children: [
                  /* @__PURE__ */ jsx37(
                    "span",
                    {
                      class: `home-link-card__icon home-link-card__icon--${discordLink.iconSlug}`,
                      "aria-hidden": "true"
                    }
                  ),
                  /* @__PURE__ */ jsxs25("span", { class: "home-link-card__copy", children: [
                    /* @__PURE__ */ jsx37("span", { class: "home-link-card__label", children: discordLink.label }),
                    /* @__PURE__ */ jsx37("span", { class: "home-link-card__description", children: discordLink.description })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsxs25(
              "a",
              {
                class: "home-link-card",
                href: redditLink.href,
                target: "_blank",
                rel: "noopener noreferrer",
                children: [
                  /* @__PURE__ */ jsx37(
                    "span",
                    {
                      class: `home-link-card__icon home-link-card__icon--${redditLink.iconSlug}`,
                      "aria-hidden": "true"
                    }
                  ),
                  /* @__PURE__ */ jsxs25("span", { class: "home-link-card__copy", children: [
                    /* @__PURE__ */ jsx37("span", { class: "home-link-card__label", children: redditLink.label }),
                    /* @__PURE__ */ jsx37("span", { class: "home-link-card__description", children: redditLink.description })
                  ] })
                ]
              }
            )
          ] })
        ] })
      ] })
    ] });
  }, "HomepageFeatures");
  HomepageFeatures.css = `
.home-features {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin: 2.5rem 0 1.5rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.home-recent {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.home-recent__title {
  margin: 0;
  font-size: clamp(1.1rem, 1.2vw + 0.6rem, 1.35rem);
}

.home-recent__scroller {
  --home-recent-gutter: 0.75rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 0 var(--home-recent-gutter);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scroll-behavior: smooth;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable both-edges;
}

body:not(.hide-scrollbars) .home-recent__scroller::-webkit-scrollbar {
  height: 6px;
}

body:not(.hide-scrollbars) .home-recent__scroller::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-tone-muted) 45%, transparent);
  border-radius: 999px;
}

.home-recent__list {
  list-style: none;
  margin: 0;
  padding: 0 0 0.2rem;
  display: flex;
  gap: 0.85rem;
  width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
  align-items: stretch;
}

.home-recent-card {
  flex: 0 0 clamp(240px, 22vw + 110px, 300px);
  display: flex;
  scroll-snap-align: start;
}

.home-recent-card__link {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  width: 100%;
  min-height: 100%;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-surface-overlay) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.18),
    0 1px 0 color-mix(in srgb, var(--color-accent-shadow-light) 28%, transparent);
  text-decoration: none;
  color: var(--color-tone-contrast);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.home-recent-card__link:hover,
.home-recent-card__link:focus-visible {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--color-accent-bright) 50%, transparent);
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.22),
    0 1px 0 color-mix(in srgb, var(--color-accent-bright) 32%, transparent);
  outline: none;
}

.home-recent-card__title {
  margin: 0;
  font-size: clamp(1rem, 0.7vw + 0.8rem, 1.15rem);
  font-weight: 650;
  color: var(--color-tone-contrast);
  letter-spacing: 0.01em;
}


.home-recent-card__meta {
  margin: 0;
  font-size: 0.86rem;
  color: color-mix(in srgb, var(--color-tone-muted) 68%, var(--color-tone-contrast) 32%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.home-recent-card__meta time {
  font-variant-numeric: tabular-nums;
}

.home-recent-card__meta-label {
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--color-tone-muted) 72%, var(--color-accent-shadow-light) 28%);
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.home-recent__empty {
  flex: 0 0 clamp(240px, 22vw + 110px, 300px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 1.2rem;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-tone-muted) 18%, transparent);
  border: 1px dashed color-mix(in srgb, var(--color-tone-muted) 40%, transparent);
  color: color-mix(in srgb, var(--color-tone-muted) 80%, var(--color-tone-contrast) 20%);
  font-size: 0.9rem;
  scroll-snap-align: start;
  text-align: center;
}

.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  min-width: 0;
}

.home-card {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem 1.25rem;
  border-radius: 14px;
  background: var(--lightgray);
  border: 1px solid var(--gray);
}

.home-card__title {
  margin: 0;
  font-size: clamp(1.05rem, 1vw + 0.6rem, 1.3rem);
}

.home-card__body {
  margin: 0;
  color: var(--darkgray);
  font-size: 0.92rem;
}

.home-random__empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--darkgray);
}

.home-random__frame {
  display: flex;
  align-items: center;
  gap: 1.1rem;
}

.home-random__trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  min-width: 96px;
  aspect-ratio: 1;
  border: none;
  border-radius: 26px;
  cursor: pointer;
  background: color-mix(in srgb, var(--color-accent-bright) 30%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-accent-shadow) 50%, transparent),
    0 12px 26px rgba(0, 0, 0, 0.24);
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.home-random__trigger:focus-visible,
.home-random__trigger:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-accent-bright) 55%, transparent),
    0 16px 34px rgba(0, 0, 0, 0.28);
  outline: none;
}

.home-random__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-accent-shadow) 45%, transparent),
    0 8px 18px rgba(0, 0, 0, 0.18);
}

.home-random__dice {
  --home-random-dice-size: 62px;
  position: relative;
  display: grid;
  place-items: center;
  width: var(--home-random-dice-size);
  height: var(--home-random-dice-size);
  flex: 0 0 auto;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  box-sizing: border-box;
  transition: transform 180ms ease;
}

.home-random__dice-face {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: var(--light);
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  align-items: center;
  justify-items: center;
  padding: 6px;
  gap: 4px;
  box-sizing: border-box;
}

.home-random__pip {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--dark);
  opacity: 0;
  transition: opacity 120ms ease;
}

.home-random__pip--top-left {
  grid-area: 1 / 1;
}

.home-random__pip--top-right {
  grid-area: 1 / 3;
}

.home-random__pip--mid-left {
  grid-area: 2 / 1;
}

.home-random__pip--center {
  grid-area: 2 / 2;
}

.home-random__pip--mid-right {
  grid-area: 2 / 3;
}

.home-random__pip--bottom-left {
  grid-area: 3 / 1;
}

.home-random__pip--bottom-right {
  grid-area: 3 / 3;
}

.home-random__dice[data-face="1"] .home-random__pip--center,
.home-random__dice[data-face="2"] .home-random__pip--top-left,
.home-random__dice[data-face="2"] .home-random__pip--bottom-right,
.home-random__dice[data-face="3"] .home-random__pip--top-left,
.home-random__dice[data-face="3"] .home-random__pip--center,
.home-random__dice[data-face="3"] .home-random__pip--bottom-right,
.home-random__dice[data-face="4"] .home-random__pip--top-left,
.home-random__dice[data-face="4"] .home-random__pip--top-right,
.home-random__dice[data-face="4"] .home-random__pip--bottom-left,
.home-random__dice[data-face="4"] .home-random__pip--bottom-right,
.home-random__dice[data-face="5"] .home-random__pip--top-left,
.home-random__dice[data-face="5"] .home-random__pip--top-right,
.home-random__dice[data-face="5"] .home-random__pip--center,
.home-random__dice[data-face="5"] .home-random__pip--bottom-left,
.home-random__dice[data-face="5"] .home-random__pip--bottom-right,
.home-random__dice[data-face="6"] .home-random__pip--top-left,
.home-random__dice[data-face="6"] .home-random__pip--top-right,
.home-random__dice[data-face="6"] .home-random__pip--mid-left,
.home-random__dice[data-face="6"] .home-random__pip--mid-right,
.home-random__dice[data-face="6"] .home-random__pip--bottom-left,
.home-random__dice[data-face="6"] .home-random__pip--bottom-right {
  opacity: 1;
}

.home-random__trigger.is-rolling .home-random__dice {
  animation: home-random-dice-wobble 520ms ease-in-out;
}

.home-random__panel {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.9rem;
  padding: 1.35rem 1.6rem;
  border-radius: 26px;
  background: color-mix(in srgb, var(--color-accent-bright) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 48%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 12px 28px rgba(0, 0, 0, 0.22);
  transition: background 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
  position: relative;
  overflow: hidden;
  min-height: clamp(190px, 21vw, 240px);
}

.home-random__panel--active {
  background: color-mix(in srgb, var(--color-surface-overlay) 94%, transparent);
  border-color: color-mix(in srgb, var(--color-accent-shadow) 40%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 12px 28px rgba(0, 0, 0, 0.2);
}

.home-random__prompt {
  margin: 0;
  font-size: clamp(1.05rem, 0.6vw + 0.85rem, 1.25rem);
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-contrast) 90%, var(--color-tone-muted) 10%);
  text-align: center;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-surface-overlay) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}


.home-random__card {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 62px;
  height: 62px;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  transition: transform 180ms ease;
  padding: 1.15rem 1.25rem;
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-surface-overlay) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 36%, transparent);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.02),
    0 10px 22px rgba(0, 0, 0, 0.18);
  text-decoration: none;
  color: var(--color-tone-contrast);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  width: 100%;
  min-height: clamp(190px, 21vw, 240px);
}

.home-random-card:hover,
.home-random-card:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-accent-bright) 45%, transparent);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.05),
    0 12px 26px rgba(0, 0, 0, 0.22);
  outline: none;
}

.home-random-card--placeholder {
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 0.85rem;
  pointer-events: none;
}

.home-random-card--placeholder .home-random-card__title {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.home-random-card__placeholder-copy {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.3;
  color: color-mix(in srgb, var(--color-tone-muted) 55%, var(--color-tone-contrast) 45%);
}

.home-random-card__title {
  margin: 0;
  font-size: clamp(1.05rem, 0.8vw + 0.95rem, 1.35rem);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.home-random-card__meta {
  margin: 0;
  font-size: 0.86rem;
  color: color-mix(in srgb, var(--color-tone-muted) 70%, var(--color-tone-contrast) 30%);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.home-random-card__meta time {
  font-variant-numeric: tabular-nums;
}

.home-random-card__meta-label {
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--color-tone-muted) 72%, var(--color-accent-shadow-light) 28%);
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.home-random-card__snippet {
  margin: 0;
  color: color-mix(in srgb, var(--color-tone-contrast) 85%, var(--color-tone-muted) 15%);
  font-size: 0.92rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-random-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-random-card__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.home-random-card__tag-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 40%, transparent);
  background: color-mix(in srgb, var(--color-accent-shadow-light) 18%, transparent);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 68%, var(--color-tone-contrast) 32%);
  text-decoration: none;
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
}

.home-random-card__tag-link:hover,
.home-random-card__tag-link:focus-visible {
  border-color: color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  background: color-mix(in srgb, var(--color-accent-bright) 18%, transparent);
  transform: translateY(-1px);
  outline: none;
}

.home-random-card--enter {
  opacity: 0;
  transform: translateY(12px);
}

.home-random-card--entered {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 220ms ease, transform 220ms ease;
}

.home-links__stack {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.home-link-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: var(--light);
  border: 1px solid var(--lightgray);
  text-decoration: none;
  transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
}

.home-link-card:hover,
.home-link-card:focus-visible {
  border-color: var(--secondary);
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.12);
}

.home-link-card__icon {
  width: 30px;
  height: 30px;
  display: inline-block;
  flex-shrink: 0;
  background-color: var(--color-accent-bright);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}

.home-link-card__icon--youtube {
  mask-image: url("/static/icons/youtube_icon.svg");
  -webkit-mask-image: url("/static/icons/youtube_icon.svg");
}

.home-link-card__icon--discord {
  mask-image: url("/static/icons/discord_icon.svg");
  -webkit-mask-image: url("/static/icons/discord_icon.svg");
}

.home-link-card__icon--reddit {
  mask-image: url("/static/icons/reddit-icon.svg");
  -webkit-mask-image: url("/static/icons/reddit-icon.svg");
}

.home-link-card__copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.home-link-card__label {
  font-weight: 600;
  color: var(--dark);
}

.home-link-card__description {
  color: var(--darkgray);
  font-size: 0.85rem;
  line-height: 1.2;
}

@media (max-width: 640px) {
  .home-recent__scroller {
    --home-recent-gutter: 0.5rem;
  }

  .home-card {
    padding: 1rem 1.1rem;
  }

  .home-random__frame {
    flex-direction: column;
    align-items: center;
  }

  .home-random__trigger {
    width: 82px;
    min-width: 82px;
  }

  .home-random__panel {
    width: 100%;
  }

  .home-random-card {
    min-height: 0;
  }
}

@keyframes home-random-dice-wobble {
  0% {
    transform: rotate(0deg) scale(1);
  }
  30% {
    transform: rotate(-18deg) scale(1.04);
  }
  60% {
    transform: rotate(14deg) scale(0.98);
  }
  100% {
    transform: rotate(0deg) scale(1);
  }
}
`;
  HomepageFeatures.afterDOMLoaded = homepage_inline_default;
  return HomepageFeatures;
}), "default");

// quartz/components/scripts/mediaNormalizer.inline.ts
var mediaNormalizer_inline_default = "";

// quartz/components/MediaNormalizer.tsx
import { Fragment as Fragment10, jsx as jsx38 } from "preact/jsx-runtime";
var MediaNormalizer = /* @__PURE__ */ __name(() => /* @__PURE__ */ jsx38(Fragment10, {}), "MediaNormalizer");
MediaNormalizer.afterDOMLoaded = mediaNormalizer_inline_default;
var MediaNormalizer_default = /* @__PURE__ */ __name((() => MediaNormalizer), "default");

// quartz/components/scripts/oracleChat.inline.ts
var oracleChat_inline_default = "";

// quartz/components/OracleWidget.tsx
import { jsx as jsx39, jsxs as jsxs26 } from "preact/jsx-runtime";
var OracleWidgetComponent = /* @__PURE__ */ __name(({ cfg, fileData }) => {
  const oracleConfig = cfg.oracleChat;
  if (!oracleConfig || oracleConfig.enabled === false) {
    return null;
  }
  const articleTitle = fileData.frontmatter?.title ?? fileData.slug ?? "";
  const articleSlug = fileData.slug ?? "";
  const {
    apiBaseUrl = "",
    endpointPath = "/api/oracle/query",
    recaptchaSiteKey,
    storageKey = "oracle-chat-history",
    maxHistory = 24
  } = oracleConfig;
  const launcherLabelId = "oracle-widget-launcher-label";
  return /* @__PURE__ */ jsxs26(
    "div",
    {
      class: "oracle-widget",
      "data-oracle-api-base": apiBaseUrl || void 0,
      "data-oracle-endpoint": endpointPath || void 0,
      "data-oracle-storage-key": storageKey,
      "data-oracle-max-history": String(maxHistory),
      "data-oracle-recaptcha-key": recaptchaSiteKey || void 0,
      "data-oracle-article-title": articleTitle || void 0,
      "data-oracle-article-slug": articleSlug || void 0,
      children: [
        /* @__PURE__ */ jsxs26(
          "button",
          {
            type: "button",
            class: "oracle-widget__launcher",
            "aria-haspopup": "dialog",
            "aria-controls": "oracle-chat-panel",
            "aria-expanded": "false",
            "aria-labelledby": launcherLabelId,
            children: [
              /* @__PURE__ */ jsx39("span", { class: "oracle-widget__copy", id: launcherLabelId, children: /* @__PURE__ */ jsx39("span", { class: "oracle-widget__title", children: "Ask ORA_CLE" }) }),
              /* @__PURE__ */ jsx39("span", { class: "oracle-widget__avatar-wrap", "aria-hidden": "true", children: /* @__PURE__ */ jsx39("span", { class: "oracle-widget__avatar", role: "presentation" }) })
            ]
          }
        ),
        /* @__PURE__ */ jsx39("div", { class: "oracle-chat", id: "oracle-chat-panel", role: "dialog", "aria-modal": "true", "aria-hidden": "true", children: /* @__PURE__ */ jsxs26("div", { class: "oracle-chat__surface", role: "document", children: [
          /* @__PURE__ */ jsx39(
            "button",
            {
              type: "button",
              class: "oracle-chat__dismiss-tab",
              "data-oracle-action": "dismiss-tab",
              "aria-label": "Collapse chat panel",
              children: /* @__PURE__ */ jsx39("svg", { class: "oracle-chat__dismiss-icon", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ jsx39("path", { d: "M14.5 5.5a1 1 0 0 0-1.4 0l-6 6a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4-1.4L10.41 12l4.09-4.1a1 1 0 0 0 0-1.9z" }) })
            }
          ),
          /* @__PURE__ */ jsxs26("header", { class: "oracle-chat__header", children: [
            /* @__PURE__ */ jsxs26("div", { class: "oracle-chat__identity", children: [
              /* @__PURE__ */ jsx39("span", { class: "oracle-chat__avatar", role: "presentation", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxs26("div", { class: "oracle-chat__identity-text", children: [
                /* @__PURE__ */ jsx39("span", { class: "oracle-chat__name", children: "The ORA_CLE" }),
                /* @__PURE__ */ jsx39("span", { class: "oracle-chat__status", "data-oracle-status-text": true, "data-state": "online", children: "Bot status: Online" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs26("div", { class: "oracle-chat__header-actions", children: [
              /* @__PURE__ */ jsx39(
                "button",
                {
                  type: "button",
                  class: "oracle-chat__reset",
                  "data-oracle-action": "reset",
                  "aria-label": "Reset conversation",
                  children: /* @__PURE__ */ jsx39("span", { class: "oracle-chat__reset-icon", "aria-hidden": "true" })
                }
              ),
              /* @__PURE__ */ jsx39(
                "button",
                {
                  type: "button",
                  class: "oracle-chat__close",
                  "aria-label": "Close chat",
                  "data-oracle-action": "close",
                  children: /* @__PURE__ */ jsx39("span", { "aria-hidden": "true", children: "\xD7" })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx39("section", { class: "oracle-chat__history", "data-oracle-history": true, "aria-live": "polite", "aria-label": "Conversation history" }),
          /* @__PURE__ */ jsx39("form", { class: "oracle-chat__composer", "data-oracle-form": true, children: /* @__PURE__ */ jsxs26("div", { class: "oracle-chat__input-row", children: [
            /* @__PURE__ */ jsx39(
              "textarea",
              {
                id: "oracle-chat-input",
                class: "oracle-chat__input",
                name: "oracle-chat-input",
                placeholder: "Ask ORA_CLE anything about 7/10...",
                "data-oracle-input": true,
                rows: 1,
                autoComplete: "off",
                autoCapitalize: "sentences",
                "aria-label": "Ask ORA_CLE anything about 7/10",
                spellcheck: true
              }
            ),
            /* @__PURE__ */ jsx39("button", { type: "submit", class: "oracle-chat__send", "data-oracle-send": true, disabled: true, children: "Send" })
          ] }) })
        ] }) })
      ]
    }
  );
}, "OracleWidgetComponent");
var oracleWidgetStyles = `
.oracle-widget {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  flex: 0 0 auto;
}

.oracle-widget__launcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1.5px solid color-mix(in srgb, var(--color-accent-bright) 75%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-accent-bright) 25%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 55%, transparent) 100%
  );
  color: var(--color-primary-background);
  border-radius: 999px;
  padding: 0.22rem 0.55rem 0.22rem 1.1rem;
  min-height: 2.45rem;
  cursor: pointer;
  transition: background 160ms ease, transform 120ms ease, box-shadow 160ms ease, border-color 160ms ease;
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow:
    inset 0 2px 6px rgba(255, 115, 125, 0.35),
    inset 0 -2px 6px rgba(107, 0, 4, 0.4),
    0 0 12px rgba(235, 28, 36, 0.4);
}

.oracle-widget__launcher:hover,
.oracle-widget__launcher:focus-visible {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-accent-bright) 35%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 70%, transparent) 100%
  );
  border-color: color-mix(in srgb, var(--color-accent-bright) 85%, transparent);
  box-shadow:
    inset 0 2px 8px rgba(255, 140, 150, 0.45),
    inset 0 -2px 8px rgba(107, 0, 4, 0.5),
    0 0 18px rgba(235, 28, 36, 0.55);
}

.oracle-widget__launcher:active {
  transform: translateY(1px);
}

.oracle-widget__launcher:focus-visible {
  outline: 2px solid var(--color-accent-deep);
  outline-offset: 2px;
}

.oracle-widget__avatar-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  overflow: hidden;
  margin-left: 0.35rem;
  margin-right: -0.25rem;
  flex: 0 0 auto;
}

.oracle-widget__avatar {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: url("/static/oracle-pfp.png") center / cover no-repeat;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  flex-shrink: 0;
}

.oracle-widget__copy {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  line-height: 1.1;
  font-size: 1.24rem;
  white-space: nowrap;
  color: var(--color-tone-primary);
}

.oracle-widget__title {
  font-weight: 700;
  letter-spacing: 0.08em;
  font-family: "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace;
  color: var(--color-tone-primary);
  font-size: 1.05em;
}

.oracle-chat {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(500px, 100vw);
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: translateX(100%);
  z-index: 1600;
}

.oracle-chat.oracle-chat--open,
.oracle-chat.oracle-chat--closing {
  visibility: visible;
}

.oracle-chat.oracle-chat--open {
  pointer-events: auto;
  transform: translateX(0);
  opacity: 1;
}

.oracle-chat.oracle-chat--open.oracle-chat--entering {
  animation: oracle-chat-slide-in 260ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

.oracle-chat.oracle-chat--closing {
  pointer-events: none;
  animation: oracle-chat-slide-out 220ms cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.oracle-chat__surface {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--color-primary-background);
  border-left: 1px solid color-mix(in srgb, var(--color-accent-shadow) 45%, transparent);
  box-shadow: -26px 0 56px rgba(0, 0, 0, 0.38);
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.oracle-chat__dismiss-tab {
  position: absolute;
  top: 50%;
  left: -1px;
  transform: translate(calc(-100% - 0.85rem), -50%);
  width: 2.06rem;
  height: 5.4rem;
  z-index: 1;
  border: 1px solid color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  border-right: none;
  border-radius: 14px 0 0 14px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-accent-bright) 70%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 65%, transparent) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-button-text);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease, transform 200ms ease, background 160ms ease, border-color 160ms ease;
  box-shadow:
    -6px 0 18px rgba(0, 0, 0, 0.45),
    inset 0 1px 6px rgba(255, 170, 170, 0.25);
}

.oracle-chat__dismiss-tab:hover,
.oracle-chat__dismiss-tab:focus-visible {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-accent-bright) 82%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 75%, transparent) 100%
  );
  border-color: color-mix(in srgb, var(--color-accent-bright) 85%, transparent);
}

.oracle-chat__dismiss-tab:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.oracle-chat.oracle-chat--open .oracle-chat__dismiss-tab {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-100%, -50%);
}

.oracle-chat__dismiss-icon {
  width: 1.4rem;
  height: 1.4rem;
  fill: currentColor;
  transform: scaleX(-1);
}

.oracle-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.35rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-accent-shadow) 30%, transparent);
}

.oracle-chat__identity {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.oracle-chat__avatar {
  display: inline-flex;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: url("/static/oracle-pfp.png") center / cover no-repeat;
  flex-shrink: 0;
}

.oracle-chat__identity-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.oracle-chat__name {
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-tone-contrast);
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.oracle-chat__status {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
  color: var(--color-tone-muted);
  transition: color 160ms ease;
}

.oracle-chat__status[data-state="online"] {
  color: var(--color-accent-bright);
}

.oracle-chat__status[data-state="offline"] {
  color: var(--color-feedback-error);
}

.oracle-chat__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.oracle-chat__reset {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-accent-bright) 45%, transparent);
  background: color-mix(in srgb, var(--color-accent-bright) 18%, transparent);
  color: var(--color-accent-bright);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease, border-color 160ms ease;
}

.oracle-chat__reset:hover,
.oracle-chat__reset:focus-visible {
  background: color-mix(in srgb, var(--color-accent-bright) 32%, transparent);
  color: var(--color-primary-background);
  border-color: color-mix(in srgb, var(--color-accent-bright) 70%, transparent);
}

.oracle-chat__reset:focus-visible {
  outline: 2px solid var(--color-accent-deep);
  outline-offset: 2px;
}

.oracle-chat__reset:active {
  transform: translateY(1px);
}

.oracle-chat__reset-icon {
  width: 1.2rem;
  height: 1.2rem;
  display: block;
  mask: url("/static/icons/refresh-icon.svg") no-repeat center / contain;
  background: currentColor;
}

.oracle-chat__reset:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
  background: color-mix(in srgb, var(--color-accent-bright) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-accent-bright) 22%, transparent);
  color: color-mix(in srgb, var(--color-accent-bright) 65%, var(--color-tone-muted) 35%);
}

.oracle-chat__close {
  border: none;
  background: color-mix(in srgb, var(--color-accent-shadow) 30%, transparent);
  color: var(--color-tone-contrast);
  font-size: 1.25rem;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.oracle-chat__close:hover,
.oracle-chat__close:focus-visible {
  background: color-mix(in srgb, var(--color-accent-bright) 35%, transparent);
}

.oracle-chat__history {
  flex: 1 1 auto;
  padding: 1.1rem 1.35rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-behavior: smooth;
}

.oracle-chat__history:empty::before {
  content: "Ask a question to start your conversation with the ORA_CLE.";
  color: var(--color-tone-muted);
  font-size: 0.9rem;
}

.oracle-chat__message {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.oracle-chat__message--user {
  align-items: flex-end;
}

.oracle-chat__bubble {
  max-width: 85%;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-accent-shadow-light) 45%, transparent);
  color: var(--color-tone-contrast);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  white-space: normal;
  word-break: break-word;
}

.oracle-chat__message--user .oracle-chat__bubble {
  background: color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  color: var(--color-tone-contrast);
  display: block;
  white-space: pre-wrap;
}

.oracle-chat__message--assistant .oracle-chat__bubble {
  background: color-mix(in srgb, var(--color-accent-shadow) 18%, transparent);
}

.oracle-chat__bubble--pending {
  gap: 0.4rem;
  color: color-mix(in srgb, var(--color-tone-muted) 82%, var(--color-tone-contrast) 18%);
  font-style: italic;
}

.oracle-chat__pending-text {
  margin: 0;
  font-size: 0.85rem;
}

.oracle-chat__pending-context {
  margin: 0;
  font-size: 0.8rem;
  color: color-mix(in srgb, var(--color-tone-muted) 75%, var(--color-tone-contrast) 25%);
}

.oracle-chat__pending-context-item {
  font-style: italic;
  color: var(--color-accent-bright);
}

.oracle-chat__message--error .oracle-chat__bubble {
  background: color-mix(in srgb, var(--color-feedback-error) 35%, transparent);
  color: var(--color-tone-contrast);
}

.oracle-chat__answer-lead {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.5;
}

.oracle-chat__answer-body {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: color-mix(in srgb, var(--color-tone-contrast) 92%, var(--color-tone-muted) 8%);
}

.oracle-chat__rich-text a {
  color: var(--color-accent-bright);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.oracle-chat__rich-text a:hover,
.oracle-chat__rich-text a:focus-visible {
  color: color-mix(in srgb, var(--color-accent-bright) 85%, var(--color-tone-contrast) 15%);
}

.oracle-chat__link-rail {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.oracle-chat__link-rail-label {
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 70%, var(--color-tone-contrast) 30%);
}

.oracle-chat__link-rail-items {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.oracle-chat__link-rail-items::-webkit-scrollbar {
  height: 6px;
}

.oracle-chat__link-rail-items::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  border-radius: 999px;
}

.oracle-chat__pill-link {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  gap: 0.35rem;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-accent-bright);
  background: color-mix(in srgb, var(--color-accent-bright) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  text-decoration: none;
  scroll-snap-align: start;
}

.oracle-chat__pill-link:hover,
.oracle-chat__pill-link:focus-visible {
  background: color-mix(in srgb, var(--color-accent-bright) 30%, transparent);
  color: var(--color-primary-background);
}

.oracle-chat__pill-link--static {
  cursor: default;
  color: color-mix(in srgb, var(--color-tone-contrast) 85%, var(--color-tone-muted) 15%);
  background: color-mix(in srgb, var(--color-tone-muted) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-tone-muted) 32%, transparent);
}

.oracle-chat__cta {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  font-weight: 600;
  color: color-mix(in srgb, var(--color-accent-bright) 75%, var(--color-tone-contrast) 25%);
}

.oracle-chat__fallback {
  display: grid;
  gap: 0.45rem;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--color-tone-muted) 45%, transparent);
  padding: 0.65rem 0.75rem;
  background: color-mix(in srgb, var(--color-tone-muted) 12%, transparent);
}

.oracle-chat__fallback-text {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: color-mix(in srgb, var(--color-tone-contrast) 90%, var(--color-tone-muted) 10%);
}

.oracle-chat__fallback-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.oracle-chat__fallback-button {
  border: 1px solid color-mix(in srgb, var(--color-tone-muted) 55%, transparent);
  background: color-mix(in srgb, var(--color-tone-muted) 28%, transparent);
  color: color-mix(in srgb, var(--color-tone-contrast) 88%, var(--color-tone-muted) 12%);
  border-radius: 8px;
  padding: 0.3rem 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.oracle-chat__fallback-button:hover,
.oracle-chat__fallback-button:focus-visible {
  background: color-mix(in srgb, var(--color-tone-muted) 12%, var(--color-tone-contrast) 20%);
  color: var(--color-primary-background);
}

.oracle-chat__disclaimers {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--color-tone-muted) 82%, var(--color-tone-contrast) 18%);
  display: grid;
  gap: 0.3rem;
}

.oracle-chat__disclaimer-item {
  line-height: 1.4;
}

.oracle-chat__timestamp {
  font-size: 0.7rem;
  color: var(--color-tone-muted);
}

.oracle-chat__composer {
  border-top: 1px solid color-mix(in srgb, var(--color-accent-shadow) 24%, transparent);
  padding: 0.9rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.oracle-chat__input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.55rem;
}

.oracle-chat__input {
  flex: 1 1 auto;
  resize: none;
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 25%, transparent);
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  min-height: 2.35rem;
  max-height: 8.5rem;
  background: var(--color-primary-background);
  color: var(--color-tone-contrast);
}

.oracle-chat__input:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.oracle-chat__send {
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  padding: 0.65rem 1.2rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--color-accent-bright);
  color: var(--color-primary-background);
  transition: opacity 140ms ease, transform 140ms ease;
}

.oracle-chat__send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.oracle-chat__send:not(:disabled):active {
  transform: translateY(1px);
}

.oracle-chat__message--pending .oracle-chat__bubble::after {
  content: "\u2026";
  margin-left: 0.35rem;
  animation: oracle-chat-typing 1.2s infinite;
}

@keyframes oracle-chat-slide-in {
  0% {
    transform: translateX(100%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes oracle-chat-slide-out {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes oracle-chat-typing {
  0% {
    opacity: 0.2;
  }
  33% {
    opacity: 1;
  }
  66% {
    opacity: 0.2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .oracle-chat {
    transition: none;
  }

  .oracle-chat.oracle-chat--open,
  .oracle-chat.oracle-chat--closing {
    animation: none !important;
  }

  .oracle-chat.oracle-chat--closing {
    transform: translateX(100%);
    opacity: 0;
  }
}

@media (max-width: 720px) {
  .oracle-widget {
    width: 100%;
  }

  .oracle-widget__launcher {
    width: 100%;
    justify-content: space-between;
    padding-right: 1rem;
  }

  .oracle-chat__surface {
    width: 100%;
    height: 100%;
    max-height: none;
    border-radius: 0;
  }
}
`;
OracleWidgetComponent.css = oracleWidgetStyles;
OracleWidgetComponent.afterDOMLoaded = oracleChat_inline_default;
var OracleWidget_default = /* @__PURE__ */ __name((() => OracleWidgetComponent), "default");

// quartz/comments.config.ts
var commentsConfig = {
  enabled: true,
  provider: "utterances",
  repo: "brorb/710-wiki",
  issueTerm: "pathname",
  label: "\u{1F4AC} comment",
  theme: "github-dark"
};

// quartz.layout.ts
var graphHiddenTags = ["graph-exclude"];
var sharedAfterBody = [
  MediaNormalizer_default(),
  ConditionalRender_default({
    component: Canvas_default(),
    condition: /* @__PURE__ */ __name((props) => hasCanvasFrontmatter(props.fileData.frontmatter), "condition")
  }),
  MobileOnly_default(Backlinks_default()),
  ConditionalRender_default({
    component: HomepageFeatures_default(),
    condition: /* @__PURE__ */ __name((page) => page.fileData.slug === "index", "condition")
  })
];
var mobileDiscordWidget = MobileOnly_default(
  DiscordWidget_default({
    variant: "banner"
  })
);
if (commentsConfig.enabled) {
  if (commentsConfig.provider === "giscus") {
    const {
      repo,
      repoId,
      category,
      categoryId,
      mapping,
      strict,
      reactionsEnabled,
      inputPosition,
      lang,
      lightTheme,
      darkTheme,
      themeUrl
    } = commentsConfig;
    sharedAfterBody.push(
      Comments_default({
        provider: "giscus",
        options: {
          repo,
          repoId,
          category,
          categoryId,
          mapping,
          strict,
          reactionsEnabled,
          inputPosition,
          lang,
          lightTheme,
          darkTheme,
          themeUrl
        },
        mobileAppend: mobileDiscordWidget,
        desktopCompanion: DesktopOnly_default(
          DiscordWidget_default({
            variant: "sidebar"
          })
        )
      })
    );
  } else if (commentsConfig.provider === "utterances") {
    const { repo, issueTerm, label, theme } = commentsConfig;
    sharedAfterBody.push(
      Comments_default({
        provider: "utterances",
        options: {
          repo,
          issueTerm,
          label,
          theme
        },
        mobileAppend: mobileDiscordWidget,
        desktopCompanion: DesktopOnly_default(
          DiscordWidget_default({
            variant: "sidebar"
          })
        )
      })
    );
  }
}
var sharedPageComponents = {
  head: Head_default(),
  header: [LinksHeader_default()],
  afterBody: sharedAfterBody,
  footer: Footer_default()
};
var defaultContentPageLayout = {
  beforeBody: [
    ConditionalRender_default({
      component: Breadcrumbs_default(),
      condition: /* @__PURE__ */ __name((page) => page.fileData.slug !== "index", "condition")
    }),
    ArticleHeader_default(),
    InfoBox_default(),
    TagList_default(),
    MobileOnly_default(
      TableOfContents_default({
        defaultCollapsed: true
      })
    )
  ],
  left: [
    PageTitle_default(),
    DesktopOnly_default(Search_default()),
    MobileOnly_default(
      Explorer_default({
        folderClickBehavior: "link",
        folderDefaultState: "collapsed",
        headerSlot: Search_default({ variant: "inline" }),
        useSavedState: false,
        startCollapsed: true,
        filterFn: /* @__PURE__ */ __name((node) => {
          const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : "";
          return segment !== "templates" && segment !== "canvases" && segment !== "guides" && segment !== "puzzles" && segment !== "media" && segment !== "timelines";
        }, "filterFn")
      })
    ),
    DesktopOnly_default(
      Explorer_default({
        folderClickBehavior: "link",
        folderDefaultState: "collapsed",
        useSavedState: false,
        startCollapsed: false,
        filterFn: /* @__PURE__ */ __name((node) => {
          const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : "";
          return segment !== "templates" && segment !== "canvases" && segment !== "guides" && segment !== "puzzles" && segment !== "media" && segment !== "timelines";
        }, "filterFn")
      })
    )
  ],
  right: [
    DesktopOnly_default(OracleWidget_default()),
    DesktopOnly_default(
      Graph_default({
        localGraph: { removeTags: graphHiddenTags },
        globalGraph: { removeTags: graphHiddenTags }
      })
    ),
    DesktopOnly_default(
      TableOfContents_default({
        defaultCollapsed: true
      })
    ),
    DesktopOnly_default(Backlinks_default())
  ]
};
var defaultListPageLayout = {
  beforeBody: [
    Breadcrumbs_default(),
    ArticleTitle_default(),
    ContentMeta_default(),
    MobileOnly_default(
      TableOfContents_default({
        defaultCollapsed: true
      })
    )
  ],
  left: [
    PageTitle_default(),
    DesktopOnly_default(Search_default()),
    MobileOnly_default(
      Explorer_default({
        folderClickBehavior: "link",
        folderDefaultState: "collapsed",
        useSavedState: false,
        headerSlot: Search_default({ variant: "inline" }),
        filterFn: /* @__PURE__ */ __name((node) => {
          const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : "";
          return segment !== "templates" && segment !== "canvases" && segment !== "guides" && segment !== "puzzles" && segment !== "media" && segment !== "timelines";
        }, "filterFn")
      })
    ),
    DesktopOnly_default(
      Explorer_default({
        folderClickBehavior: "link",
        folderDefaultState: "open",
        filterFn: /* @__PURE__ */ __name((node) => {
          const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : "";
          return segment !== "templates" && segment !== "canvases" && segment !== "guides" && segment !== "puzzles" && segment !== "media" && segment !== "timelines";
        }, "filterFn")
      })
    )
  ],
  right: [
    DesktopOnly_default(OracleWidget_default()),
    DesktopOnly_default(
      Graph_default({
        localGraph: { removeTags: graphHiddenTags },
        globalGraph: { removeTags: graphHiddenTags }
      })
    ),
    DesktopOnly_default(
      TableOfContents_default({
        defaultCollapsed: true
      })
    ),
    DesktopOnly_default(Backlinks_default())
  ]
};

// quartz/plugins/emitters/contentPage.tsx
import { styleText as styleText2 } from "util";
async function processContent(ctx, tree, fileData, allFiles, opts, resources) {
  const slug = fileData.slug;
  const cfg = ctx.cfg.configuration;
  const externalResources = pageResources(pathToRoot(slug), resources);
  const componentData = {
    ctx,
    fileData,
    externalResources,
    cfg,
    children: [],
    tree,
    allFiles
  };
  const content = renderPage(cfg, slug, componentData, opts, externalResources);
  const result = await write({
    ctx,
    content,
    slug,
    ext: ".html"
  });
  const lastSegment = slug.split("/").pop() ?? "";
  if (lastSegment.includes(".") && !lastSegment.endsWith(".")) {
    await write({
      ctx,
      content,
      slug: joinSegments(slug, "index"),
      ext: ".html"
    });
  }
  return result;
}
__name(processContent, "processContent");
var ContentPage = /* @__PURE__ */ __name((userOpts) => {
  const opts = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content_default(),
    ...userOpts
  };
  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts;
  const Header2 = Header_default();
  const Body2 = Body_default();
  return {
    name: "ContentPage",
    getQuartzComponents() {
      return [
        Head,
        Header2,
        Body2,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer
      ];
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data);
      let containsIndex = false;
      for (const [tree, file] of content) {
        const slug = file.data.slug;
        if (slug === "index") {
          containsIndex = true;
        }
        if (slug.endsWith("/index") || slug.startsWith("tags/")) continue;
        yield processContent(ctx, tree, file.data, allFiles, opts, resources);
      }
      if (!containsIndex) {
        console.log(
          styleText2(
            "yellow",
            `
Warning: you seem to be missing an \`index.md\` home page file at the root of your \`${ctx.argv.directory}\` folder (\`${path7.join(ctx.argv.directory, "index.md")} does not exist\`). This may cause errors when deploying.`
          )
        );
      }
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const allFiles = content.map((c) => c[1].data);
      const changedSlugs = /* @__PURE__ */ new Set();
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue;
        if (changeEvent.type === "add" || changeEvent.type === "change") {
          changedSlugs.add(changeEvent.file.data.slug);
        }
      }
      for (const [tree, file] of content) {
        const slug = file.data.slug;
        if (!changedSlugs.has(slug)) continue;
        if (slug.endsWith("/index") || slug.startsWith("tags/")) continue;
        yield processContent(ctx, tree, file.data, allFiles, opts, resources);
      }
    }
  };
}, "ContentPage");

// quartz/plugins/vfile.ts
import { VFile } from "vfile";
function defaultProcessedContent(vfileData) {
  const root = { type: "root", children: [] };
  const vfile = new VFile("");
  vfile.data = vfileData;
  return [root, vfile];
}
__name(defaultProcessedContent, "defaultProcessedContent");

// quartz/plugins/emitters/tagPage.tsx
function computeTagInfo(allFiles, content, locale) {
  const tags = new Set(
    allFiles.flatMap((data) => data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes)
  );
  tags.add("index");
  const tagDescriptions = Object.fromEntries(
    [...tags].map((tag) => {
      const title = tag === "index" ? i18n(locale).pages.tagContent.tagIndex : `${i18n(locale).pages.tagContent.tag}: ${tag}`;
      return [
        tag,
        defaultProcessedContent({
          slug: joinSegments("tags", tag),
          frontmatter: { title, tags: [] }
        })
      ];
    })
  );
  for (const [tree, file] of content) {
    const slug = file.data.slug;
    if (slug.startsWith("tags/")) {
      const tag = slug.slice("tags/".length);
      if (tags.has(tag)) {
        tagDescriptions[tag] = [tree, file];
        if (file.data.frontmatter?.title === tag) {
          file.data.frontmatter.title = `${i18n(locale).pages.tagContent.tag}: ${tag}`;
        }
      }
    }
  }
  return [tags, tagDescriptions];
}
__name(computeTagInfo, "computeTagInfo");
async function processTagPage(ctx, tag, tagContent, allFiles, opts, resources) {
  const slug = joinSegments("tags", tag);
  const [tree, file] = tagContent;
  const cfg = ctx.cfg.configuration;
  const externalResources = pageResources(pathToRoot(slug), resources);
  const componentData = {
    ctx,
    fileData: file.data,
    externalResources,
    cfg,
    children: [],
    tree,
    allFiles
  };
  const content = renderPage(cfg, slug, componentData, opts, externalResources);
  return write({
    ctx,
    content,
    slug: file.data.slug,
    ext: ".html"
  });
}
__name(processTagPage, "processTagPage");
var TagPage = /* @__PURE__ */ __name((userOpts) => {
  const opts = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: TagContent_default({ sort: userOpts?.sort }),
    ...userOpts
  };
  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts;
  const Header2 = Header_default();
  const Body2 = Body_default();
  return {
    name: "TagPage",
    getQuartzComponents() {
      return [
        Head,
        Header2,
        Body2,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer
      ];
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data);
      const cfg = ctx.cfg.configuration;
      const [tags, tagDescriptions] = computeTagInfo(allFiles, content, cfg.locale);
      for (const tag of tags) {
        yield processTagPage(ctx, tag, tagDescriptions[tag], allFiles, opts, resources);
      }
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const allFiles = content.map((c) => c[1].data);
      const cfg = ctx.cfg.configuration;
      const affectedTags = /* @__PURE__ */ new Set();
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue;
        const slug = changeEvent.file.data.slug;
        if (slug.startsWith("tags/")) {
          const tag = slug.slice("tags/".length);
          affectedTags.add(tag);
        }
        const fileTags = changeEvent.file.data.frontmatter?.tags ?? [];
        fileTags.flatMap(getAllSegmentPrefixes).forEach((tag) => affectedTags.add(tag));
        affectedTags.add("index");
      }
      if (affectedTags.size > 0) {
        const [_tags, tagDescriptions] = computeTagInfo(allFiles, content, cfg.locale);
        for (const tag of affectedTags) {
          if (tagDescriptions[tag]) {
            yield processTagPage(ctx, tag, tagDescriptions[tag], allFiles, opts, resources);
          }
        }
      }
    }
  };
}, "TagPage");

// quartz/plugins/emitters/folderPage.tsx
import path8 from "path";
import { VFile as VFile2 } from "vfile";
async function* processFolderInfo(ctx, folderInfo, allFiles, opts, resources) {
  for (const [folder, folderContent] of Object.entries(folderInfo)) {
    const slug = joinSegments(folder, "index");
    const [tree, file] = folderContent;
    const cfg = ctx.cfg.configuration;
    const externalResources = pageResources(pathToRoot(slug), resources);
    const componentData = {
      ctx,
      fileData: file.data,
      externalResources,
      cfg,
      children: [],
      tree,
      allFiles
    };
    const content = renderPage(cfg, slug, componentData, opts, externalResources);
    yield write({
      ctx,
      content,
      slug,
      ext: ".html"
    });
  }
}
__name(processFolderInfo, "processFolderInfo");
function computeFolderInfo(folders, content, locale) {
  const folderInfo = Object.fromEntries(
    [...folders].map((folder) => {
      const folderLabel = folder.split("/").filter(Boolean).at(-1) ?? folder;
      const defaultTitle = folderLabel.length > 0 ? folderLabel : i18n(locale).pages.folderContent.folder;
      return [
        folder,
        defaultProcessedContent({
          slug: joinSegments(folder, "index"),
          frontmatter: {
            title: defaultTitle,
            tags: []
          }
        })
      ];
    })
  );
  const explicitFolders = /* @__PURE__ */ new Set();
  const descriptionContent = /* @__PURE__ */ new Map();
  const descriptionBasename = "foldercontentdescription";
  for (const [tree, file] of content) {
    const originalSlug = file.data.slug;
    if (!originalSlug) {
      continue;
    }
    const simplifiedSlug = stripSlashes(simplifySlug(originalSlug));
    const segments = simplifiedSlug.split("/");
    const lastSegment = segments.at(-1)?.toLowerCase();
    if (lastSegment === descriptionBasename) {
      const folderSlug = segments.slice(0, -1).join("/");
      if (folders.has(folderSlug)) {
        const remappedSlug = joinSegments(folderSlug, "index");
        const clonedFile = new VFile2(file);
        const existingFrontmatter = file.data.frontmatter ?? {};
        const folderLabel = folderSlug.split("/").filter(Boolean).at(-1) ?? folderSlug;
        const fallbackTitle = folderLabel.length > 0 ? folderLabel : i18n(locale).pages.folderContent.folder;
        const frontmatterTitle = typeof existingFrontmatter.title === "string" ? existingFrontmatter.title.trim() : "";
        const resolvedTitle = frontmatterTitle.length > 0 && frontmatterTitle.toLowerCase() !== descriptionBasename ? frontmatterTitle : fallbackTitle;
        clonedFile.data = {
          ...file.data,
          slug: remappedSlug,
          frontmatter: {
            ...existingFrontmatter,
            title: resolvedTitle
          }
        };
        descriptionContent.set(folderSlug, [tree, clonedFile]);
      }
      continue;
    }
    if (folders.has(simplifiedSlug)) {
      folderInfo[simplifiedSlug] = [tree, file];
      explicitFolders.add(simplifiedSlug);
    }
  }
  for (const [folder, processed] of descriptionContent) {
    if (!explicitFolders.has(folder)) {
      folderInfo[folder] = processed;
    }
  }
  return folderInfo;
}
__name(computeFolderInfo, "computeFolderInfo");
function _getFolders(slug) {
  var folderName = path8.dirname(slug ?? "");
  const parentFolderNames = [folderName];
  while (folderName !== ".") {
    folderName = path8.dirname(folderName ?? "");
    parentFolderNames.push(folderName);
  }
  return parentFolderNames.filter((folder) => folder !== "canvases");
}
__name(_getFolders, "_getFolders");
var FolderPage = /* @__PURE__ */ __name((userOpts) => {
  const opts = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: FolderContent_default({ sort: userOpts?.sort }),
    ...userOpts
  };
  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts;
  const Header2 = Header_default();
  const Body2 = Body_default();
  return {
    name: "FolderPage",
    getQuartzComponents() {
      return [
        Head,
        Header2,
        Body2,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer
      ];
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data);
      const cfg = ctx.cfg.configuration;
      const folders = new Set(
        allFiles.flatMap((data) => {
          return data.slug ? _getFolders(data.slug).filter(
            (folderName) => folderName !== "." && folderName !== "tags"
          ) : [];
        })
      );
      const folderInfo = computeFolderInfo(folders, content, cfg.locale);
      yield* processFolderInfo(ctx, folderInfo, allFiles, opts, resources);
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const allFiles = content.map((c) => c[1].data);
      const cfg = ctx.cfg.configuration;
      const affectedFolders = /* @__PURE__ */ new Set();
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue;
        const slug = changeEvent.file.data.slug;
        const folders = _getFolders(slug).filter(
          (folderName) => folderName !== "." && folderName !== "tags"
        );
        folders.forEach((folder) => affectedFolders.add(folder));
      }
      if (affectedFolders.size > 0) {
        const folderInfo = computeFolderInfo(affectedFolders, content, cfg.locale);
        yield* processFolderInfo(ctx, folderInfo, allFiles, opts, resources);
      }
    }
  };
}, "FolderPage");

// quartz/plugins/emitters/contentIndex.tsx
import { toHtml as toHtml2 } from "hast-util-to-html";

// quartz/data/log_alias_map.json
var log_alias_map_default = {
  "LOG-156": [],
  "LOG-155": [],
  "LOG-154": [],
  "LOG-147": [],
  "LOG-142": [],
  "LOG-141": [],
  "LOG- _ _ _ ": [],
  "LOG.138": [],
  "LOG-136": [],
  "LOG-137": [],
  "LOG-135": [],
  "LOG-134": [],
  "33LOG-13": [
    "LOG 133"
  ],
  "LOG-132": [],
  "log-131": [],
  "LOG-129": [],
  "LOG-128": [],
  "LOG-127": [],
  "LOG-126": [],
  "LOG-125": [],
  "LOG-124": [],
  "LOG-123": [],
  "LOG-116": [],
  "LOG-113": [],
  "LOG-112": [],
  "LOG-111": [],
  "LOG-110": [],
  "LOG-109": [],
  "LOG-10444444444444444444444": [
    "log 104"
  ],
  "LOG-103": [],
  "LOG-102": [],
  "LOG-100": [],
  "LOG-99": [],
  "LOG-96": [],
  "LOG-95": [],
  "LOG-93": [],
  "LOG-92": [],
  "LOG-90": [],
  "LOG-89": [],
  "LOG-88": [],
  "LOG-87": [],
  "LOG-86": [],
  "LOG-85": [],
  "LOG-84": [],
  "LOG-83": [],
  "LOG-78": [],
  "LOG-77": [],
  "LOG-76": [],
  "LOG-74": [],
  "LOG-73": [],
  "LOG-72": [],
  "LOG-71": [],
  "LOG-70": [],
  "LOG-69": [],
  "LOG-68": [],
  "LOG-67": [],
  "LOG-66": [],
  "LOG-65": [],
  "LOG-64": [],
  "LOG-63": [],
  "LOG-62": [],
  "LOG-48": [],
  "LOG-47": [],
  "LOG--": [
    "log 45",
    "log 46"
  ],
  "LOG-44": [],
  "LOG-43": [],
  "LOG-42": [],
  "LOG-41": [],
  "LOG-40": [],
  "LOG-39.": [
    "log 39.5"
  ],
  "LOG-39": [],
  "LOG-38": [],
  "LOG-37": [],
  "LOG-36": [],
  "LOG-35": [],
  "LOG-34": [],
  "LOG-33": [],
  "LOG-32": [],
  "LOG-31": [],
  "30": [
    "log 30"
  ],
  "LOG-29": [],
  "LOG-28": [],
  "LOG-27": [],
  "LOG-26": [],
  "LOG-25": [],
  "LLOOGG--2211.": [
    "log 21"
  ],
  "LOG-20...": [],
  "LOG-17": [],
  "LOG-15": [],
  "LOG-14.mp4 .": [],
  "LOG-13": [],
  "LOG-12": [],
  "LOG-11": [],
  "LOG-10": [],
  "LOG-9": [],
  "LOG-008": [],
  "LOG-007": [],
  "LOG-005": [],
  "LOG-006": [],
  "LOG-004": [],
  "LOG-003": [],
  "LOG-002": [],
  "LOG-46": []
};

// quartz/plugins/emitters/contentIndex.tsx
import { jsx as jsx40 } from "preact/jsx-runtime";
var defaultOptions17 = {
  enableSiteMap: true,
  enableRSS: true,
  rssLimit: 10,
  rssFullHtml: false,
  rssSlug: "index",
  includeEmptyFiles: true
};
var VIDEO_PATH_INDICATORS = ["youtube/videos", "youtube/livestreams"];
var MAX_ALIAS_OUTPUT = 80;
var ALIAS_SUBSTITUTIONS = [
  [/&/g, " and "],
  [/@/g, " at "],
  [/\+/g, " "],
  [/:/g, " "]
];
var REMOVABLE_EXTENSIONS = /* @__PURE__ */ new Set([
  "md",
  "mdown",
  "mdx",
  "markdown",
  "txt",
  "html",
  "htm",
  "mp",
  "mp2",
  "mp3",
  "mp4",
  "mpeg",
  "mpg",
  "mpga",
  "mov",
  "avi",
  "wmv",
  "webm",
  "mkv",
  "m4a",
  "m4v",
  "wav",
  "flac",
  "aac",
  "ogg",
  "opus"
]);
var LOG_NUMBER_REGEX = /\d+/g;
var FOLDER_DESCRIPTION_BASENAME2 = "foldercontentdescription";
function stripAllExtensions(value) {
  let current = value;
  while (true) {
    const match = current.match(/\.([^.]+)$/u);
    if (!match) {
      break;
    }
    const ext = match[1]?.toLowerCase() ?? "";
    if (!REMOVABLE_EXTENSIONS.has(ext)) {
      break;
    }
    current = current.slice(0, -match[0].length);
  }
  return current;
}
__name(stripAllExtensions, "stripAllExtensions");
function basename(value) {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts.length > 0 ? parts[parts.length - 1] ?? value : value;
}
__name(basename, "basename");
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}
__name(safeDecode, "safeDecode");
function sanitizeUrlSegment(segment) {
  const decoded = safeDecode(segment ?? "").trim();
  if (!decoded) {
    return "";
  }
  let normalized = decoded.replace(/'/g, "");
  normalized = normalized.replace(/\s+/g, "-");
  normalized = normalized.replace(/-+/g, "-");
  normalized = normalized.replace(/^-+/, "").replace(/-+$/, "");
  return normalized;
}
__name(sanitizeUrlSegment, "sanitizeUrlSegment");
function basicAliasForms(base) {
  const forms = /* @__PURE__ */ new Set();
  const queue = [base];
  while (queue.length > 0) {
    const current = queue.pop() ?? "";
    if (forms.has(current)) {
      continue;
    }
    forms.add(current);
    for (const [pattern, replacement] of ALIAS_SUBSTITUTIONS) {
      const replaced = current.replace(pattern, replacement);
      if (!forms.has(replaced)) {
        queue.push(replaced);
      }
      const stripped = current.replace(pattern, " ");
      if (!forms.has(stripped)) {
        queue.push(stripped);
      }
    }
    const withoutQuotes = current.replace(/'/g, "");
    if (!forms.has(withoutQuotes)) {
      queue.push(withoutQuotes);
    }
    const withoutParens = current.replace(/[()]+/g, " ");
    if (!forms.has(withoutParens)) {
      queue.push(withoutParens);
    }
  }
  return forms;
}
__name(basicAliasForms, "basicAliasForms");
function expandAliasVariants(raw) {
  if (raw == null) {
    return /* @__PURE__ */ new Set();
  }
  let base;
  if (Array.isArray(raw)) {
    base = raw.map((item) => (item ?? "").toString()).join(" ");
  } else if (typeof raw === "object") {
    base = Object.values(raw).map((value) => (value ?? "").toString()).join(" ");
  } else {
    base = raw.toString();
  }
  const trimmed = base.trim();
  if (!trimmed) {
    return /* @__PURE__ */ new Set();
  }
  const variants = basicAliasForms(trimmed);
  const results = /* @__PURE__ */ new Set();
  for (const variant of variants) {
    const value = variant.trim();
    if (!value) {
      continue;
    }
    results.add(value);
    results.add(value.toLowerCase());
    const collapsed = value.replace(/\s+/g, "");
    if (collapsed) {
      results.add(collapsed);
    }
    const hyphenated = value.replace(/\s+/g, "-");
    if (hyphenated) {
      results.add(hyphenated);
    }
    const underscored = value.replace(/\s+/g, "_");
    if (underscored) {
      results.add(underscored);
    }
    const spaced = value.replace(/[-_/]+/g, " ").trim();
    if (spaced) {
      results.add(spaced);
    }
    const stripped = value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
    if (stripped) {
      results.add(stripped);
    }
    const pieces = value.split(/[\s_\-/.]+/).filter((piece) => piece.length >= 2);
    for (const piece of pieces) {
      results.add(piece);
      results.add(piece.toLowerCase());
    }
  }
  return new Set(Array.from(results).filter((candidate) => candidate.length > 0));
}
__name(expandAliasVariants, "expandAliasVariants");
function addAliasVariants(target, raw) {
  const variants = expandAliasVariants(raw);
  for (const variant of variants) {
    target.add(variant);
  }
}
__name(addAliasVariants, "addAliasVariants");
function addPathAliases(target, relativePath) {
  if (!relativePath) {
    return;
  }
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!normalized) {
    return;
  }
  addAliasVariants(target, normalized);
  const withoutExt = stripAllExtensions(normalized);
  if (withoutExt && withoutExt !== normalized) {
    addAliasVariants(target, withoutExt);
  }
  const segments = normalized.split("/").filter(Boolean);
  const sanitizedSegments = segments.map((segment) => sanitizeUrlSegment(segment)).filter(Boolean);
  if (sanitizedSegments.length > 0) {
    addAliasVariants(target, sanitizedSegments.join("/"));
  }
  for (const [index, segment] of sanitizedSegments.entries()) {
    addAliasVariants(target, segment);
    if (index === sanitizedSegments.length - 1) {
      addAliasVariants(target, segment.replace(/[^a-z0-9]+/gi, ""));
    }
  }
}
__name(addPathAliases, "addPathAliases");
function expandLogAlias(label) {
  const normalized = label.trim();
  if (normalized.length === 0) {
    return [];
  }
  const tokens = /* @__PURE__ */ new Set();
  const addVariant = /* @__PURE__ */ __name((candidate) => {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return;
    }
    tokens.add(trimmed);
    tokens.add(trimmed.toLowerCase());
  }, "addVariant");
  addVariant(normalized);
  const separatorsToSpace = normalized.replace(/[_-]+/g, " ");
  addVariant(separatorsToSpace);
  const punctuationToSpace = normalized.replace(/[^\p{L}\p{N}\s]+/gu, " ");
  addVariant(punctuationToSpace);
  const collapsedWhitespace = punctuationToSpace.replace(/\s+/g, " ").trim();
  if (collapsedWhitespace) {
    addVariant(collapsedWhitespace);
    const segments = collapsedWhitespace.split(" ").filter(Boolean);
    if (segments.length > 1) {
      addVariant(segments.join("-"));
      addVariant(segments.join("_"));
      addVariant(segments.join(""));
    } else if (segments.length === 1) {
      addVariant(segments[0]);
    }
  }
  const digits = normalized.match(LOG_NUMBER_REGEX) ?? [];
  const includeLogPrefixes = digits.length > 0;
  for (const sequence of digits) {
    const trimmedSequence = sequence.replace(/^0+(\d)/u, "$1") || sequence;
    const padded = sequence.length <= 3 ? sequence.padStart(3, "0") : sequence;
    const variants = /* @__PURE__ */ new Set([sequence, trimmedSequence, padded]);
    for (const variant of variants) {
      if (!variant) {
        continue;
      }
      addVariant(variant);
      if (includeLogPrefixes) {
        addVariant(`log ${variant}`);
        addVariant(`log-${variant}`);
        addVariant(`log${variant}`);
        addVariant(`log_${variant}`);
      }
    }
  }
  return Array.from(tokens);
}
__name(expandLogAlias, "expandLogAlias");
var RAW_LOG_ALIAS_MAP = log_alias_map_default || {};
var LOG_ALIAS_MAP = new Map(
  Object.entries(RAW_LOG_ALIAS_MAP).map(([rawKey, canonicalPieces]) => {
    const canonicalKey = stripAllExtensions(rawKey).trim();
    const normalizedKey = canonicalKey.toLowerCase();
    const aliasSet = /* @__PURE__ */ new Set();
    if (canonicalKey.length > 0) {
      aliasSet.add(canonicalKey);
      aliasSet.add(canonicalKey.toLowerCase());
      expandLogAlias(canonicalKey).forEach((alias) => aliasSet.add(alias));
    }
    const rawLiteral = rawKey.trim();
    if (rawLiteral.length > 0 && rawLiteral !== canonicalKey) {
      aliasSet.add(rawLiteral);
      aliasSet.add(rawLiteral.toLowerCase());
    }
    for (const piece of canonicalPieces || []) {
      const trimmedPiece = piece?.trim() ?? "";
      if (!trimmedPiece) {
        continue;
      }
      const canonicalPiece = stripAllExtensions(trimmedPiece);
      if (canonicalPiece.length > 0) {
        aliasSet.add(canonicalPiece);
        aliasSet.add(canonicalPiece.toLowerCase());
        expandLogAlias(canonicalPiece).forEach((alias) => aliasSet.add(alias));
      }
      if (canonicalPiece !== trimmedPiece) {
        aliasSet.add(trimmedPiece);
        aliasSet.add(trimmedPiece.toLowerCase());
      }
    }
    return [normalizedKey, Array.from(aliasSet)];
  })
);
function shouldGenerateVideoAliases(relativePath) {
  if (!relativePath) {
    return false;
  }
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  return VIDEO_PATH_INDICATORS.some((indicator) => normalized.includes(indicator));
}
__name(shouldGenerateVideoAliases, "shouldGenerateVideoAliases");
function buildSearchAliases(slug, relativePath, title, frontmatterAliases, logAliasMap) {
  const aliases = /* @__PURE__ */ new Set();
  addAliasVariants(aliases, slug);
  addAliasVariants(aliases, title);
  if (frontmatterAliases) {
    for (const candidate of frontmatterAliases) {
      addAliasVariants(aliases, candidate);
    }
  }
  addPathAliases(aliases, relativePath);
  if (shouldGenerateVideoAliases(relativePath)) {
    const fileName = basename(relativePath ?? "");
    const sanitizedBase = stripAllExtensions(fileName);
    if (sanitizedBase) {
      const key = sanitizedBase.toLowerCase();
      const lookup = logAliasMap.get(key) ?? [];
      lookup.forEach((alias) => addAliasVariants(aliases, alias));
      expandLogAlias(sanitizedBase).forEach((variant) => addAliasVariants(aliases, variant));
    }
  }
  const aliasList = Array.from(aliases).map((alias) => alias.trim()).filter((alias) => alias.length > 0);
  if (aliasList.length === 0) {
    return void 0;
  }
  const deduped = Array.from(new Set(aliasList));
  deduped.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return a.localeCompare(b);
  });
  return deduped.slice(0, MAX_ALIAS_OUTPUT);
}
__name(buildSearchAliases, "buildSearchAliases");
function generateSiteMap(cfg, idx) {
  const base = cfg.baseUrl ?? "";
  const createURLEntry = /* @__PURE__ */ __name((slug, content) => `<url>
    <loc>https://${joinSegments(base, encodeURI(slug))}</loc>
    ${content.date && `<lastmod>${content.date.toISOString()}</lastmod>`}
  </url>`, "createURLEntry");
  const urls = Array.from(idx).map(([slug, content]) => createURLEntry(simplifySlug(slug), content)).join("");
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
}
__name(generateSiteMap, "generateSiteMap");
var MAX_RSS_ITEMS = 100;
function generateRSSFeed(cfg, idx, limit) {
  const base = cfg.baseUrl ?? "";
  const effectiveLimit = Math.min(limit ?? MAX_RSS_ITEMS, MAX_RSS_ITEMS);
  const createURLEntry = /* @__PURE__ */ __name((slug, content) => `<item>
    <title>${escapeHTML(content.title)}</title>
    <link>https://${joinSegments(base, encodeURI(slug))}</link>
    <guid>https://${joinSegments(base, encodeURI(slug))}</guid>
    <description><![CDATA[ ${content.richContent ?? content.description} ]]></description>
    <pubDate>${content.date?.toUTCString()}</pubDate>
  </item>`, "createURLEntry");
  const items = Array.from(idx).sort(([_, f1], [__, f2]) => {
    if (f1.date && f2.date) {
      return f2.date.getTime() - f1.date.getTime();
    } else if (f1.date && !f2.date) {
      return -1;
    } else if (!f1.date && f2.date) {
      return 1;
    }
    return f1.title.localeCompare(f2.title);
  }).map(([slug, content]) => createURLEntry(simplifySlug(slug), content)).slice(0, effectiveLimit).join("");
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
    <channel>
      <title>${escapeHTML(cfg.pageTitle)}</title>
      <link>https://${base}</link>
      <description>${limit !== void 0 ? i18n(cfg.locale).pages.rss.lastFewNotes({ count: effectiveLimit }) : i18n(cfg.locale).pages.rss.recentNotes} on ${escapeHTML(
    cfg.pageTitle
  )}</description>
      <generator>Quartz -- quartz.jzhao.xyz</generator>
      ${items}
    </channel>
  </rss>`;
}
__name(generateRSSFeed, "generateRSSFeed");
var ContentIndex = /* @__PURE__ */ __name((opts) => {
  opts = { ...defaultOptions17, ...opts };
  const logAliasMap = LOG_ALIAS_MAP;
  return {
    name: "ContentIndex",
    async *emit(ctx, content) {
      const cfg = ctx.cfg.configuration;
      const linkIndex = /* @__PURE__ */ new Map();
      for (const [tree, file] of content) {
        const slug = file.data.slug;
        const date = getDate(ctx.cfg.configuration, file.data) ?? /* @__PURE__ */ new Date();
        if (opts?.includeEmptyFiles || file.data.text && file.data.text !== "") {
          const frontmatter = file.data.frontmatter ?? {};
          const simplifiedSlug = simplifySlug(slug);
          const slugSegments = simplifiedSlug.split("/").filter((segment) => segment.length > 0);
          const lastSegment = slugSegments.at(-1)?.toLowerCase();
          const isFolderDescription = lastSegment === FOLDER_DESCRIPTION_BASENAME2;
          const folderSlug = isFolderDescription ? slugSegments.slice(0, -1).join("/") : void 0;
          const folderIndexSlug = isFolderDescription ? joinSegments(folderSlug ?? "", "index") : slug;
          const folderLabel = folderSlug?.split("/").filter((segment) => segment.length > 0).at(-1) ?? folderSlug ?? "";
          const fallbackFolderTitle = folderLabel && folderLabel.length > 0 ? folderLabel : i18n(cfg.locale).pages.folderContent.folder;
          const rawFrontmatterTitle = typeof frontmatter["title"] === "string" ? frontmatter["title"].trim() : "";
          const resolvedTitle = (() => {
            if (isFolderDescription) {
              if (rawFrontmatterTitle.length > 0 && rawFrontmatterTitle.toLowerCase() !== FOLDER_DESCRIPTION_BASENAME2) {
                return rawFrontmatterTitle;
              }
              return fallbackFolderTitle;
            }
            return rawFrontmatterTitle.length > 0 ? rawFrontmatterTitle : slug;
          })();
          const frontmatterAliasCandidates = [];
          if (frontmatter["aliases"] !== void 0) {
            frontmatterAliasCandidates.push(frontmatter["aliases"]);
          }
          if (frontmatter["alias"] !== void 0) {
            frontmatterAliasCandidates.push(frontmatter["alias"]);
          }
          if (frontmatter["aka"] !== void 0) {
            frontmatterAliasCandidates.push(frontmatter["aka"]);
          }
          if (frontmatter["searchAliases"] !== void 0) {
            frontmatterAliasCandidates.push(frontmatter["searchAliases"]);
          }
          const frontmatterAliases = frontmatterAliasCandidates.length > 0 ? frontmatterAliasCandidates : void 0;
          const effectiveSlug = isFolderDescription ? folderIndexSlug : slug;
          const details = {
            slug: effectiveSlug,
            filePath: file.data.relativePath,
            title: resolvedTitle,
            links: file.data.links ?? [],
            tags: file.data.frontmatter?.tags ?? [],
            content: file.data.text ?? "",
            richContent: opts?.rssFullHtml ? escapeHTML(toHtml2(tree, { allowDangerousHtml: true })) : void 0,
            date,
            description: file.data.description ?? "",
            searchAliases: buildSearchAliases(
              effectiveSlug,
              file.data.relativePath,
              resolvedTitle,
              frontmatterAliases,
              logAliasMap
            )
          };
          if (isFolderDescription && linkIndex.has(effectiveSlug)) {
            const existing = linkIndex.get(effectiveSlug);
            const mergedLinks = Array.from(/* @__PURE__ */ new Set([...existing.links ?? [], ...details.links ?? []]));
            const mergedTags = Array.from(/* @__PURE__ */ new Set([...existing.tags ?? [], ...details.tags ?? []]));
            const mergedAliasesSet = /* @__PURE__ */ new Set([...existing.searchAliases ?? [], ...details.searchAliases ?? []]);
            linkIndex.set(effectiveSlug, {
              ...existing,
              links: mergedLinks,
              tags: mergedTags,
              title: existing.title && existing.title.trim().length > 0 ? existing.title : details.title,
              content: existing.content && existing.content.trim().length > 0 ? existing.content : details.content,
              richContent: existing.richContent ?? details.richContent,
              searchAliases: mergedAliasesSet.size > 0 ? Array.from(mergedAliasesSet) : void 0
            });
          } else {
            linkIndex.set(effectiveSlug, details);
          }
        }
      }
      if (opts?.enableSiteMap) {
        yield write({
          ctx,
          content: generateSiteMap(cfg, linkIndex),
          slug: "sitemap",
          ext: ".xml"
        });
      }
      if (opts?.enableRSS) {
        yield write({
          ctx,
          content: generateRSSFeed(cfg, linkIndex, opts.rssLimit),
          slug: opts?.rssSlug ?? "index",
          ext: ".xml"
        });
      }
      const fp = joinSegments("static", "contentIndex");
      const simplifiedEntries = Array.from(linkIndex).map(
        ([slug, content2]) => {
          const { date, description: _description, ...rest } = content2;
          return [
            slug,
            {
              ...rest,
              updated: date?.toISOString(),
              searchAliases: content2.searchAliases
            }
          ];
        }
      );
      const simplifiedIndex = Object.fromEntries(simplifiedEntries);
      const jsonOutput = JSON.stringify(simplifiedIndex, null, 2);
      yield write({
        ctx,
        content: `${jsonOutput}
`,
        slug: fp,
        ext: ".json"
      });
    },
    externalResources: /* @__PURE__ */ __name((ctx) => {
      if (opts?.enableRSS) {
        return {
          additionalHead: [
            /* @__PURE__ */ jsx40(
              "link",
              {
                rel: "alternate",
                type: "application/rss+xml",
                title: "RSS Feed",
                href: `https://${ctx.cfg.configuration.baseUrl}/index.xml`
              }
            )
          ]
        };
      }
    }, "externalResources")
  };
}, "ContentIndex");

// quartz/plugins/emitters/aliases.ts
import path9 from "path";
async function* processFile(ctx, file) {
  const ogSlug = simplifySlug(file.data.slug);
  for (const aliasTarget of file.data.aliases ?? []) {
    const aliasTargetSlug = isRelativeURL(aliasTarget) ? path9.normalize(path9.join(ogSlug, "..", aliasTarget)) : aliasTarget;
    const redirUrl = resolveRelative(aliasTargetSlug, ogSlug);
    yield write({
      ctx,
      content: `
        <!DOCTYPE html>
        <html lang="en-us">
        <head>
        <title>${ogSlug}</title>
        <link rel="canonical" href="${redirUrl}">
        <meta name="robots" content="noindex">
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0; url=${redirUrl}">
        </head>
        </html>
        `,
      slug: aliasTargetSlug,
      ext: ".html"
    });
  }
}
__name(processFile, "processFile");
var AliasRedirects = /* @__PURE__ */ __name(() => ({
  name: "AliasRedirects",
  async *emit(ctx, content) {
    for (const [_tree, file] of content) {
      yield* processFile(ctx, file);
    }
  },
  async *partialEmit(ctx, _content, _resources, changeEvents) {
    for (const changeEvent of changeEvents) {
      if (!changeEvent.file) continue;
      if (changeEvent.type === "add" || changeEvent.type === "change") {
        yield* processFile(ctx, changeEvent.file);
      }
    }
  }
}), "AliasRedirects");

// quartz/plugins/emitters/assets.ts
import path11 from "path";
import fs4 from "fs";

// quartz/util/glob.ts
import path10 from "path";
import { globby } from "globby";
function toPosixPath(fp) {
  return fp.split(path10.sep).join("/");
}
__name(toPosixPath, "toPosixPath");
async function glob(pattern, cwd2, ignorePatterns) {
  const fps = (await globby(pattern, {
    cwd: cwd2,
    ignore: ignorePatterns,
    gitignore: true
  })).map(toPosixPath);
  return fps;
}
__name(glob, "glob");

// quartz/plugins/emitters/assets.ts
var filesToCopy = /* @__PURE__ */ __name(async (argv, cfg) => {
  return await glob("**", argv.directory, ["**/*.md", ...cfg.configuration.ignorePatterns]);
}, "filesToCopy");
var copyFile = /* @__PURE__ */ __name(async (argv, fp) => {
  const src = joinSegments(argv.directory, fp);
  const name = slugifyFilePath(fp);
  const dest = joinSegments(argv.output, name);
  const dir = path11.dirname(dest);
  await fs4.promises.mkdir(dir, { recursive: true });
  await fs4.promises.copyFile(src, dest);
  return dest;
}, "copyFile");
var Assets = /* @__PURE__ */ __name(() => {
  return {
    name: "Assets",
    async *emit({ argv, cfg }) {
      const fps = await filesToCopy(argv, cfg);
      for (const fp of fps) {
        yield copyFile(argv, fp);
      }
    },
    async *partialEmit(ctx, _content, _resources, changeEvents) {
      for (const changeEvent of changeEvents) {
        const ext = path11.extname(changeEvent.path);
        if (ext === ".md") continue;
        if (changeEvent.type === "add" || changeEvent.type === "change") {
          yield copyFile(ctx.argv, changeEvent.path);
        } else if (changeEvent.type === "delete") {
          const name = slugifyFilePath(changeEvent.path);
          const dest = joinSegments(ctx.argv.output, name);
          await fs4.promises.unlink(dest);
        }
      }
    }
  };
}, "Assets");

// quartz/plugins/emitters/static.ts
import fs5 from "fs";
import { dirname } from "path";
var Static = /* @__PURE__ */ __name(() => ({
  name: "Static",
  async *emit({ argv, cfg }) {
    const staticPath = joinSegments(QUARTZ, "static");
    const fps = await glob("**", staticPath, cfg.configuration.ignorePatterns);
    const outputStaticPath = joinSegments(argv.output, "static");
    await fs5.promises.mkdir(outputStaticPath, { recursive: true });
    for (const fp of fps) {
      const src = joinSegments(staticPath, fp);
      const dest = joinSegments(outputStaticPath, fp);
      await fs5.promises.mkdir(dirname(dest), { recursive: true });
      await fs5.promises.copyFile(src, dest);
      yield dest;
    }
  },
  async *partialEmit() {
  }
}), "Static");

// quartz/plugins/emitters/favicon.ts
import sharp2 from "sharp";
var Favicon = /* @__PURE__ */ __name(() => ({
  name: "Favicon",
  async *emit({ argv }) {
    const iconPath = joinSegments(QUARTZ, "static", "icon.png");
    const faviconContent = sharp2(iconPath).resize(48, 48).toFormat("png");
    yield write({
      ctx: { argv },
      slug: "favicon",
      ext: ".ico",
      content: faviconContent
    });
  },
  async *partialEmit() {
  }
}), "Favicon");

// quartz/components/scripts/spa.inline.ts
var spa_inline_default = "";

// quartz/components/scripts/popover.inline.ts
var popover_inline_default = "";

// quartz/styles/custom.scss
var custom_default = "";

// quartz/components/styles/popover.scss
var popover_default = "";

// quartz/plugins/emitters/componentResources.ts
import { Features, transform } from "lightningcss";
import { transform as transpile } from "esbuild";
function getComponentResources(ctx) {
  const allComponents = /* @__PURE__ */ new Set();
  for (const emitter of ctx.cfg.plugins.emitters) {
    const components = emitter.getQuartzComponents?.(ctx) ?? [];
    for (const component of components) {
      allComponents.add(component);
    }
  }
  const componentResources = {
    css: /* @__PURE__ */ new Set(),
    beforeDOMLoaded: /* @__PURE__ */ new Set(),
    afterDOMLoaded: /* @__PURE__ */ new Set()
  };
  function normalizeResource(resource) {
    if (!resource) return [];
    if (Array.isArray(resource)) return resource;
    return [resource];
  }
  __name(normalizeResource, "normalizeResource");
  for (const component of allComponents) {
    const { css, beforeDOMLoaded, afterDOMLoaded } = component;
    const normalizedCss = normalizeResource(css);
    const normalizedBeforeDOMLoaded = normalizeResource(beforeDOMLoaded);
    const normalizedAfterDOMLoaded = normalizeResource(afterDOMLoaded);
    normalizedCss.forEach((c) => componentResources.css.add(c));
    normalizedBeforeDOMLoaded.forEach((b) => componentResources.beforeDOMLoaded.add(b));
    normalizedAfterDOMLoaded.forEach((a) => componentResources.afterDOMLoaded.add(a));
  }
  return {
    css: [...componentResources.css],
    beforeDOMLoaded: [...componentResources.beforeDOMLoaded],
    afterDOMLoaded: [...componentResources.afterDOMLoaded]
  };
}
__name(getComponentResources, "getComponentResources");
async function joinScripts(scripts) {
  const script = scripts.map((script2) => `(function () {${script2}})();`).join("\n");
  if (script.trim().length === 0) {
    return "";
  }
  try {
    const res = await transpile(script, {
      minify: true
    });
    return res.code;
  } catch (error) {
    if (error instanceof Error) {
      const preview = script.split("\n").map((line, idx) => `${idx + 1}: ${line}`).slice(0, 160).join("\n");
      error.message = `${error.message}
Failed script preview:
${preview}`;
      throw error;
    }
    throw new Error(`Failed to minify component scripts: ${String(error)}`);
  }
}
__name(joinScripts, "joinScripts");
function addGlobalPageResources(ctx, componentResources) {
  const cfg = ctx.cfg.configuration;
  componentResources.beforeDOMLoaded.unshift(`
    window.__quartzCleanupFns = window.__quartzCleanupFns || new Set()
    window.addCleanup = (fn) => {
      window.__quartzCleanupFns.add(fn)
    }
  `);
  if (cfg.enablePopovers) {
    componentResources.afterDOMLoaded.push(popover_inline_default);
    componentResources.css.push(popover_default);
  }
  if (cfg.analytics?.provider === "google") {
    const tagId = cfg.analytics.tagId;
    componentResources.afterDOMLoaded.push(`
      const gtagScript = document.createElement('script');
      gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=${tagId}';
      gtagScript.defer = true;
      gtagScript.onload = () => {
        window.dataLayer = window.dataLayer || [];
        function gtag() {
          dataLayer.push(arguments);
        }
        gtag('js', new Date());
        gtag('config', '${tagId}', { send_page_view: false });
        gtag('event', 'page_view', { page_title: document.title, page_location: location.href });
        document.addEventListener('nav', () => {
          gtag('event', 'page_view', { page_title: document.title, page_location: location.href });
        });
      };
      
      document.head.appendChild(gtagScript);
    `);
  } else if (cfg.analytics?.provider === "plausible") {
    const plausibleHost = cfg.analytics.host ?? "https://plausible.io";
    componentResources.afterDOMLoaded.push(`
      const plausibleScript = document.createElement('script');
      plausibleScript.src = '${plausibleHost}/js/script.manual.js';
      plausibleScript.setAttribute('data-domain', location.hostname);
      plausibleScript.defer = true;
      plausibleScript.onload = () => {
        window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
        plausible('pageview');
        document.addEventListener('nav', () => {
          plausible('pageview');
        });
      };

      document.head.appendChild(plausibleScript);
    `);
  } else if (cfg.analytics?.provider === "umami") {
    componentResources.afterDOMLoaded.push(`
      const umamiScript = document.createElement("script");
      umamiScript.src = "${cfg.analytics.host ?? "https://analytics.umami.is"}/script.js";
      umamiScript.setAttribute("data-website-id", "${cfg.analytics.websiteId}");
      umamiScript.setAttribute("data-auto-track", "true");
      umamiScript.defer = true;

      document.head.appendChild(umamiScript);
    `);
  } else if (cfg.analytics?.provider === "goatcounter") {
    componentResources.afterDOMLoaded.push(`
      const goatcounterScriptPre = document.createElement('script');
      goatcounterScriptPre.textContent = \`
        window.goatcounter = { no_onload: true };
      \`;
      document.head.appendChild(goatcounterScriptPre);

      const endpoint = "https://${cfg.analytics.websiteId}.${cfg.analytics.host ?? "goatcounter.com"}/count";
      const goatcounterScript = document.createElement('script');
      goatcounterScript.src = "${cfg.analytics.scriptSrc ?? "https://gc.zgo.at/count.js"}";
      goatcounterScript.defer = true;
      goatcounterScript.setAttribute('data-goatcounter', endpoint);
      goatcounterScript.onload = () => {
        window.goatcounter.endpoint = endpoint;
        goatcounter.count({ path: location.pathname });
        document.addEventListener('nav', () => {
          goatcounter.count({ path: location.pathname });
        });
      };

      document.head.appendChild(goatcounterScript);
    `);
  } else if (cfg.analytics?.provider === "posthog") {
    componentResources.afterDOMLoaded.push(`
      const posthogScript = document.createElement("script");
      posthogScript.innerHTML= \`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      posthog.init('${cfg.analytics.apiKey}', {
        api_host: '${cfg.analytics.host ?? "https://app.posthog.com"}',
        capture_pageview: false,
      });
      document.addEventListener('nav', () => {
        posthog.capture('$pageview', { path: location.pathname });
      })\`

      document.head.appendChild(posthogScript);
    `);
  } else if (cfg.analytics?.provider === "tinylytics") {
    const siteId = cfg.analytics.siteId;
    componentResources.afterDOMLoaded.push(`
      const tinylyticsScript = document.createElement('script');
      tinylyticsScript.src = 'https://tinylytics.app/embed/${siteId}.js?spa';
      tinylyticsScript.defer = true;
      tinylyticsScript.onload = () => {
        window.tinylytics.triggerUpdate();
        document.addEventListener('nav', () => {
          window.tinylytics.triggerUpdate();
        });
      };
      
      document.head.appendChild(tinylyticsScript);
    `);
  } else if (cfg.analytics?.provider === "cabin") {
    componentResources.afterDOMLoaded.push(`
      const cabinScript = document.createElement("script")
      cabinScript.src = "${cfg.analytics.host ?? "https://scripts.withcabin.com"}/hello.js"
      cabinScript.defer = true
      document.head.appendChild(cabinScript)
    `);
  } else if (cfg.analytics?.provider === "clarity") {
    componentResources.afterDOMLoaded.push(`
      const clarityScript = document.createElement("script")
      clarityScript.innerHTML= \`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.defer=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${cfg.analytics.projectId}");\`
      document.head.appendChild(clarityScript)
    `);
  } else if (cfg.analytics?.provider === "matomo") {
    componentResources.afterDOMLoaded.push(`
      const matomoScript = document.createElement("script");
      matomoScript.innerHTML = \`
      let _paq = window._paq = window._paq || [];

      // Track SPA navigation
      // https://developer.matomo.org/guides/spa-tracking
      document.addEventListener("nav", () => {
        _paq.push(['setCustomUrl', location.pathname]);
        _paq.push(['setDocumentTitle', document.title]);
        _paq.push(['trackPageView']);
      });

      _paq.push(['trackPageView']);
      _paq.push(['enableLinkTracking']);
      (function() {
        const u="//${cfg.analytics.host}/";
        _paq.push(['setTrackerUrl', u+'matomo.php']);
        _paq.push(['setSiteId', ${cfg.analytics.siteId}]);
        const d=document, g=d.createElement('script'), s=d.getElementsByTagName
('script')[0];
        g.type='text/javascript'; g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
      })();
      \`
      document.head.appendChild(matomoScript);
    `);
  } else if (cfg.analytics?.provider === "vercel") {
    componentResources.beforeDOMLoaded.push(`
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    `);
    componentResources.afterDOMLoaded.push(`
      const vercelInsightsScript = document.createElement("script")
      vercelInsightsScript.src = "/_vercel/insights/script.js"
      vercelInsightsScript.defer = true
      document.head.appendChild(vercelInsightsScript)
    `);
  }
  if (cfg.enableSPA) {
    componentResources.afterDOMLoaded.unshift(spa_inline_default);
  } else {
    componentResources.afterDOMLoaded.unshift(`
      window.spaNavigate = (url, _) => window.location.assign(url)
      window.addCleanup = () => {}
      const event = new CustomEvent("nav", { detail: { url: document.body.dataset.slug } })
      document.dispatchEvent(event)
    `);
  }
}
__name(addGlobalPageResources, "addGlobalPageResources");
var ComponentResources = /* @__PURE__ */ __name(() => {
  return {
    name: "ComponentResources",
    async *emit(ctx, _content, _resources) {
      const cfg = ctx.cfg.configuration;
      const componentResources = getComponentResources(ctx);
      let googleFontsStyleSheet = "";
      if (cfg.theme.fontOrigin === "local") {
      } else if (cfg.theme.fontOrigin === "googleFonts" && !cfg.theme.cdnCaching) {
        const theme = ctx.cfg.configuration.theme;
        const response = await fetch(googleFontHref(theme));
        googleFontsStyleSheet = await response.text();
        if (theme.typography.title) {
          const title = ctx.cfg.configuration.pageTitle;
          const response2 = await fetch(googleFontSubsetHref(theme, title));
          googleFontsStyleSheet += `
${await response2.text()}`;
        }
        const { processedStylesheet, fontFiles } = await processGoogleFonts(googleFontsStyleSheet);
        googleFontsStyleSheet = processedStylesheet;
        for (const fontFile of fontFiles) {
          const res = await fetch(fontFile.url);
          if (!res.ok) {
            throw new Error(`Failed to fetch font ${fontFile.filename}`);
          }
          const buf = await res.arrayBuffer();
          yield write({
            ctx,
            slug: joinSegments("static", "fonts", fontFile.filename),
            ext: `.${fontFile.extension}`,
            content: Buffer.from(buf)
          });
        }
      }
      addGlobalPageResources(ctx, componentResources);
      const stylesheet = joinStyles(
        ctx.cfg.configuration.theme,
        googleFontsStyleSheet,
        ...componentResources.css,
        custom_default
      );
      const [prescript, postscript] = await Promise.all([
        joinScripts(componentResources.beforeDOMLoaded),
        joinScripts(componentResources.afterDOMLoaded)
      ]);
      let transformedCss;
      try {
        const result = transform({
          filename: "index.css",
          code: Buffer.from(stylesheet),
          minify: true,
          targets: {
            safari: 15 << 16 | 6 << 8,
            // 15.6
            ios_saf: 15 << 16 | 6 << 8,
            // 15.6
            edge: 115 << 16,
            firefox: 102 << 16,
            chrome: 109 << 16
          },
          include: Features.MediaQueries
        });
        transformedCss = result.code.toString();
      } catch (error) {
        console.error("Failed to transform component stylesheet");
        if (error && typeof error === "object") {
          const message = "message" in error && typeof error.message === "string" ? error.message : "";
          const lineMatch = message.match(/:(\d+):(\d+)/);
          if (lineMatch) {
            const [, lineStr] = lineMatch;
            const lineNumber = Number.parseInt(lineStr, 10);
            if (Number.isFinite(lineNumber)) {
              const lines = stylesheet.split("\n");
              const start = Math.max(0, lineNumber - 5);
              const end = Math.min(lines.length, lineNumber + 4);
              console.error(`Problematic stylesheet lines ${start + 1}-${end}:`);
              for (let i = start; i < end; i++) {
                console.error(`${i + 1}: ${lines[i]}`);
              }
            }
          }
        }
        throw error;
      }
      yield write({
        ctx,
        slug: "index",
        ext: ".css",
        content: transformedCss
      });
      yield write({
        ctx,
        slug: "prescript",
        ext: ".js",
        content: prescript
      });
      yield write({
        ctx,
        slug: "postscript",
        ext: ".js",
        content: postscript
      });
    },
    async *partialEmit() {
    }
  };
}, "ComponentResources");

// quartz/plugins/emitters/404.tsx
var NotFoundPage = /* @__PURE__ */ __name(() => {
  const opts = {
    ...sharedPageComponents,
    pageBody: __default(),
    beforeBody: [],
    left: [],
    right: []
  };
  const { head: Head, pageBody, footer: Footer } = opts;
  const Body2 = Body_default();
  return {
    name: "404Page",
    getQuartzComponents() {
      return [Head, Body2, pageBody, Footer];
    },
    async *emit(ctx, _content, resources) {
      const cfg = ctx.cfg.configuration;
      const slug = "404";
      const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`);
      const path14 = url.pathname;
      const notFound = i18n(cfg.locale).pages.error.title;
      const [tree, vfile] = defaultProcessedContent({
        slug,
        text: notFound,
        description: notFound,
        frontmatter: { title: notFound, tags: [] }
      });
      const externalResources = pageResources(path14, resources);
      const componentData = {
        ctx,
        fileData: vfile.data,
        externalResources,
        cfg,
        children: [],
        tree,
        allFiles: []
      };
      yield write({
        ctx,
        content: renderPage(cfg, slug, componentData, opts, externalResources),
        slug,
        ext: ".html"
      });
    },
    async *partialEmit() {
    }
  };
}, "NotFoundPage");

// theme.colors.json
var theme_colors_default = {
  primaryBackground: "#080001",
  surfaceOverlay: "#1a0507",
  panelDepth: "#240709",
  tonePrimary: "#c48a91",
  toneContrast: "#fbe2e6",
  toneSubtle: "#8c4c52",
  toneMuted: "#b09598",
  accentBright: "#eb1c24",
  accentDeep: "#b71000",
  accentShadow: "#610700",
  accentShadowLight: "#7a0600",
  highlightOverlay: "rgba(235, 28, 36, 0.18)",
  link: "#ff5860",
  buttonText: "#fff7f8",
  textHighlight: "#ff3a4066",
  feedbackSuccess: "#7de49a",
  feedbackError: "#ff8a8a",
  fonts: {
    oracleLabel: "VCR OSD Mono"
  }
};

// quartz.config.ts
var moduleDirectory = path12.dirname(fileURLToPath(import.meta.url));
var cwd = process.cwd();
var envCandidates = [
  path12.resolve(moduleDirectory, "../.env"),
  path12.resolve(moduleDirectory, ".env"),
  path12.resolve(cwd, "../.env"),
  path12.resolve(cwd, ".env")
];
for (const candidate of envCandidates) {
  dotenv.config({ path: candidate, override: false });
}
var previewSecret = /* @__PURE__ */ __name((value) => {
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}, "previewSecret");
if (process.env.NODE_ENV !== "production") {
  console.info("[quartz] Oracle env", {
    cwd,
    moduleDirectory,
    candidates: envCandidates,
    proxyBaseUrl: process.env.ORACLE_PROXY_BASE_URL ?? null,
    hasRecaptchaSiteKey: Boolean(process.env.ORACLE_RECAPTCHA_SITE_KEY),
    recaptchaSiteKeyPreview: previewSecret(process.env.ORACLE_RECAPTCHA_SITE_KEY)
  });
}
var palette = theme_colors_default;
var sharedCssVars = {
  "color-primary-background": palette.primaryBackground,
  "color-surface-overlay": palette.surfaceOverlay,
  "color-panel-depth": palette.panelDepth,
  "color-tone-primary": palette.tonePrimary,
  "color-tone-contrast": palette.toneContrast,
  "color-tone-subtle": palette.toneSubtle,
  "color-tone-muted": palette.toneMuted,
  "color-accent-bright": palette.accentBright,
  "color-accent-deep": palette.accentDeep,
  "color-accent-shadow": palette.accentShadow,
  "color-accent-shadow-light": palette.accentShadowLight,
  "color-highlight-overlay": palette.highlightOverlay,
  "color-link": palette.link,
  "color-button-text": palette.buttonText,
  "color-button-background": palette.accentDeep,
  "color-button-hover": palette.accentBright,
  "color-scrollbar-thumb": palette.accentBright,
  "color-scrollbar-track": palette.surfaceOverlay,
  "color-feedback-success": palette.feedbackSuccess,
  "color-feedback-error": palette.feedbackError
};
var sharedColorScheme = {
  light: palette.primaryBackground,
  lightgray: palette.surfaceOverlay,
  gray: palette.panelDepth,
  darkgray: palette.toneContrast,
  dark: palette.tonePrimary,
  secondary: palette.accentBright,
  tertiary: palette.accentDeep,
  highlight: palette.highlightOverlay,
  textHighlight: palette.textHighlight
};
var config2 = {
  configuration: {
    pageTitle: "710 Tone Sleuth Wiki",
    pageTitleSuffix: " - 7/10 Wiki",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "710tone.wiki",
    ignorePatterns: [
      "private",
      "templates",
      ".obsidian",
      "Content/.obsidian",
      "Content/.obsidian/**",
      "quartz-site",
      "quartz-site/**",
      "node_modules",
      "node_modules/**",
      "public",
      "public/**",
      ".git",
      ".git/**",
      ".github",
      ".github/**"
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "local",
      cdnCaching: false,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono"
      },
      colors: {
        lightMode: {
          ...sharedColorScheme,
          cssVars: {
            ...sharedCssVars
          }
        },
        darkMode: {
          ...sharedColorScheme,
          cssVars: {
            ...sharedCssVars
          }
        }
      }
    },
    oracleChat: {
      enabled: true,
      apiBaseUrl: process.env.ORACLE_PROXY_BASE_URL ?? "",
      endpointPath: "/api/oracle/query",
      recaptchaSiteKey: process.env.ORACLE_RECAPTCHA_SITE_KEY ?? "",
      storageKey: "oracle-chat-history",
      maxHistory: 24,
      contextStreamPath: "/api/oracle/context-stream"
    }
  },
  plugins: {
    transformers: [
      FrontMatter(),
      CreatedModifiedDate({
        priority: ["frontmatter", "git"]
      }),
      SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark"
        },
        keepBackground: false
      }),
      ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      GitHubFlavoredMarkdown(),
      InfoboxBlock(),
      MediaBox(),
      DiscordMessages(),
      YouTubeCommunityPosts(),
      TableOfContents({
        collapseByDefault: true
      }),
      CrawlLinks({ markdownLinkResolution: "shortest" }),
      Description(),
      Latex({ renderEngine: "katex" }),
      HardLineBreaks()
    ],
    filters: [RemoveDrafts()],
    emitters: [
      AliasRedirects(),
      ComponentResources(),
      ContentPage(),
      FolderPage(),
      TagPage(),
      ContentIndex({
        enableSiteMap: true,
        enableRSS: true
      }),
      Assets(),
      Static(),
      Favicon(),
      NotFoundPage()
      // Custom OG image generation is expensive; leave it disabled for faster builds.
      // Plugin.CustomOgImages(),
    ]
  }
};
var quartz_config_default = config2;

// quartz/processors/parse.ts
import esbuild from "esbuild";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// quartz/util/perf.ts
import pretty from "pretty-time";
import { styleText as styleText3 } from "util";
var PerfTimer = class {
  static {
    __name(this, "PerfTimer");
  }
  evts;
  constructor() {
    this.evts = {};
    this.addEvent("start");
  }
  addEvent(evtName) {
    this.evts[evtName] = process.hrtime();
  }
  timeSince(evtName) {
    return styleText3("yellow", pretty(process.hrtime(this.evts[evtName ?? "start"])));
  }
};

// quartz/processors/parse.ts
import { read } from "to-vfile";
import path13 from "path";
import workerpool from "workerpool";

// quartz/util/log.ts
import truncate from "ansi-truncate";

// quartz/processors/parse.ts
function createMdProcessor(ctx) {
  const transformers = ctx.cfg.plugins.transformers;
  return unified().use(remarkParse).use(
    transformers.flatMap((plugin) => plugin.markdownPlugins?.(ctx) ?? [])
  );
}
__name(createMdProcessor, "createMdProcessor");
function createHtmlProcessor(ctx) {
  const transformers = ctx.cfg.plugins.transformers;
  return unified().use(remarkRehype, { allowDangerousHtml: true }).use(transformers.flatMap((plugin) => plugin.htmlPlugins?.(ctx) ?? []));
}
__name(createHtmlProcessor, "createHtmlProcessor");
function createFileParser(ctx, fps) {
  const { argv, cfg } = ctx;
  return async (processor) => {
    const res = [];
    for (const fp of fps) {
      try {
        const perf = new PerfTimer();
        const file = await read(fp);
        file.value = file.value.toString().trim();
        for (const plugin of cfg.plugins.transformers.filter((p) => p.textTransform)) {
          file.value = plugin.textTransform(ctx, file.value.toString());
        }
        file.data.filePath = file.path;
        file.data.relativePath = path13.posix.relative(argv.directory, file.path);
        file.data.slug = slugifyFilePath(file.data.relativePath);
        const ast = processor.parse(file);
        const newAst = await processor.run(ast, file);
        res.push([newAst, file]);
        if (argv.verbose) {
          console.log(`[markdown] ${fp} -> ${file.data.slug} (${perf.timeSince()})`);
        }
      } catch (err) {
        trace(`
Failed to process markdown \`${fp}\``, err);
      }
    }
    return res;
  };
}
__name(createFileParser, "createFileParser");
function createMarkdownParser(ctx, mdContent) {
  return async (processor) => {
    const res = [];
    for (const [ast, file] of mdContent) {
      try {
        const perf = new PerfTimer();
        const newAst = await processor.run(ast, file);
        res.push([newAst, file]);
        if (ctx.argv.verbose) {
          console.log(`[html] ${file.data.slug} (${perf.timeSince()})`);
        }
      } catch (err) {
        trace(`
Failed to process html \`${file.data.filePath}\``, err);
      }
    }
    return res;
  };
}
__name(createMarkdownParser, "createMarkdownParser");

// quartz/util/sourcemap.ts
import fs6 from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
var options = {
  // source map hack to get around query param
  // import cache busting
  retrieveSourceMap(source) {
    if (source.includes(".quartz-cache")) {
      let realSource = fileURLToPath2(source.split("?", 2)[0] + ".map");
      return {
        map: fs6.readFileSync(realSource, "utf8")
      };
    } else {
      return null;
    }
  }
};

// quartz/worker.ts
sourceMapSupport.install(options);
async function parseMarkdown(partialCtx, fps) {
  const ctx = {
    ...partialCtx,
    cfg: quartz_config_default
  };
  return await createFileParser(ctx, fps)(createMdProcessor(ctx));
}
__name(parseMarkdown, "parseMarkdown");
function processHtml(partialCtx, mds) {
  const ctx = {
    ...partialCtx,
    cfg: quartz_config_default
  };
  return createMarkdownParser(ctx, mds)(createHtmlProcessor(ctx));
}
__name(processHtml, "processHtml");
export {
  parseMarkdown,
  processHtml
};
//# sourceMappingURL=transpiled-worker.mjs.map
