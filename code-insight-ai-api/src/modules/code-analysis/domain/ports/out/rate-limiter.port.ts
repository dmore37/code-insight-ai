/**
 * Puerto de salida: control de cuota de uso (rate limiting) para
 * proteger recursos costosos (en este caso, invocaciones a Bedrock).
 *
 * La estrategia es "fixed window" por día calendario: cada `key` (por
 * ejemplo, un `ownerId` o una IP para usuarios anónimos) tiene un
 * contador que se resetea automáticamente a medianoche (vía TTL nativo
 * de DynamoDB, ver el adaptador concreto).
 */
export abstract class RateLimiterPort {
  /**
   * Incrementa el contador de `key` para el día de hoy y devuelve `true`
   * si la operación está permitida (contador <= `limit` tras incrementar),
   * o `false` si ya se alcanzó el límite (en cuyo caso el incremento NO
   * se aplica, para no penalizar más allá del límite configurado).
   */
  abstract tryConsume(key: string, limit: number): Promise<boolean>;
}
