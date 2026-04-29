/**
 * Helpers pour générer des liens wa.me préfilés.
 *
 * Format du message attendu côté webhook : `@<pseudo>: <code>`
 * (la regex serveur tolère aussi sans `@` et avec espace au lieu de `:`).
 */

/**
 * Lien `wa.me` ouvrant WhatsApp avec un message préfilé.
 *
 * @param whatsappNumber  Numéro JokkoLive E.164 (avec ou sans `+`).
 * @param pseudo          Pseudo du vendeur (sans `@`).
 * @param code            Code produit (ex: "R1") ou `undefined` pour un lien
 *                        boutique générique (l'acheteur tape son code lui-même).
 */
export function buildWhatsappLink(
  whatsappNumber: string,
  pseudo: string,
  code?: string,
): string {
  const digits = whatsappNumber.replace(/[^0-9]/g, '');
  const text = code ? `@${pseudo}: ${code}` : `@${pseudo}: `;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
