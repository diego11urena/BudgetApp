export interface DuplicateCandidate {
  id: string;
  name: string;
}

export interface DuplicatePair {
  a: DuplicateCandidate;
  b: DuplicateCandidate;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** "Gift"/"Gifts", "Restaurant"/"Restaurants" -- a simple case-insensitive plural relationship. */
function isSimplePlural(x: string, y: string): boolean {
  return x === `${y}s` || x === `${y}es` || y === `${x}s` || y === `${x}es`;
}

/**
 * "Gas"/"Gasoline" -- the shorter name is a prefix of the longer one.
 * Bounded on both ends: the shorter side needs at least 3 characters (so
 * e.g. a lone "A" category doesn't prefix-match half the list), and the
 * length gap is capped so wildly different-length names that happen to
 * share a short prefix aren't flagged.
 */
function isShortPrefixOf(x: string, y: string): boolean {
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  if (shorter.length < 3) return false;
  if (longer.length - shorter.length > 6) return false;
  return longer.startsWith(shorter);
}

/**
 * Flags category names that are probably the same thing spelled two ways
 * ("Gift"/"Gifts", "Gas"/"Gasoline") so they can fragment spending
 * analytics if left separate -- this NEVER merges anything itself, it only
 * surfaces a suggestion for the user to review (see CategoryCleanupSection
 * / MergeCategorySheet). Callers are expected to pre-filter to a single
 * category type -- an Expense "Gift" and an Income "Gift" existing
 * separately isn't a duplicate, it's two intentionally distinct rows.
 */
export function findPossibleDuplicates(categories: DuplicateCandidate[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const a = categories[i];
      const b = categories[j];
      const [na, nb] = [normalize(a.name), normalize(b.name)];
      if (na === nb) continue;
      if (isSimplePlural(na, nb) || isShortPrefixOf(na, nb)) {
        pairs.push({ a, b });
      }
    }
  }
  return pairs;
}
