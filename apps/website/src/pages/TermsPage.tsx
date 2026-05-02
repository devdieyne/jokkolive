import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

/**
 * Conditions générales d'utilisation publiques.
 * Souvent demandées par Meta en parallèle de la politique de confidentialité.
 */
export function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/privacy"
            className="text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Politique de confidentialité
          </Link>
        </header>

        <article className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-card sm:px-10 sm:py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Conditions d'utilisation
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Dernière mise à jour : 28 avril 2026
          </p>

          <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700">
            <Section title="1. Objet">
              <p>
                JokkoLive est une plateforme de prise de commande sur WhatsApp
                pour les vendeurs en live-streaming. Les présentes conditions
                régissent l'utilisation du service par les vendeurs et les
                acheteurs.
              </p>
            </Section>

            <Section title="2. Inscription des vendeurs">
              <p>
                Pour utiliser JokkoLive en tant que vendeur, vous devez
                disposer d'un numéro WhatsApp valide et d'un compte mobile
                money (Wave ou Orange Money). Vous garantissez l'exactitude
                des informations fournies. Un seul compte vendeur par numéro
                est autorisé.
              </p>
            </Section>

            <Section title="3. Fonctionnement des commandes">
              <p>
                L'acheteur écrit sur WhatsApp un message au format{' '}
                <code>@pseudo:CODE</code> au numéro JokkoLive. La plateforme
                crée une commande, génère un lien de paiement valide 24
                heures, et notifie le vendeur. Une fois le paiement reçu, le
                vendeur est crédité sur sa balance interne et peut effectuer
                un retrait à tout moment.
              </p>
            </Section>

            <Section title="4. Frais de plateforme">
              <p>
                JokkoLive prélève des frais de service de{' '}
                <strong>50 FCFA + 2 %</strong> sur chaque paiement reçu. Ces
                frais sont retenus automatiquement avant le crédit en balance
                vendeur. Aucun frais n'est appliqué sur les retraits, hors
                frais éventuellement pratiqués par l'opérateur mobile money.
              </p>
            </Section>

            <Section title="5. Obligations des vendeurs">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Ne proposer à la vente que des produits ou services
                  conformes à la loi en vigueur au Sénégal et dans le pays de
                  l'acheteur.
                </li>
                <li>
                  Honorer les commandes reçues et payées dans un délai
                  raisonnable.
                </li>
                <li>
                  Répondre aux demandes des acheteurs concernant leurs
                  commandes.
                </li>
                <li>
                  Ne pas utiliser la plateforme pour des activités frauduleuses
                  ou illégales (blanchiment, contrefaçon, vente de produits
                  prohibés, etc.).
                </li>
              </ul>
            </Section>

            <Section title="6. Retraits">
              <p>
                Les vendeurs peuvent retirer le solde disponible de leur
                balance à tout moment, vers le compte mobile money configuré.
                Les retraits sont synchrones : la confirmation ou l'échec est
                immédiat. En cas d'échec côté opérateur, le solde est restitué
                automatiquement à la balance disponible.
              </p>
            </Section>

            <Section title="7. Suspension et résiliation">
              <p>
                Nous pouvons suspendre ou résilier un compte en cas de
                violation des présentes conditions, de fraude avérée ou de
                demande d'une autorité compétente. Les soldes en attente
                restent dus au vendeur sauf décision judiciaire contraire.
              </p>
            </Section>

            <Section title="8. Limitation de responsabilité">
              <p>
                JokkoLive est un intermédiaire technique entre vendeurs et
                acheteurs. Nous ne sommes pas partie au contrat de vente
                lui-même. Notre responsabilité ne saurait être engagée pour
                les litiges relatifs à la qualité des produits, aux délais de
                livraison ou aux différends commerciaux entre l'acheteur et le
                vendeur.
              </p>
              <p className="mt-3">
                Nous nous efforçons d'assurer la disponibilité du service mais
                ne garantissons pas son fonctionnement ininterrompu. Aucune
                responsabilité ne peut être engagée pour des interruptions
                ponctuelles dues à la maintenance ou à des facteurs externes
                (panne WhatsApp, opérateur mobile money, etc.).
              </p>
            </Section>

            <Section title="9. Propriété intellectuelle">
              <p>
                La marque, le logo et les contenus de la plateforme sont la
                propriété exclusive de JokkoLive. Toute reproduction sans
                autorisation est interdite.
              </p>
            </Section>

            <Section title="10. Droit applicable et juridiction">
              <p>
                Les présentes conditions sont régies par le droit sénégalais.
                Tout litige sera soumis à la compétence exclusive des
                tribunaux de Dakar, sauf disposition contraire applicable au
                consommateur.
              </p>
            </Section>

            <Section title="11. Contact">
              <p>
                Pour toute question :{' '}
                <a
                  href="mailto:contact@jokkolive.com"
                  className="text-emerald-700 underline-offset-2 hover:underline"
                >
                  contact@jokkolive.com
                </a>
                .
              </p>
            </Section>
          </div>

          <footer className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-700 hover:underline">
              Retour à l'accueil
            </Link>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
