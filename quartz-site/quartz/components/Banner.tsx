import { QuartzComponent, QuartzComponentConstructor } from "./types"

const Banner: QuartzComponent = () => {
  return (
    <div class="site-banner">
      <img src="/static/branding/banner.png" alt="7/10 Tone Wiki banner" loading="lazy" />
    </div>
  )
}

Banner.css = `
.site-banner {
  width: 100%;
  margin: 0 auto;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(255, 40, 79, 0.35);
  box-shadow: 0 18px 48px rgba(4, 0, 2, 0.55);
  background: rgba(7, 0, 2, 0.85);
  position: relative;
  z-index: 1;
}

.site-banner img {
  display: block;
  width: 100%;
  height: auto;
}
`

export default (() => Banner) satisfies QuartzComponentConstructor
