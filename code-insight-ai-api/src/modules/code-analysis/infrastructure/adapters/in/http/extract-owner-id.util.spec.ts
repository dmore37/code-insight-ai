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

describe('getOwnerId', () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  describe('when Cognito is configured and the bearer token is valid', () => {
    it('should return the "sub" claim from the verified token', async () => {
      // Given
      verifyMock.mockResolvedValue({ sub: 'user-123' });
      const req = buildRequest({ authorization: 'Bearer valid-token' });
      const config = buildConfig({
        COGNITO_USER_POOL_ID: 'pool-1',
        COGNITO_CLIENT_ID: 'client-1',
      });

      // When
      const ownerId = await getOwnerId(req, config);

      // Then
      expect(ownerId).toBe('user-123');
      expect(verifyMock).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('when Cognito is configured but the token is invalid or expired', () => {
    it('should treat the request as anonymous and return undefined', async () => {
      // Given
      verifyMock.mockRejectedValue(new Error('token expired'));
      const req = buildRequest({ authorization: 'Bearer expired-token' });
      const config = buildConfig({
        COGNITO_USER_POOL_ID: 'pool-1',
        COGNITO_CLIENT_ID: 'client-1',
      });

      // When
      const ownerId = await getOwnerId(req, config);

      // Then
      expect(ownerId).toBeUndefined();
    });
  });

  describe('when there is no Authorization header at all', () => {
    it('should return undefined without attempting to verify anything', async () => {
      // Given
      const req = buildRequest({});
      const config = buildConfig({
        COGNITO_USER_POOL_ID: 'pool-1',
        COGNITO_CLIENT_ID: 'client-1',
      });

      // When
      const ownerId = await getOwnerId(req, config);

      // Then
      expect(ownerId).toBeUndefined();
      expect(verifyMock).not.toHaveBeenCalled();
    });
  });

  describe('when Cognito is not configured (local development without env vars)', () => {
    it('should fall back to the "x-user-id" header for local testing', async () => {
      // Given: no COGNITO_USER_POOL_ID/CLIENT_ID configured
      const req = buildRequest({ 'x-user-id': 'local-dev-user' });
      const config = buildConfig({});

      // When
      const ownerId = await getOwnerId(req, config);

      // Then
      expect(ownerId).toBe('local-dev-user');
    });
  });
});
