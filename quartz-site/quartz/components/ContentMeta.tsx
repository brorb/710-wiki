import { Date, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import style from "./styles/contentMeta.scss"

export default (() => {
  const ContentMetadata = ({ cfg, fileData, displayClass }: QuartzComponentProps) => {
    if (!fileData.dates) {
      return null
    }

    const updatedDate = getDate(cfg, fileData)
    if (!updatedDate) {
      return null
    }

    return (
      <div class={classNames(displayClass, "content-meta")}>
        <span class="content-meta__label">Updated</span>
        <Date date={updatedDate} locale={cfg.locale} />
      </div>
    )
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
