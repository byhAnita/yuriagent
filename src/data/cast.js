/**
 * Card loader. CLAUDE.md sections 1b and 12.
 *
 * Every card in data/characters/ is part of the LIBRARY. Only MVP_CAST is in
 * the current playthrough. The picker in v1 will choose any five from the
 * library; nothing else in the codebase should assume a fixed cast.
 */

const modules = import.meta.glob('./characters/*.json', { eager: true });

export const LIBRARY = Object.fromEntries(
  Object.values(modules)
    .map((m) => m.default ?? m)
    .map((card) => [card.id, card]),
);

/** The five members of X for the MVP playthrough. */
export const MVP_CAST = ['irene', 'nana', 'jisoo', 'hyewon', 'yeri'];

export function getCard(id) {
  const card = LIBRARY[id];
  if (!card) throw new Error(`Unknown character card: ${id}`);
  return card;
}

export function getCast(ids = MVP_CAST) {
  return ids.map(getCard);
}

/**
 * `origin` is library metadata for the card picker and must never reach a
 * prompt - in fiction every member debuted in X (CLAUDE.md section 1b).
 * promptBuilder.js uses this to strip the card down before injection.
 */
export const PROMPT_EXCLUDED_FIELDS = ['origin', 'schema', 'portraits', 'portraitMode', 'ig'];
