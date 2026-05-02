import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, Currency } from '../schemas/user.schema';
import { OtpCode, OtpCodeDocument } from '../schemas/otp-code.schema';
import {
  MagicLink,
  MagicLinkDocument,
} from '../schemas/magic-link.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const OTP_TTL_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

const MAGIC_LINK_TTL_MINUTES = 10;
const MAGIC_LINK_RESEND_COOLDOWN_SECONDS = 30;
const MAGIC_LINK_DISPLAY_NAME_MAX = 60;

/**
 * Hash SHA-256 d'un token plain. On stocke uniquement le hash en DB ;
 * un dump Mongo ne donne donc pas de tokens utilisables.
 *
 * SHA-256 (vs bcrypt) : OK ici car le token est déjà 256 bits d'entropie
 * cryptographique — pas de risque de dictionnaire/rainbow table. Et on évite
 * le coût bcrypt à chaque verify.
 */
function hashMagicToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sanitise un nom WhatsApp avant stockage : c'est un input contrôlé par
 * l'utilisateur, donc trim, taille bornée, suppression des caractères de
 * contrôle (évite XSS si rendu raw plus tard, et pollution Mongo).
 */
function sanitizeWhatsappName(name?: string): string | undefined {
  if (!name) return undefined;
  // Filtre les caractères de contrôle (codepoints 0-31 et 127) qui
  // n'ont rien à faire dans un nom affiché et pourraient polluer les
  // logs/JSON ou casser un rendu front naïf.
  const cleaned = Array.from(name.trim())
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  if (!cleaned) return undefined;
  return cleaned.slice(0, MAGIC_LINK_DISPLAY_NAME_MAX);
}

/**
 * Réponse de /auth/magic/verify : si le token est valide pour un compte
 * existant, on émet la session JWT. L'inscription publique étant désactivée
 * (admin-only), il n'y a plus de variante "signup" — un user inconnu
 * n'obtient jamais de magic link au départ.
 */
