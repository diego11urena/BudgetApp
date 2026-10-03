import type { ReactNode } from "react";

/**
 * The design system's money input: a bordered field with a faint "$"
 * (or "~$") prefix and a Manrope tabular value. Wraps whatever input it
 * is given -- normally a CurrencyInput -- so the border, radius and focus
 * ring belong to the whole field rather than to the bare <input>.
 */
export function MoneyField({
  prefix = "$",
  size = "md",
  className = "",
  children,
}: {
  prefix?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`money-field money-field--${size} ${className}`.trim()}>
      <span className="money-field-prefix" aria-hidden="true">
        {prefix}
      </span>
      {children}
    </div>
  );
}
