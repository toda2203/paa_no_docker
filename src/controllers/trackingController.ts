import { Request, Response } from 'express';

import { PrismaClient } from '@prisma/client';

import { trackToken } from '../services/trackingService';
import { GraphClient } from '../services/graph/GraphClient';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';

export const trackTokenHandler = (
  prisma: PrismaClient,
  config: Config,
  graphClient: GraphClient,
  logger: Logger,
) => {
  return async (req: Request, res: Response) => {
    const token = req.params.token;
    let tenantName = config.tenantName || null;

    if (!tenantName) {
      try {
        tenantName = await graphClient.getTenantName();
      } catch (error) {
        logger.warn('tenant_name_fetch_failed', { message: (error as Error).message });
      }
    }
    await trackToken(prisma, logger, token, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      tenantName,
    });

    res.redirect(302, config.landingRedirectUrl);
  };
};

export const landingHandler = () => {
  return (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <html>
        <head><title>Awareness Training</title></head>
        <body style="font-family:Arial, sans-serif; line-height:1.6;">
          <h1>Awareness Training</h1>
          <p>This was a simulated security awareness exercise.</p>
          <p>If you received this email unexpectedly, report it to your security team.</p>
        </body>
      </html>
    `);
  };
};
