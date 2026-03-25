import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

const API_KEY = process.env.API_KEY || 'kaitai-dev-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-api-key'];
    if (key !== API_KEY) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
}
