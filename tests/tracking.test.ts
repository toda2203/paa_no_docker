import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import { Config } from '../src/utils/config';
import { Logger } from '../src/utils/logger';

const baseConfig: Config = {
  port: 3000,
  nodeEnv: 'test',
  logLevel: 'debug',
  databaseUrl: 'postgresql://example',
  graphMockMode: true,
  tokenTtlDays: 90,
  publicBaseUrl: 'http://localhost:3000',
  landingRedirectUrl: 'http://localhost:3000/landing',
  graphSenderAddress: 'sender@example.com',
  azureTenantId: undefined,
  azureClientId: undefined,
  azureClientSecret: undefined,
};

const createLoggerMock = (): Logger => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => logger,
  } as unknown as Logger;

  return logger;
};

describe('GET /t/:token', () => {
  it('redirects and logs click event for valid token', async () => {
    const prisma = {
      recipient: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'recipient-1',
          tokenExpiresAt: new Date(Date.now() + 60 * 1000),
        }),
      },
      clickEvent: { create: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };

    const app = createApp({
      config: baseConfig,
      logger: createLoggerMock(),
      prisma: prisma as any,
      graphClient: { sendMail: vi.fn() } as any,
    });

    const response = await request(app).get('/t/sample-token');

    expect(response.status).toBe(302);
    expect(response.header.location).toBe(baseConfig.landingRedirectUrl);
    expect(prisma.clickEvent.create).toHaveBeenCalledTimes(1);
  });

  it('audits missing token', async () => {
    const prisma = {
      recipient: { findUnique: vi.fn().mockResolvedValue(null) },
      clickEvent: { create: vi.fn() },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };

    const app = createApp({
      config: baseConfig,
      logger: createLoggerMock(),
      prisma: prisma as any,
      graphClient: { sendMail: vi.fn() } as any,
    });

    const response = await request(app).get('/t/missing-token');

    expect(response.status).toBe(302);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
