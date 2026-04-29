import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  phone: string;
  pseudo: string;
  role: string;
  displayName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'changeme-jwt-secret'),
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      phone: payload.phone,
      pseudo: payload.pseudo,
      role: payload.role,
      displayName: payload.displayName,
    };
  }
}
