import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Package,
  Receipt,
  Smartphone,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Container } from '../components/Container';
import { Button } from '../components/Button';

const DASHBOARD_URL = 'https://app.jokkolive.com';

export function LandingPage() {
  return (
    <div className="bg-white">
      <Header />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle radial gradient bg */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(80% 50% at 50% 0%, rgb(16 185 129 / 0.08) 0%, transparent 60%)',
        }}
      />
      <Container>
        <div className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16 lg:py-32">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Made in Sénégal 🇸🇳
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Vendez sur WhatsApp{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                depuis vos lives TikTok
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Transformez vos lives en commandes WhatsApp et encaissez avec
              <span className="font-medium text-slate-900"> Wave </span>
              ou
              <span className="font-medium text-slate-900"> Orange Money</span>.
              Sans abonnement, sans engagement.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                href={DASHBOARD_URL}
                size="lg"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Accéder au tableau de bord
              </Button>
              <Button href="#how" size="lg" variant="secondary">
                Voir comment ça marche
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Sans abonnement
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Paiements Wave & OM
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Retrait automatique
              </li>
            </ul>
          </div>

          {/* Visual mock: WhatsApp conversation card */}
          <div className="relative animate-fade-up [animation-delay:120ms]">
            <PhoneMock />
          </div>
        </div>
      </Container>
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Floating "live" badge */}
      <div className="absolute -top-3 -left-3 z-10 flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </div>

      {/* Phone frame */}
      <div className="rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
        <div className="overflow-hidden rounded-[2rem] bg-[#e5ddd5]">
          {/* WhatsApp header */}
          <div className="flex items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold">
              JL
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">JokkoLive · Aïssa</p>
              <p className="text-[11px] text-emerald-100">en ligne</p>
            </div>
          </div>

          {/* Conversation */}
          <div className="space-y-2 p-4 text-[13px] text-slate-900">
            <ChatBubble side="right">@aissa:R1</ChatBubble>
            <ChatBubble side="left">
              <div className="font-semibold">🛒 Commande JK-A8X enregistrée</div>
              <div className="mt-1 text-xs">
                Robe rouge taille M · 15 000 XOF
              </div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white">
                💳 Payer ici
              </div>
            </ChatBubble>
            <ChatBubble side="left">
              <div className="font-semibold">✅ Paiement reçu — JK-A8X</div>
              <div className="mt-1 text-xs">
                14 700 XOF crédités sur ton compte Wave
              </div>
            </ChatBubble>
          </div>
        </div>
      </div>

      {/* Decorative dots */}
      <div className="absolute -right-6 -bottom-6 -z-10 grid grid-cols-6 gap-2 opacity-40">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          />
        ))}
      </div>
    </div>
  );
}

function ChatBubble({
  side,
  children,
}: {
  side: 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <div className={side === 'right' ? 'flex justify-end' : 'flex'}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${
          side === 'right' ? 'bg-emerald-100' : 'bg-white'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-8">
      <Container>
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
          Compatible avec
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2">
            <span className="text-2xl">📱</span> WhatsApp Business
          </span>
          <span className="flex items-center gap-2">
            <span className="text-2xl">🎵</span> TikTok
          </span>
          <span className="flex items-center gap-2">
            <span className="text-2xl">📸</span> Instagram
          </span>
          <span className="flex items-center gap-2">
            <span className="text-2xl">💸</span> Wave
          </span>
          <span className="flex items-center gap-2">
            <span className="text-2xl">🟧</span> Orange Money
          </span>
        </div>
      </Container>
    </section>
  );
}

// ── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Commandes WhatsApp natives',
    desc: "L'acheteur écrit @vendeur:CODE, l'API capte le message et génère la commande + le lien de paiement automatiquement.",
  },
  {
    icon: Package,
    title: 'Catalogue produits',
    desc: 'Crée tes produits avec photo, prix, stock. Chaque produit a un code court à dicter en live (R1, J5, 12…).',
  },
  {
    icon: Wallet,
    title: 'Paiements mobile money',
    desc: 'Wave et Orange Money intégrés. L\'acheteur clique le lien, paie en 10 secondes, tu reçois une confirmation.',
  },
  {
    icon: Zap,
    title: 'Retrait automatique',
    desc: "À chaque paiement, l'argent est viré directement sur ton compte mobile money — pas besoin de retirer manuellement.",
  },
  {
    icon: TrendingUp,
    title: 'Stock en temps réel',
    desc: 'Décrément atomique : si 10 personnes commandent en même temps un stock de 5, seules 5 réussissent. Plus de survente.',
  },
  {
    icon: Smartphone,
    title: 'App mobile native',
    desc: 'Le tableau de bord est une PWA installable sur iPhone et Android. Look et feel d\'une vraie app.',
  },
];

