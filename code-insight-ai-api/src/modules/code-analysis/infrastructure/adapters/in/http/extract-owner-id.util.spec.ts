import type { Request } from 'express';
import type { ConfigService } from '@nestjs/config';
import { getOwnerId } from './extract-owner-id.util';

const verifyMock = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({ verify: verifyMock })),
  },
}));

function buildRequest(headers: Record<string, string | undefined>): Request {
  return { headers } as unknown as Request;
}

function buildConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('GIVEN getOwnerId', () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  describe('GIVEN Cognito is configured and the bearer token is valid', () => {
    it('WHEN getOwnerId is called with a valid token THEN it should return the "sub" claim from the verified token', async () => {
            verifyMock.mockResolvedValue({ sub: 'user-123' });
      const req = buildRequest({ authorization: 'Bearer valid-token' });
      const config = buildConfig({
        COGNITO_USER_POOL_ID: 'pool-1',
        COGNITO_CLIENT_ID: 'client-1',
      });

            const ownerId = await getOwnerId(req, config);

            expect(ownerId).toBe('user-123');
      expect(verifyMock).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('GIVEN Cognito is configured but the token is invalid or expired', () => {
    it('WHEN getOwnerId is called with an invalid token THEN it should treat the request as anonymous and return undefined', async () => {
            verifyMock.mockRejectedValue(new Error('token expired'));
      const req = buildRequest({ authorization: 'Bearer expired-token' });
      const config = buildConfig({
        COGNITO_USER_POOL_ID: 'pool-1',
        COGNITO_CLIENT_ID: 'client-1',
      });

            const ownerId = await getOwnerId(req, config);

            expect(ownerId).toBeUndefined();
    });
  });

  describe('GIVEN there is no Authorization header at all', () => {
    it('WHEN getOwnerId is called without a header THEN it should return undefined without attempting to verify anything', async () => {
            const req = buildRequest({});
      const config = buildConfig({
        COGNITO_USER_POOL_ID: 'pool-1',
        COGNITO_CLIENT_ID: 'client-1',
      });

            const ownerId = await getOwnerId(req, config);

            expect(ownerId).toBeUndefined();
      expect(verifyMock).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN Cognito is not configured (local development without env vars)', () => {
    it('WHEN getOwnerId is called without Cognito config THEN it should fall back to the "x-user-id" header for local testing', async () => {
            const req = buildRequest({ 'x-user-id': 'local-dev-user' });
      const config = buildConfig({});

            const ownerId = await getOwnerId(req, config);

            expect(ownerId).toBe('local-dev-user');
    });
  });
});
