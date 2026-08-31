/**
 * Resolves "system" to a concrete light/dark value on the client (the
 * server can't know the OS preference at render time) and keeps it live
 * if the OS theme changes while the tab is open. Runs as an inline,
 * synchronous script -- not a React effect -- so it executes before first
 * paint and never causes a flash of the wrong theme. The explicit
 * light/dark case is already handled server-side (see app/layout.tsx,
 * which reads the same cookie to set the initial [data-theme] attribute
 * directly), so this script only needs to act when the attribute is
 * still unset (the "system" case).
 */
export function ThemeScript() {
  const script = `
(function() {
  try {
    var root = document.documentElement;
    if (root.getAttribute("data-theme")) return;
    var mql = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      root.setAttribute("data-theme", mql.matches ? "dark" : "light");
    }
    apply();
    mql.addEventListener("change", apply);
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
