import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Container } from './Container';

const DASHBOARD_URL = 'https://app.jokkolive.com';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Logo />
            <p className="text-xs text-slate-500">
              Live commerce sur WhatsApp · Made in Sénégal 🇸🇳
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link
              to="/terms"
              className="text-slate-600 transition-colors hover:text-slate-900"
            >
              Conditions
            </Link>
            <Link
              to="/privacy"
              className="text-slate-600 transition-colors hover:text-slate-900"
            >
              Confidentialité
            </Link>
            <a
              href={DASHBOARD_URL}
              className="text-slate-600 transition-colors hover:text-slate-900"
            >
              Tableau de bord
            </a>
            <a
              href="mailto:contact@jokkolive.com"
              className="text-slate-600 transition-colors hover:text-slate-900"
            >
              Contact
            </a>
          </nav>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          © {year} JokkoLive. Tous droits réservés.
        </p>
      </Container>
    </footer>
  );
}
