import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/mediaNormalizer.inline"

const MediaNormalizer: QuartzComponent = () => <></>

MediaNormalizer.afterDOMLoaded = script

export default (() => MediaNormalizer) satisfies QuartzComponentConstructor
