// Rendered in <head> ONLY when the request carried no theme cookie (the
// undecided state). It stamps `data-theme` from the OS `prefers-color-scheme`
// before first paint, so an anonymous / staff visitor gets their OS theme with
// no flash. When a cookie exists the server sets `data-theme` directly and this
// script is not emitted. A CSS `@media` fallback in globals.css covers no-JS.
const THEME_INIT_JS = `(function(){try{var d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_JS }} />
}
