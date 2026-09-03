// Script de validación manual: invoca el handler de Lambda directamente
// (sin pasar por el binario aws-lambda-rie), simulando un evento real de
// API Gateway HTTP API v2. Útil porque el emulador RIE es inestable bajo
// QEMU (emulación amd64 en host arm64) en entornos de desarrollo Mac ARM.
process.env.AWS_LAMBDA_FUNCTION_NAME = 'code-insight-ai-api-local-test';

const { handler } = require('../dist/handler');

const event = {
  version: '2.0',
  routeKey: 'POST /analysis',
  rawPath: '/analysis',
  rawQueryString: '',
  headers: { 'content-type': 'application/json' },
  requestContext: {
    accountId: 'anonymous',
    apiId: 'local',
    domainName: 'localhost',
    http: {
      method: 'POST',
      path: '/analysis',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'local-test',
    },
    requestId: 'local-test-request-id',
    routeKey: 'POST /analysis',
    stage: '$default',
    time: new Date().toISOString(),
    timeEpoch: Date.now(),
  },
  body: JSON.stringify({ gitUrl: 'https://github.com/octocat/Hello-World' }),
  isBase64Encoded: false,
};

async function main() {
  const result = await handler(event, {});
  console.log('STATUS:', result.statusCode);
  console.log('BODY:', result.body);
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});