export type MagicVerifyResponse = AuthResponse;

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    phone: string;
    pseudo: string;
    displayName: string;
    role: 'admin' | 'seller';
    currency: Currency;
    payoutAccounts?: {
      wave?: { mobile: string };
      orangeMoney?: { mobile: string };
    };
    /** Retrait automatique activé : à chaque paiement, virement direct vers le mobile money. */
    autoPayoutEnabled: boolean;
    /**
     * Lien wa.me partageable que le vendeur peut diffuser. Quand un acheteur
     * clique, WhatsApp s'ouvre sur le numéro JokkoLive avec un message
     * pré-rempli `@<pseudo>:` — il n'a plus qu'à compléter par le code produit.
     */
    share?: {
      whatsappNumber: string;
      prefilledMessage: string;
      link: string;
    };
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(OtpCode.name)
    private readonly otpModel: Model<OtpCodeDocument>,
    @InjectModel(MagicLink.name)
    private readonly magicLinkModel: Model<MagicLinkDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultAdmin();
  }

  // ── Login (request + verify OTP) ──────────────────────────────────────────
  // L'inscription publique a été désactivée : seul un admin peut créer un
  // compte via POST /users (cf. UsersController). Le user reçoit ensuite ses
  // identifiants par WhatsApp et se connecte via OTP ou magic link.

  /**
   * Demande un OTP. Retourne aussi les infos du fallback WhatsApp pour que
   * le front puisse afficher "Si vous ne recevez pas le code, écrivez LOGIN
   * au numéro X" — utile parce qu'avec Cloud API en texte simple, l'envoi
   * échoue silencieusement hors fenêtre 24h (cf. CloudProvider.sendOtp).
   */
  async requestOtp(phone: string): Promise<{
    sent: boolean;
    fallback?: {
      whatsappNumber: string;
      link: string;
      prefilledMessage: string;
    };
  }> {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      throw new NotFoundException('Aucun compte associé à ce numéro');
    }
    if (user.disabled) {
      throw new ForbiddenException('Compte désactivé. Contactez l\'admin.');
    }

    await this.issueOtp(phone, 'login');

    // Construit le lien wa.me pour le fallback "écrire LOGIN" à afficher
    // sur la page OTP. Si WHATSAPP_BUSINESS_NUMBER n'est pas configuré,
    // on retourne juste { sent: true } et le front masque le fallback.
    const businessRaw =
      this.configService.get<string>('WHATSAPP_BUSINESS_NUMBER') ?? '';
    const businessDigits = businessRaw.replace(/[^0-9]/g, '');
    if (!businessDigits) return { sent: true };

    const prefilledMessage = 'LOGIN';
    return {
      sent: true,
      fallback: {
        whatsappNumber: `+${businessDigits}`,
        prefilledMessage,
        link: `https://wa.me/${businessDigits}?text=${encodeURIComponent(prefilledMessage)}`,
      },
    };
  }

  async verifyOtp(phone: string, code: string): Promise<AuthResponse> {
    const otp = await this.otpModel
      .findOne({ phone, consumed: false })
      .sort({ createdAt: -1 })
      .exec();

    if (!otp) {
      throw new UnauthorizedException('Aucun code en attente. Demandez un nouveau code.');
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Code expiré. Demandez un nouveau code.');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Trop de tentatives. Demandez un nouveau code.');
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      otp.attempts += 1;
      await otp.save();
      throw new UnauthorizedException('Code incorrect');
    }

    otp.consumed = true;
    await otp.save();

    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      throw new NotFoundException('Compte introuvable');
    }
    if (user.disabled) {
      throw new ForbiddenException('Compte désactivé');
    }

    return this.buildAuthResponse(user);
  }

  // ── Profil ─────────────────────────────────────────────────────────────────

  async updateCurrency(userId: string, currency: Currency): Promise<AuthResponse> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { currency } }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.buildAuthResponse(user);
  }

  async getMe(userId: string): Promise<AuthResponse> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.buildAuthResponse(user);
  }

  // ── Magic Link (auth via WhatsApp user-initiated) ─────────────────────────

  /**
   * Crée un lien magique pour un user qui vient d'envoyer un message au
   * numéro business WhatsApp (donc fenêtre 24h ouverte → on peut répondre
   * en texte libre, pas besoin de template).
   *
   * Retourne l'URL à envoyer au user et le mode (login si compte existant,
   * signup sinon — le front utilisera la même URL et fera le routing après
   * /auth/magic/verify).
   */
  async requestMagicLink(
    phone: string,
    whatsappName?: string,
  ): Promise<{ url: string }> {
    // Anti-spam : si un lien actif (non consommé, non expiré) a été créé il
    // y a moins de 30s, on refuse d'en générer un nouveau. Le webhook qui
    // appelle cette méthode catche l'exception et envoie un message
    // "patientez" au user — ce qui évite de spammer WhatsApp.
    //
    // On NE peut PAS renvoyer le même lien (le token est désormais hashé en
    // DB, on n'a plus le plain). C'est OK : un seul lien actif suffit.
    const last = await this.magicLinkModel
      .findOne({ phone, consumed: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();
    if (last) {
      const ageSec = (Date.now() - last.get('createdAt').getTime()) / 1000;
      if (ageSec < MAGIC_LINK_RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(MAGIC_LINK_RESEND_COOLDOWN_SECONDS - ageSec);
        throw new BadRequestException(
          `Un lien vient d'être envoyé. Vérifiez WhatsApp ou patientez ${wait}s.`,
        );
      }
    }

    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      // Inscription publique désactivée : pas de compte, pas de magic link.
      // Le webhook traduit cette exception en message "Contactez l'admin".
      throw new NotFoundException(
        "Aucun compte associé à ce numéro. Contactez l'admin pour vous inscrire.",
      );
    }
    if (user.disabled) {
      throw new ForbiddenException('Compte désactivé. Contactez l\'admin.');
    }

    // Token SHA-256 hashé en DB ; entropie 256 bits → pas besoin de bcrypt.
    const tokenPlain = randomBytes(32).toString('hex');
    const tokenHash = hashMagicToken(tokenPlain);
    await this.magicLinkModel.create({
      token: tokenHash,
      phone,
      whatsappName: sanitizeWhatsappName(whatsappName),
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000),
    });

    return { url: this.buildMagicUrl(tokenPlain) };
  }

  /**
   * Consomme (ou pré-valide pour signup) un magic link.
   *
   * - mode `login`  : marque le doc consumed=true et émet le JWT
   * - mode `signup` : NE consomme PAS, retourne phone + name pour pré-remplir
   *                   le formulaire ; complete-signup() consommera le token
   */
  async verifyMagicLink(token: string): Promise<MagicVerifyResponse> {
    if (token.length !== 64) {
      // Court-circuit : le token plain a une longueur fixe (32 bytes hex = 64
      // chars). On évite un round-trip Mongo si quelqu'un essaie n'importe quoi.
      throw new UnauthorizedException('Lien invalide');
    }
    const tokenHash = hashMagicToken(token);

    // Atomic mark-as-consumed : si deux requêtes concurrentes arrivent en
    // même temps, une seule réussit (l'autre récupère null = déjà consommé).
    const link = await this.magicLinkModel
      .findOneAndUpdate(
        { token: tokenHash, consumed: false, expiresAt: { $gt: new Date() } },
        { $set: { consumed: true } },
        { new: true },
      )
      .exec();
    if (!link) {
      throw new UnauthorizedException('Lien invalide, expiré ou déjà utilisé');
    }

    const user = await this.userModel.findOne({ phone: link.phone }).exec();
    if (!user) {
      // Le user a été supprimé entre la génération du lien et le clic.
      throw new NotFoundException('Compte introuvable');
    }
    if (user.disabled) {
      throw new ForbiddenException('Compte désactivé');
    }
    return this.buildAuthResponse(user);
  }

  private buildMagicUrl(token: string): string {
    const base = this.configService.get<string>('FRONTEND_URL');
    const isProd =
      (this.configService.get<string>('nodeEnv') ?? 'development') ===
      'production';
    if (!base) {
      if (isProd) {
        // Footgun : sans FRONTEND_URL en prod, on enverrait des liens
        // localhost inutilisables au user. Mieux vaut échouer bruyamment.
        throw new Error(
          'FRONTEND_URL must be set in production to generate magic links',
        );
      }
      return `http://localhost:5173/auth/magic?token=${token}`;
    }
    // strip trailing slash pour éviter `//auth/magic`
    const normalized = base.replace(/\/+$/, '');
    return `${normalized}/auth/magic?token=${token}`;
  }

  // ── Internes ───────────────────────────────────────────────────────────────

  /**
   * Génère un OTP, le stocke en hash, et l'envoie via WhatsApp.
   * Rate-limit : un nouveau OTP ne peut être demandé qu'après 60 s.
   */
  private async issueOtp(
    phone: string,
    purpose: 'register' | 'login',
  ): Promise<void> {
    const lastOtp = await this.otpModel
      .findOne({ phone })
      .sort({ createdAt: -1 })
      .exec();

    if (lastOtp) {
      const ageSec = (Date.now() - lastOtp.get('createdAt').getTime()) / 1000;
      if (ageSec < OTP_RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - ageSec);
        throw new BadRequestException(
          `Patientez ${wait}s avant de redemander un code.`,
        );
      }
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 8);

    await this.otpModel.create({
      phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      purpose,
    });

    // sendOtp() : actuellement texte simple côté Cloud (cf. CloudProvider).
    //  - Si la fenêtre 24h est ouverte → le user reçoit l'OTP normalement
    //  - Sinon → Meta refuse l'envoi (erreur 131056 outside window)
    //
    // On ne throw jamais ici : le record OTP est créé dans tous les cas. Si
    // l'envoi échoue, le user voit dans l'UI un encart "Pas reçu ? Écrivez
    // LOGIN au numéro X" → ouvre la fenêtre 24h ET déclenche un magic link.
    // En dev, on logge le code en clair pour débloquer les tests.
    try {
      await this.whatsapp.sendOtp(phone, code);
    } catch (err) {
      const isProd =
        (this.configService.get<string>('nodeEnv') ?? 'development') ===
        'production';
      if (isProd) {
        // En prod : on ne throw pas (l'UI affiche déjà le fallback) mais on
        // log à WARN pour pouvoir tracker les échecs côté observabilité.
        this.logger.warn(
          `Envoi OTP à ${phone} échoué : ${err instanceof Error ? err.message : String(err)}. Le user devra utiliser le fallback "écrire LOGIN".`,
        );
      } else {
        // Dev : on logge le code en clair (pas de WhatsApp branché).
        this.logger.warn(
          `⚠️  Envoi OTP échoué (${err instanceof Error ? err.message : err}). DEV fallback : code pour ${phone} = ${code}`,
        );
      }
    }
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private buildAuthResponse(user: UserDocument): AuthResponse {
    const payload = {
      sub: user._id.toString(),
      phone: user.phone,
      pseudo: user.pseudo,
      role: user.role,
      displayName: user.displayName,
    };

    // Lien wa.me — basé sur le numéro WhatsApp public de la plateforme
    // (celui pairé dans WAHA). On expose `share` seulement si le numéro est
    // configuré, pour éviter de générer un lien cassé.
    const businessNumberRaw =
      this.configService.get<string>('WHATSAPP_BUSINESS_NUMBER') ?? '';
    const businessDigits = businessNumberRaw.replace(/[^0-9]/g, '');
    let share: AuthResponse['user']['share'];
    if (businessDigits) {
      const prefilled = `@${user.pseudo}: `;
      share = {
        whatsappNumber: `+${businessDigits}`,
        prefilledMessage: prefilled,
        link: `https://wa.me/${businessDigits}?text=${encodeURIComponent(prefilled)}`,
      };
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        phone: user.phone,
        pseudo: user.pseudo,
        displayName: user.displayName,
        role: user.role,
        currency: user.currency,
        payoutAccounts: user.payoutAccounts,
        autoPayoutEnabled: user.autoPayoutEnabled ?? false,
        share,
      },
    };
  }

  private async seedDefaultAdmin(): Promise<void> {
    const adminPhone =
      this.configService.get<string>('ADMIN_PHONE') ?? '+221776583181';
    const adminPseudo =
      this.configService.get<string>('ADMIN_PSEUDO') ?? 'admin';

    const exists = await this.userModel.findOne({ phone: adminPhone }).exec();
    if (exists) {
      // S'il existe déjà mais pas en admin, on promeut
      if (exists.role !== 'admin') {
        exists.role = 'admin';
        await exists.save();
        this.logger.log(`👑 ${adminPhone} promu admin`);
      }
      return;
    }

    // Évite la collision de pseudo si quelqu'un l'a pris
    let pseudo = adminPseudo;
    while (await this.userModel.exists({ pseudo })) {
      pseudo = `${adminPseudo}_${Math.floor(Math.random() * 1000)}`;
    }

    await this.userModel.create({
      phone: adminPhone,
      pseudo,
      displayName: 'Admin',
      role: 'admin',
      currency: 'XOF',
    });
    this.logger.log(`✅ Admin créé : ${adminPhone} (@${pseudo})`);
  }
}
