import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Button } from './Button';
import { Container } from './Container';
import { cn } from './cn';

const DASHBOARD_URL = 'https://app.jokkolive.com';

/**
 * Header sticky avec backdrop blur. Devient légèrement plus opaque + bordure
 * au scroll pour un effet "lift" subtil.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-all',
        scrolled
          ? 'border-b border-slate-200 bg-white/85 backdrop-blur-md'
          : 'bg-transparent',
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="JokkoLive — accueil">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <a
              href="#features"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Fonctionnalités
            </a>
            <a
              href="#how"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Comment ça marche
            </a>
            <a
              href="#pricing"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Tarifs
            </a>
          </nav>

          <Button href={DASHBOARD_URL} size="md">
            Se connecter
          </Button>
        </div>
      </Container>
    </header>
  );
}
