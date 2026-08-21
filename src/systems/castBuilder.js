/**
 * Cast assembly. CLAUDE.md section 1b.
 *
 * Any five cards must be able to form a coherent X, so group roles are resolved
 * at run start rather than fixed on the card. Leader and maknae come from
 * birthdays unless a card explicitly prefers otherwise; the rest are filled from
 * each card's preferredRoles without duplicates.
 *
 * Deterministic: same five cards always produce the same lineup.
 */

export const ROLES = [
  'leader',
  'maknae',
  'visual',
  'main_vocalist',
  'lead_vocalist',
  'sub_vocalist',
  'main_dancer',
  'lead_dancer',
  'main_rapper',
  'lead_rapper',
  'sub_rapper',
];

/** Roles every lineup should fill if the cards allow it. */
const CORE_ROLES = ['leader', 'maknae', 'visual', 'main_vocalist', 'main_dancer'];

function byAge(cards) {
  return [...cards].sort((a, b) => a.birthday.localeCompare(b.birthday));
}

/**
 * @param {Array} cards - the five chosen character cards
 * @returns {{ [id]: string[] }} resolved roles per member, in display order
 */
export function buildLineup(cards) {
  if (cards.length === 0) return {};

  const aged = byAge(cards);
  const assigned = Object.fromEntries(cards.map((c) => [c.id, []]));
  const taken = new Set();

  const give = (id, role) => {
    if (taken.has(role)) return false;
    taken.add(role);
    assigned[id].push(role);
    return true;
  };

  // Leader: whoever asks for it, otherwise the oldest.
  const wantsLeader = cards.find((c) => c.preferredRoles?.includes('leader'));
  give((wantsLeader ?? aged[0]).id, 'leader');

  // Maknae is a fact about birthdays, not a preference - youngest always.
  const youngest = aged[aged.length - 1];
  if (!assigned[youngest.id].includes('leader')) give(youngest.id, 'maknae');

  // Remaining preferences, in card order so the result is stable.
  for (const card of cards) {
    for (const role of card.preferredRoles ?? []) {
      if (assigned[card.id].length >= 2) break;
      if (ROLES.includes(role)) give(card.id, role);
    }
  }

  // Anyone still empty picks up an unclaimed core role, then anything left.
  for (const card of cards) {
    if (assigned[card.id].length > 0) continue;
    const spare =
      CORE_ROLES.find((r) => !taken.has(r)) ?? ROLES.find((r) => !taken.has(r));
    if (spare) give(card.id, spare);
  }

  return assigned;
}

/** Convenience for prompt block 1 and the roster line in block 4. */
export function describeLineup(cards, lineup) {
  return cards.map((c) => ({
    id: c.id,
    name: c.name,
    roles: lineup[c.id] ?? [],
  }));
}
