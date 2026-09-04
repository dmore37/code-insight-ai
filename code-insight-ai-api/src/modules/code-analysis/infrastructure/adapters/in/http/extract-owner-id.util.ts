import type { Request } from 'express';
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
 */
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'id',
      clientId: process.env.COGNITO_CLIENT_ID!,
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
export async function getOwnerId(req: Request): Promise<string | undefined> {
  const authHeader = req.headers['authorization'];
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const idToken = token?.startsWith('Bearer ') ? token.slice(7) : undefined;

  if (idToken && process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID) {
    try {
      const payload = await getVerifier().verify(idToken);
      return payload.sub;
    } catch {
      // Token ausente/inválido/expirado: se trata como anónimo.
    }
  }

  // Respaldo solo para desarrollo local (sin Cognito configurado):
  // permite simular un ownerId con la cabecera `x-user-id` vía curl/Postman.
  if (!process.env.COGNITO_USER_POOL_ID) {
    return req.headers['x-user-id'] as string | undefined;
  }

  return undefined;
}

