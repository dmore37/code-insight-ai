
export abstract class RateLimiterPort {

  abstract tryConsume(key: string, limit: number): Promise<boolean>;
}
