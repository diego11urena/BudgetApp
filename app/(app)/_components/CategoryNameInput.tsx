/**
 * A plain name input with a native <datalist> of existing category names.
 * Category creation elsewhere upserts by exact-name match, so a near-miss
 * (extra space, different case) silently creates a second, separate
 * category — this autocomplete nudges reuse of the exact existing name
 * without adding client-state complexity (it's a standard HTML mechanism).
 */
export function CategoryNameInput({
  id,
  name,
  categoryNames,
  defaultValue,
  placeholder,
  required = true,
}: {
  id: string;
  name: string;
  categoryNames: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const listId = `${id}-list`;

  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        list={listId}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      <datalist id={listId}>
        {categoryNames.map((categoryName) => (
          <option key={categoryName} value={categoryName} />
        ))}
      </datalist>
    </>
  );
}
