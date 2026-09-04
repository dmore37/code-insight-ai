import type { Request } from 'express';
import type { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

function getVerifier(userPoolId: string, clientId: string) {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId,
    });
  }
  return verifier;
}

export async function getOwnerId(
  req: Request,
  config: ConfigService,
): Promise<string | undefined> {
  const authHeader = req.headers['authorization'];
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const idToken = token?.startsWith('Bearer ') ? token.slice(7) : undefined;

  const userPoolId = config.get<string>('COGNITO_USER_POOL_ID');
  const clientId = config.get<string>('COGNITO_CLIENT_ID');

  if (idToken && userPoolId && clientId) {
    try {
      const payload = await getVerifier(userPoolId, clientId).verify(idToken);
      return payload.sub;
    } catch {

    }
  }

  if (!userPoolId) {
    return req.headers['x-user-id'] as string | undefined;
  }

  return undefined;
}