function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tout ce qu'il faut pour vendre vite
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Pensé pour les vendeurs qui font du live commerce en Afrique de l'Ouest.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all hover:shadow-pop hover:-translate-y-0.5"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Crée ton catalogue',
    desc: "Ajoute tes produits dans le tableau de bord (photo, prix, stock). Chaque produit a un code court mémorisable.",
  },
  {
    n: '02',
    title: 'Partage ton lien WhatsApp',
    desc: 'Mets ton lien wa.me dans ta bio TikTok / Insta. Quand ton viewer clique, WhatsApp s\'ouvre avec ton pseudo pré-rempli.',
  },
  {
    n: '03',
    title: 'Encaisse en live',
    desc: 'Le viewer envoie le code, paie via Wave ou Orange Money, et tu reçois l\'argent directement sur ton compte.',
  },
];

function HowItWorks() {
  return (
    <section
      id="how"
      className="border-y border-slate-100 bg-slate-50/40 py-20 sm:py-28"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            3 étapes pour démarrer
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Du catalogue à l'argent encaissé en moins d'une journée.
          </p>
        </div>

        <ol className="mt-14 grid gap-8 lg:grid-cols-3 lg:gap-6">
          {STEPS.map(({ n, title, desc }, i) => (
            <li
              key={n}
              className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <span className="absolute -top-3 -left-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 font-mono text-sm font-bold text-white shadow">
                {n}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {desc}
              </p>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden h-px w-6 bg-slate-200 lg:block"
                />
              )}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-28">
      <Container size="md">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tarif unique, transparent
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Pas d'abonnement. Tu paies uniquement quand tu encaisses.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-8 shadow-pop sm:p-12">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-700">
              Frais plateforme
            </p>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-6xl font-bold tracking-tight text-slate-900 sm:text-7xl">
                50
                <span className="text-3xl font-medium text-slate-500"> XOF</span>
              </span>
              <span className="text-3xl font-medium text-slate-400">+</span>
              <span className="text-6xl font-bold tracking-tight text-slate-900 sm:text-7xl">
                2<span className="text-3xl font-medium text-slate-500">%</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              prélevés sur chaque paiement reçu
            </p>
          </div>

          <ul className="mt-10 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
            <Bullet>Sans abonnement, sans engagement</Bullet>
            <Bullet>Paiements Wave + Orange Money inclus</Bullet>
            <Bullet>Retrait automatique vers ton mobile money</Bullet>
            <Bullet>Tableau de bord (web + mobile PWA)</Bullet>
            <Bullet>Notifications WhatsApp gratuites</Bullet>
            <Bullet>Frais personnalisables par admin</Bullet>
          </ul>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Button
              href={DASHBOARD_URL}
              size="lg"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Commencer maintenant
            </Button>
            <p className="text-xs text-slate-500">
              L'inscription se fait via l'administrateur — contactez-nous.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-slate-900 py-16 sm:py-20">
      <Container size="md">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Prêt à transformer tes lives en chiffre d'affaires ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            Rejoins les vendeurs qui encaissent leurs ventes WhatsApp
            automatiquement.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              href={DASHBOARD_URL}
              size="lg"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Accéder au tableau de bord
            </Button>
            <Button
              href="mailto:contact@jokkolive.com"
              size="lg"
              variant="secondary"
              leftIcon={<Receipt className="h-4 w-4" />}
            >
              Demander un compte vendeur
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
