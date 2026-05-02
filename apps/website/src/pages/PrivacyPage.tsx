import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

/**
 * Politique de confidentialité publique — accessible sans authentification.
 * URL exigée par Meta lors de la création d'une app WhatsApp Business API
 * et par DiamanoPay pour la conformité.
 *
 * Adaptée au RGPD (acheteurs UE possibles) et à la loi sénégalaise n°2008-12
 * sur la protection des données personnelles.
 */
export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/terms"
            className="text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Conditions d'utilisation
          </Link>
        </header>

        <article className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-card sm:px-10 sm:py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Politique de confidentialité
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Dernière mise à jour : 28 avril 2026
          </p>

          <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700">
            <section>
              <p>
                JokkoLive (« nous », « la plateforme ») est un service de prise
                de commande sur WhatsApp à destination des vendeurs en
                live-streaming et de leurs clients, principalement au Sénégal.
                La présente politique décrit comment nous collectons, utilisons
                et protégeons vos données personnelles.
              </p>
            </section>

            <Section title="1. Responsable du traitement">
              <p>
                Le responsable du traitement est JokkoLive, joignable à
                l'adresse :{' '}
                <a
                  href="mailto:contact@jokkolive.com"
                  className="text-emerald-700 underline-offset-2 hover:underline"
                >
                  contact@jokkolive.com
                </a>
                .
              </p>
            </Section>

            <Section title="2. Données que nous collectons">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Vendeurs :</strong> numéro WhatsApp, pseudonyme, nom
                  affiché, devise par défaut, comptes mobile money (Wave /
                  Orange Money) configurés pour les retraits.
                </li>
                <li>
                  <strong>Acheteurs :</strong> numéro WhatsApp transmis par
                  WhatsApp lors de l'envoi d'une commande, nom public WhatsApp
                  si fourni, contenu du message de commande, méthode de
                  paiement choisie.
                </li>
                <li>
                  <strong>Transactions :</strong> montant, devise, date,
                  référence interne (ex : <code>JK-A3F2K7</code>), statut du
                  paiement, identifiants techniques renvoyés par notre
                  prestataire de paiement.
                </li>
                <li>
                  <strong>Données techniques :</strong> journaux serveur
                  (adresse IP, horodatage des requêtes API) conservés à des
                  fins de sécurité et de débogage.
                </li>
              </ul>
            </Section>

            <Section title="3. Finalités du traitement">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Permettre l'enregistrement d'une commande lorsqu'un acheteur
                  écrit <code>@pseudo:CODE</code> sur WhatsApp.
                </li>
                <li>
                  Générer un lien de paiement et router le règlement vers le
                  vendeur via Wave ou Orange Money.
                </li>
                <li>
                  Notifier le vendeur et l'acheteur des étapes de la commande
                  par WhatsApp.
                </li>
                <li>
                  Tenir un registre comptable des paiements, frais plateforme
                  et retraits (obligation légale).
                </li>
                <li>
                  Assurer la sécurité de la plateforme (détection de fraude,
                  prévention des abus).
                </li>
              </ul>
            </Section>

            <Section title="4. Bases légales">
              <p>
                Le traitement repose sur :
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>L'exécution d'un contrat</strong> entre l'acheteur,
                  le vendeur et la plateforme pour le traitement des
                  commandes.
                </li>
                <li>
                  <strong>Une obligation légale</strong> pour la conservation
                  des écritures comptables.
                </li>
                <li>
                  <strong>L'intérêt légitime</strong> de la plateforme à
                  prévenir la fraude et à améliorer le service.
                </li>
              </ul>
            </Section>

            <Section title="5. Destinataires et sous-traitants">
              <p>
                Nous transmettons certaines données à des prestataires
                strictement nécessaires au fonctionnement du service :
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Meta (WhatsApp)</strong> — transmission des messages
                  entre acheteurs, vendeurs et plateforme.
                </li>
                <li>
                  <strong>DiamanoPay</strong> — traitement des paiements et
                  versements vers les comptes mobile money (Wave, Orange
                  Money).
                </li>
                <li>
                  <strong>Hébergeur</strong> — stockage des données sur des
                  serveurs sécurisés.
                </li>
              </ul>
              <p className="mt-3">
                Nous ne vendons jamais vos données à des tiers.
              </p>
            </Section>

            <Section title="6. Durées de conservation">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Comptes vendeurs : conservés tant que le compte est actif,
                  puis 12 mois après inactivité.
                </li>
                <li>
                  Données de commandes et paiements : 10 ans (obligation
                  comptable).
                </li>
                <li>
                  Journaux techniques : 90 jours.
                </li>
                <li>
                  Codes OTP : supprimés après usage ou 5 minutes.
                </li>
              </ul>
            </Section>

            <Section title="7. Vos droits">
              <p>
                Conformément au RGPD (acheteurs/vendeurs UE) et à la loi
                sénégalaise n°2008-12, vous disposez d'un droit d'accès, de
                rectification, d'effacement, de limitation, d'opposition et de
                portabilité de vos données. Vous pouvez exercer ces droits en
                écrivant à{' '}
                <a
                  href="mailto:contact@jokkolive.com"
                  className="text-emerald-700 underline-offset-2 hover:underline"
                >
                  contact@jokkolive.com
                </a>
                . Nous répondons sous 30 jours.
              </p>
              <p className="mt-3">
                Vous pouvez également déposer une réclamation auprès de la
                Commission de Protection des Données Personnelles du Sénégal
                (CDP) ou, pour les résidents de l'Union européenne, auprès de
                l'autorité de contrôle de votre pays.
              </p>
            </Section>

            <Section title="8. Sécurité">
              <p>
                Les communications avec la plateforme sont chiffrées en HTTPS.
                Les mots de passe ne sont pas stockés (authentification par
                code à usage unique sur WhatsApp). Les jetons API et secrets
                sont conservés en variables d'environnement isolées. Nos
                serveurs sont protégés par pare-feu et accès restreint.
              </p>
            </Section>

            <Section title="9. Cookies et traceurs">
              <p>
                La plateforme n'utilise aucun cookie publicitaire ni traceur
                tiers. Un seul jeton de session est stocké localement dans
                votre navigateur pour vous maintenir connecté en tant que
                vendeur.
              </p>
            </Section>

            <Section title="10. Modifications">
              <p>
                Nous pouvons modifier cette politique à tout moment. La date
                de dernière mise à jour figure en haut de la page. En cas de
                modification substantielle, vous serez notifié par WhatsApp ou
                email.
              </p>
            </Section>

            <Section title="11. Contact">
              <p>
                Pour toute question relative à vos données personnelles :{' '}
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
