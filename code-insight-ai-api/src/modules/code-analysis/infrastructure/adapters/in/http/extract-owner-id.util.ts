import type { Request } from 'express';
import type { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Verifica el idToken de Cognito enviado en `Authorization: Bearer <token>`
 * y devuelve el claim `sub` (id del usuario) si es válido, o `undefined`
 * si no hay token, es inválido o expiró.
 *
 * A diferencia de un JWT Authorizer de API Gateway (que exige el token en
 * TODA la ruta), esta verificación se hace dentro del propio backend para
 * poder decidir caso por caso: analizar por URL git pública no requiere
 * sesión, pero analizar por ZIP (código propio, potencialmente privado)
 * sí. Ver `AnalysisController`.
 *
 * Recibe `ConfigService` (en vez de leer `process.env` directamente) para
 * mantener consistencia con el resto de adapters de infraestructura y
 * facilitar el testeo con mocks.
 */
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

/**
 * Intenta obtener el `ownerId` (claim `sub`) del token de la petición.
 * Nunca lanza: si no hay token, es inválido o faltan las variables de
 * entorno de Cognito (ej. entorno local sin configurar), devuelve
 * `undefined` y el llamador decide si eso es aceptable o no.
 */
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
      // Token ausente/inválido/expirado: se trata como anónimo.
    }
  }

  // Respaldo solo para desarrollo local (sin Cognito configurado):
  // permite simular un ownerId con la cabecera `x-user-id` vía curl/Postman.
  if (!userPoolId) {
    return req.headers['x-user-id'] as string | undefined;
  }

  return undefined;
}

