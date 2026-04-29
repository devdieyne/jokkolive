import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Indicatifs principaux — focus Afrique de l'Ouest (cible JokkoLive),
 * complétés par quelques pays diaspora.
 */
export const COUNTRY_CODES: Array<{
  code: string;
  flag: string;
  label: string;
}> = [
  { code: '+221', flag: '🇸🇳', label: 'Sénégal' },
  { code: '+223', flag: '🇲🇱', label: 'Mali' },
  { code: '+225', flag: '🇨🇮', label: 'Côte d\u2019Ivoire' },
  { code: '+226', flag: '🇧🇫', label: 'Burkina Faso' },
  { code: '+228', flag: '🇹🇬', label: 'Togo' },
  { code: '+229', flag: '🇧🇯', label: 'Bénin' },
  { code: '+224', flag: '🇬🇳', label: 'Guinée' },
  { code: '+227', flag: '🇳🇪', label: 'Niger' },
  { code: '+222', flag: '🇲🇷', label: 'Mauritanie' },
  { code: '+237', flag: '🇨🇲', label: 'Cameroun' },
  { code: '+241', flag: '🇬🇦', label: 'Gabon' },
  { code: '+242', flag: '🇨🇬', label: 'Congo' },
  { code: '+243', flag: '🇨🇩', label: 'RDC' },
  { code: '+212', flag: '🇲🇦', label: 'Maroc' },
  { code: '+213', flag: '🇩🇿', label: 'Algérie' },
  { code: '+216', flag: '🇹🇳', label: 'Tunisie' },
  { code: '+33', flag: '🇫🇷', label: 'France' },
  { code: '+1', flag: '🇺🇸', label: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
];

interface Props {
  /** Téléphone E.164 complet, contrôlé par le parent (`+221776583181`). */
  value: string;
  onChange: (phoneE164: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Sépare un E.164 en (indicatif, reste). Tente de matcher l'indicatif
 * connu le plus long en premier.
 */
function splitPhone(e164: string): { code: string; rest: string } {
  if (!e164.startsWith('+')) return { code: '+221', rest: e164 };
  const sorted = [...COUNTRY_CODES].sort(
    (a, b) => b.code.length - a.code.length,
  );
  const match = sorted.find((c) => e164.startsWith(c.code));
  if (match) return { code: match.code, rest: e164.slice(match.code.length) };
  return { code: '+221', rest: e164.slice(1) };
}

export function PhoneInput({ value, onChange, disabled, autoFocus }: Props) {
  const initial = splitPhone(value);
  const [code, setCode] = useState(initial.code);
  const [number, setNumber] = useState(initial.rest);

  // Sync vers le parent quand l'un ou l'autre change
  useEffect(() => {
    const cleaned = number.replace(/[^0-9]/g, '');
    onChange(cleaned ? `${code}${cleaned}` : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, number]);

  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === code) ?? COUNTRY_CODES[0];

  return (
    <div
      className={`group flex w-full items-stretch rounded-lg border bg-white transition-colors ${
        disabled
          ? 'border-slate-200 bg-slate-50'
          : 'border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20'
      }`}
    >
      <div className="relative flex items-center border-r border-slate-200">
        <span
          aria-hidden
          className="pointer-events-none flex items-center gap-1.5 pl-3 pr-1 text-sm tabular-nums text-slate-700"
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="font-medium">{selectedCountry.code}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </span>
        <select
          aria-label="Indicatif pays"
          className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent opacity-0 focus:outline-none"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={disabled}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.label} ({c.code})
            </option>
          ))}
        </select>
      </div>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="flex-1 rounded-r-lg bg-transparent px-3 py-2.5 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
        placeholder="77 658 31 81"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        required
      />
    </div>
  );
}
