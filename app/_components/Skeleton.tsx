type SkeletonHeight = "bar" | "xs" | "sm" | "md" | "lg" | "xl" | "xl2" | "2xl" | "3xl";
type SkeletonWidth = 40 | 50 | 55 | 60 | 70 | 75 | 80 | 85 | 90 | 100;

const HEIGHT_CLASS: Record<SkeletonHeight, string> = {
  bar: "skeleton-h-bar",
  xs: "skeleton-h-xs",
  sm: "skeleton-h-sm",
  md: "skeleton-h-md",
  lg: "skeleton-h-lg",
  xl: "skeleton-h-xl",
  xl2: "skeleton-h-xl2",
  "2xl": "skeleton-h-2xl",
  "3xl": "skeleton-h-3xl",
};

/**
 * One shimmering placeholder block -- shared by every route's own
 * loading.tsx (previously ~30 one-off `style={{ height, width }}` objects
 * across 8 files). `h`/`w` are the app's own fixed skeleton scale rather
 * than arbitrary values, and `title` is the route-title shape (height +
 * width + spacing already baked in) every loading.tsx starts with.
 */
export function Skeleton({
  h,
  w,
  title,
  gap,
  mt,
  className = "",
}: {
  /** One of the app's fixed skeleton heights -- omit for the default ~1rem text-line height. */
  h?: SkeletonHeight;
  /** One of the app's fixed skeleton widths -- omit for a full-width block. */
  w?: SkeletonWidth;
  /** The route-title placeholder shape. */
  title?: boolean;
  /** Extra spacing below this block, for a composition that needs more than the default gap between blocks. "lg" for the rare case (onboarding's own top bar) that needs even more. */
  gap?: boolean | "lg";
  /** Extra spacing above this block. */
  mt?: boolean;
  className?: string;
}) {
  const classes = [
    "skeleton-block",
    title ? "skeleton-block--title" : "",
    h ? HEIGHT_CLASS[h] : "",
    w ? `skeleton-w-${w}` : "",
    gap === "lg" ? "skeleton-block--gap-lg" : gap ? "skeleton-block--gap" : "",
    mt ? "skeleton-block--mt" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes} />;
}
