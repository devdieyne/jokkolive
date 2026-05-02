import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Indicatifs téléphoniques mondiaux (norme ITU-T E.164).
 *
 * Organisation :
 *  - Bloc 1 (top) : Afrique de l'Ouest + diaspora prioritaire (cible JokkoLive)
 *  - Bloc 2       : tous les autres pays, ordre alphabétique
 *
 * `splitPhone()` matche l'indicatif le plus long en premier, donc l'ordre
 * d'affichage dans la liste n'affecte pas le parsing (ex: +1242 Bahamas
 * gagne sur +1 USA pour un numéro qui commence par +1242).
 */
export const COUNTRY_CODES: Array<{
  code: string;
  flag: string;
  label: string;
}> = [
  // ── Top : Afrique de l'Ouest & diaspora cible ─────────────────────────────
  { code: '+221', flag: '🇸🇳', label: 'Sénégal' },
  { code: '+223', flag: '🇲🇱', label: 'Mali' },
  { code: '+225', flag: '🇨🇮', label: 'Côte d’Ivoire' },
  { code: '+226', flag: '🇧🇫', label: 'Burkina Faso' },
  { code: '+228', flag: '🇹🇬', label: 'Togo' },
  { code: '+229', flag: '🇧🇯', label: 'Bénin' },
  { code: '+224', flag: '🇬🇳', label: 'Guinée' },
  { code: '+227', flag: '🇳🇪', label: 'Niger' },
  { code: '+222', flag: '🇲🇷', label: 'Mauritanie' },
  { code: '+237', flag: '🇨🇲', label: 'Cameroun' },
  { code: '+33', flag: '🇫🇷', label: 'France' },
  { code: '+352', flag: '🇱🇺', label: 'Luxembourg' },
  { code: '+32', flag: '🇧🇪', label: 'Belgique' },
  { code: '+1', flag: '🇺🇸', label: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', label: 'Royaume-Uni' },

  // ── Tous les autres pays — alphabétique ──────────────────────────────────
  { code: '+93', flag: '🇦🇫', label: 'Afghanistan' },
  { code: '+27', flag: '🇿🇦', label: 'Afrique du Sud' },
  { code: '+355', flag: '🇦🇱', label: 'Albanie' },
  { code: '+213', flag: '🇩🇿', label: 'Algérie' },
  { code: '+49', flag: '🇩🇪', label: 'Allemagne' },
  { code: '+376', flag: '🇦🇩', label: 'Andorre' },
  { code: '+244', flag: '🇦🇴', label: 'Angola' },
  { code: '+1264', flag: '🇦🇮', label: 'Anguilla' },
  { code: '+1268', flag: '🇦🇬', label: 'Antigua-et-Barbuda' },
  { code: '+966', flag: '🇸🇦', label: 'Arabie saoudite' },
  { code: '+54', flag: '🇦🇷', label: 'Argentine' },
  { code: '+374', flag: '🇦🇲', label: 'Arménie' },
  { code: '+297', flag: '🇦🇼', label: 'Aruba' },
  { code: '+61', flag: '🇦🇺', label: 'Australie' },
  { code: '+43', flag: '🇦🇹', label: 'Autriche' },
  { code: '+994', flag: '🇦🇿', label: 'Azerbaïdjan' },
  { code: '+1242', flag: '🇧🇸', label: 'Bahamas' },
  { code: '+973', flag: '🇧🇭', label: 'Bahreïn' },
  { code: '+880', flag: '🇧🇩', label: 'Bangladesh' },
  { code: '+1246', flag: '🇧🇧', label: 'Barbade' },
  { code: '+501', flag: '🇧🇿', label: 'Belize' },
  { code: '+975', flag: '🇧🇹', label: 'Bhoutan' },
  { code: '+375', flag: '🇧🇾', label: 'Biélorussie' },
  { code: '+95', flag: '🇲🇲', label: 'Birmanie (Myanmar)' },
  { code: '+591', flag: '🇧🇴', label: 'Bolivie' },
  { code: '+387', flag: '🇧🇦', label: 'Bosnie-Herzégovine' },
  { code: '+267', flag: '🇧🇼', label: 'Botswana' },
  { code: '+55', flag: '🇧🇷', label: 'Brésil' },
  { code: '+673', flag: '🇧🇳', label: 'Brunei' },
  { code: '+359', flag: '🇧🇬', label: 'Bulgarie' },
  { code: '+257', flag: '🇧🇮', label: 'Burundi' },
  { code: '+855', flag: '🇰🇭', label: 'Cambodge' },
  { code: '+238', flag: '🇨🇻', label: 'Cap-Vert' },
  { code: '+56', flag: '🇨🇱', label: 'Chili' },
  { code: '+86', flag: '🇨🇳', label: 'Chine' },
  { code: '+357', flag: '🇨🇾', label: 'Chypre' },
  { code: '+57', flag: '🇨🇴', label: 'Colombie' },
  { code: '+269', flag: '🇰🇲', label: 'Comores' },
  { code: '+242', flag: '🇨🇬', label: 'Congo' },
  { code: '+243', flag: '🇨🇩', label: 'Congo (RDC)' },
  { code: '+850', flag: '🇰🇵', label: 'Corée du Nord' },
  { code: '+82', flag: '🇰🇷', label: 'Corée du Sud' },
  { code: '+506', flag: '🇨🇷', label: 'Costa Rica' },
  { code: '+385', flag: '🇭🇷', label: 'Croatie' },
  { code: '+53', flag: '🇨🇺', label: 'Cuba' },
  { code: '+599', flag: '🇨🇼', label: 'Curaçao' },
  { code: '+45', flag: '🇩🇰', label: 'Danemark' },
  { code: '+253', flag: '🇩🇯', label: 'Djibouti' },
  { code: '+1767', flag: '🇩🇲', label: 'Dominique' },
  { code: '+20', flag: '🇪🇬', label: 'Égypte' },
  { code: '+971', flag: '🇦🇪', label: 'Émirats arabes unis' },
  { code: '+593', flag: '🇪🇨', label: 'Équateur' },
  { code: '+291', flag: '🇪🇷', label: 'Érythrée' },
  { code: '+34', flag: '🇪🇸', label: 'Espagne' },
  { code: '+372', flag: '🇪🇪', label: 'Estonie' },
  { code: '+268', flag: '🇸🇿', label: 'Eswatini' },
  { code: '+251', flag: '🇪🇹', label: 'Éthiopie' },
  { code: '+679', flag: '🇫🇯', label: 'Fidji' },
  { code: '+358', flag: '🇫🇮', label: 'Finlande' },
  { code: '+241', flag: '🇬🇦', label: 'Gabon' },
  { code: '+220', flag: '🇬🇲', label: 'Gambie' },
  { code: '+995', flag: '🇬🇪', label: 'Géorgie' },
  { code: '+233', flag: '🇬🇭', label: 'Ghana' },
  { code: '+350', flag: '🇬🇮', label: 'Gibraltar' },
  { code: '+30', flag: '🇬🇷', label: 'Grèce' },
  { code: '+1473', flag: '🇬🇩', label: 'Grenade' },
  { code: '+299', flag: '🇬🇱', label: 'Groenland' },
  { code: '+590', flag: '🇬🇵', label: 'Guadeloupe' },
  { code: '+1671', flag: '🇬🇺', label: 'Guam' },
  { code: '+502', flag: '🇬🇹', label: 'Guatemala' },
  { code: '+245', flag: '🇬🇼', label: 'Guinée-Bissau' },
  { code: '+240', flag: '🇬🇶', label: 'Guinée équatoriale' },
  { code: '+592', flag: '🇬🇾', label: 'Guyana' },
  { code: '+594', flag: '🇬🇫', label: 'Guyane française' },
  { code: '+509', flag: '🇭🇹', label: 'Haïti' },
  { code: '+504', flag: '🇭🇳', label: 'Honduras' },
  { code: '+852', flag: '🇭🇰', label: 'Hong Kong' },
  { code: '+36', flag: '🇭🇺', label: 'Hongrie' },
  { code: '+91', flag: '🇮🇳', label: 'Inde' },
  { code: '+62', flag: '🇮🇩', label: 'Indonésie' },
  { code: '+98', flag: '🇮🇷', label: 'Iran' },
  { code: '+964', flag: '🇮🇶', label: 'Irak' },
  { code: '+353', flag: '🇮🇪', label: 'Irlande' },
  { code: '+354', flag: '🇮🇸', label: 'Islande' },
  { code: '+972', flag: '🇮🇱', label: 'Israël' },
  { code: '+39', flag: '🇮🇹', label: 'Italie' },
  { code: '+1876', flag: '🇯🇲', label: 'Jamaïque' },
  { code: '+81', flag: '🇯🇵', label: 'Japon' },
  { code: '+962', flag: '🇯🇴', label: 'Jordanie' },
  { code: '+7', flag: '🇰🇿', label: 'Kazakhstan' },
  { code: '+254', flag: '🇰🇪', label: 'Kenya' },
  { code: '+996', flag: '🇰🇬', label: 'Kirghizistan' },
  { code: '+686', flag: '🇰🇮', label: 'Kiribati' },
  { code: '+383', flag: '🇽🇰', label: 'Kosovo' },
  { code: '+965', flag: '🇰🇼', label: 'Koweït' },
  { code: '+856', flag: '🇱🇦', label: 'Laos' },
  { code: '+266', flag: '🇱🇸', label: 'Lesotho' },
  { code: '+371', flag: '🇱🇻', label: 'Lettonie' },
  { code: '+961', flag: '🇱🇧', label: 'Liban' },
  { code: '+231', flag: '🇱🇷', label: 'Liberia' },
  { code: '+218', flag: '🇱🇾', label: 'Libye' },
  { code: '+423', flag: '🇱🇮', label: 'Liechtenstein' },
  { code: '+370', flag: '🇱🇹', label: 'Lituanie' },
  { code: '+853', flag: '🇲🇴', label: 'Macao' },
  { code: '+389', flag: '🇲🇰', label: 'Macédoine du Nord' },
  { code: '+261', flag: '🇲🇬', label: 'Madagascar' },
  { code: '+60', flag: '🇲🇾', label: 'Malaisie' },
  { code: '+265', flag: '🇲🇼', label: 'Malawi' },
  { code: '+960', flag: '🇲🇻', label: 'Maldives' },
  { code: '+356', flag: '🇲🇹', label: 'Malte' },
  { code: '+212', flag: '🇲🇦', label: 'Maroc' },
  { code: '+692', flag: '🇲🇭', label: 'Marshall (Îles)' },
  { code: '+596', flag: '🇲🇶', label: 'Martinique' },
  { code: '+230', flag: '🇲🇺', label: 'Maurice' },
  { code: '+262', flag: '🇾🇹', label: 'Mayotte / Réunion' },
  { code: '+52', flag: '🇲🇽', label: 'Mexique' },
  { code: '+691', flag: '🇫🇲', label: 'Micronésie' },
  { code: '+373', flag: '🇲🇩', label: 'Moldavie' },
  { code: '+377', flag: '🇲🇨', label: 'Monaco' },
  { code: '+976', flag: '🇲🇳', label: 'Mongolie' },
  { code: '+382', flag: '🇲🇪', label: 'Monténégro' },
  { code: '+1664', flag: '🇲🇸', label: 'Montserrat' },
  { code: '+258', flag: '🇲🇿', label: 'Mozambique' },
  { code: '+264', flag: '🇳🇦', label: 'Namibie' },
  { code: '+674', flag: '🇳🇷', label: 'Nauru' },
  { code: '+977', flag: '🇳🇵', label: 'Népal' },
  { code: '+505', flag: '🇳🇮', label: 'Nicaragua' },
  { code: '+234', flag: '🇳🇬', label: 'Nigeria' },
  { code: '+683', flag: '🇳🇺', label: 'Niue' },
  { code: '+47', flag: '🇳🇴', label: 'Norvège' },
  { code: '+687', flag: '🇳🇨', label: 'Nouvelle-Calédonie' },
  { code: '+64', flag: '🇳🇿', label: 'Nouvelle-Zélande' },
  { code: '+968', flag: '🇴🇲', label: 'Oman' },
  { code: '+256', flag: '🇺🇬', label: 'Ouganda' },
  { code: '+998', flag: '🇺🇿', label: 'Ouzbékistan' },
  { code: '+92', flag: '🇵🇰', label: 'Pakistan' },
  { code: '+680', flag: '🇵🇼', label: 'Palaos' },
  { code: '+970', flag: '🇵🇸', label: 'Palestine' },
  { code: '+507', flag: '🇵🇦', label: 'Panama' },
  { code: '+675', flag: '🇵🇬', label: 'Papouasie-Nouvelle-Guinée' },
  { code: '+595', flag: '🇵🇾', label: 'Paraguay' },
  { code: '+31', flag: '🇳🇱', label: 'Pays-Bas' },
  { code: '+51', flag: '🇵🇪', label: 'Pérou' },
  { code: '+63', flag: '🇵🇭', label: 'Philippines' },
  { code: '+48', flag: '🇵🇱', label: 'Pologne' },
  { code: '+689', flag: '🇵🇫', label: 'Polynésie française' },
  { code: '+1787', flag: '🇵🇷', label: 'Porto Rico' },
  { code: '+351', flag: '🇵🇹', label: 'Portugal' },
  { code: '+974', flag: '🇶🇦', label: 'Qatar' },
  { code: '+236', flag: '🇨🇫', label: 'République centrafricaine' },
  { code: '+1809', flag: '🇩🇴', label: 'République dominicaine' },
  { code: '+420', flag: '🇨🇿', label: 'République tchèque' },
  { code: '+40', flag: '🇷🇴', label: 'Roumanie' },
  { code: '+7', flag: '🇷🇺', label: 'Russie' },
  { code: '+250', flag: '🇷🇼', label: 'Rwanda' },
  { code: '+1869', flag: '🇰🇳', label: 'Saint-Christophe-et-Niévès' },
  { code: '+1758', flag: '🇱🇨', label: 'Sainte-Lucie' },
  { code: '+378', flag: '🇸🇲', label: 'Saint-Marin' },
  { code: '+1784', flag: '🇻🇨', label: 'Saint-Vincent-et-les-Grenadines' },
  { code: '+503', flag: '🇸🇻', label: 'Salvador' },
  { code: '+685', flag: '🇼🇸', label: 'Samoa' },
  { code: '+239', flag: '🇸🇹', label: 'Sao Tomé-et-Principe' },
  { code: '+381', flag: '🇷🇸', label: 'Serbie' },
  { code: '+248', flag: '🇸🇨', label: 'Seychelles' },
  { code: '+232', flag: '🇸🇱', label: 'Sierra Leone' },
  { code: '+65', flag: '🇸🇬', label: 'Singapour' },
  { code: '+421', flag: '🇸🇰', label: 'Slovaquie' },
  { code: '+386', flag: '🇸🇮', label: 'Slovénie' },
  { code: '+252', flag: '🇸🇴', label: 'Somalie' },
  { code: '+249', flag: '🇸🇩', label: 'Soudan' },
  { code: '+211', flag: '🇸🇸', label: 'Soudan du Sud' },
  { code: '+94', flag: '🇱🇰', label: 'Sri Lanka' },
  { code: '+46', flag: '🇸🇪', label: 'Suède' },
  { code: '+41', flag: '🇨🇭', label: 'Suisse' },
  { code: '+597', flag: '🇸🇷', label: 'Suriname' },
  { code: '+963', flag: '🇸🇾', label: 'Syrie' },
  { code: '+992', flag: '🇹🇯', label: 'Tadjikistan' },
  { code: '+886', flag: '🇹🇼', label: 'Taïwan' },
  { code: '+255', flag: '🇹🇿', label: 'Tanzanie' },
  { code: '+235', flag: '🇹🇩', label: 'Tchad' },
  { code: '+66', flag: '🇹🇭', label: 'Thaïlande' },
  { code: '+670', flag: '🇹🇱', label: 'Timor oriental' },
  { code: '+676', flag: '🇹🇴', label: 'Tonga' },
  { code: '+1868', flag: '🇹🇹', label: 'Trinité-et-Tobago' },
  { code: '+216', flag: '🇹🇳', label: 'Tunisie' },
  { code: '+993', flag: '🇹🇲', label: 'Turkménistan' },
  { code: '+90', flag: '🇹🇷', label: 'Turquie' },
  { code: '+688', flag: '🇹🇻', label: 'Tuvalu' },
  { code: '+380', flag: '🇺🇦', label: 'Ukraine' },
  { code: '+598', flag: '🇺🇾', label: 'Uruguay' },
  { code: '+678', flag: '🇻🇺', label: 'Vanuatu' },
  { code: '+379', flag: '🇻🇦', label: 'Vatican' },
  { code: '+58', flag: '🇻🇪', label: 'Venezuela' },
  { code: '+84', flag: '🇻🇳', label: 'Vietnam' },
  { code: '+681', flag: '🇼🇫', label: 'Wallis-et-Futuna' },
  { code: '+967', flag: '🇾🇪', label: 'Yémen' },
  { code: '+260', flag: '🇿🇲', label: 'Zambie' },
  { code: '+263', flag: '🇿🇼', label: 'Zimbabwe' },
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
 * connu le plus long en premier (important pour les codes type +1242).
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
          {COUNTRY_CODES.map((c, i) => (
            <option key={`${c.code}-${i}`} value={c.code}>
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
