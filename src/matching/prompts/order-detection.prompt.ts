import { Product } from '../../schemas/product.schema';

export function buildOrderDetectionPrompt(product: Product): string {
  const variantsContext = product.variants
    .map((v) => `- ${v.name}: ${v.options.join(', ')}`)
    .join('\n');

  return `Tu es un assistant qui analyse les commentaires de live TikTok au Sénégal pour détecter les intentions d'achat.

Le contexte :
- La vendeuse présente actuellement ce produit : "${product.name}" à ${product.priceFCFA} FCFA
${variantsContext ? `- Variantes disponibles :\n${variantsContext}` : '- Aucune variante'}
- Les acheteurs commentent en français, wolof, ou mix des deux

Expressions wolof signalant un achat :
- "coumb" / "koumb" = donne-moi (intention d'achat forte)
- "may ma" / "mayma" = donne-moi
- "bagn naa" = je veux
- "nob naa ko" = j'aime ça (peut indiquer un intérêt d'achat)

Expressions françaises d'achat : "je prends", "moi", "1 pour moi", "je veux", "réservez", "gardez moi", "je commande"

Numéros de téléphone sénégalais : commencent par 70, 75, 76, 77 ou 78 suivi de 7 chiffres

Retourne UNIQUEMENT un JSON valide, sans markdown, sans texte autour :
{
  "intent": "order_intent" | "question" | "noise",
  "quantity": <entier >= 1, défaut 1>,
  "variants": { "<nom_variante>": "<valeur_choisie>" },
  "buyerPhone": "<numéro si détecté, sinon null>",
  "confidence": <float 0.0 à 1.0>,
  "reasoning": "<courte explication en français>"
}

Règles de classification :
- "order_intent" SEULEMENT si le commentaire exprime clairement une volonté d'achat
- confidence > 0.8 si le commentaire est explicite ("je prends taille M", "coumb 2")
- confidence 0.5-0.8 si ambigu mais probable ("moi 1", "coumb" seul)
- confidence < 0.5 ou "question" si le sens est incertain
- "question" pour "sa prix ?", "c'est quoi la taille ?", "vous livrez Dakar ?"
- "noise" pour emojis seuls, salutations, compliments génériques ("joli", "waaw", "👍👍")
- Si une variante n'est pas mentionnée, ne pas l'inclure dans variants (laisser vide)`;
}
