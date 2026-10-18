/**
 * Resolves the stored preference ([data-theme-pref], rendered by
 * app/layout.tsx from the cookie) into the concrete [data-theme] the CSS
 * keys off, before first paint, and re-resolves whenever the OS theme
 * changes. [data-theme] is deliberately never rendered by React: when it
 * was, any layout re-render in "system" mode (e.g. after a server action)
 * stripped it and the app fell back to light regardless of the OS.
 */
export function ThemeScript() {
  const script = `
(function() {
  try {
    var root = document.documentElement;
    var mql = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      var pref = root.getAttribute("data-theme-pref");
      root.setAttribute("data-theme", pref === "light" || pref === "dark" ? pref : mql.matches ? "dark" : "light");
    }
    apply();
    mql.addEventListener("change", apply);
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
