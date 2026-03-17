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

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.redirect(302, config.landingRedirectUrl);
  };
};

export const awarenessHandler = () => {
  return (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <html>
        <head><title>Awareness Training</title></head>
        <body style="font-family:Arial, sans-serif; line-height:1.6; background:#f3f6fb;">
          <div style="max-width:400px;margin:80px auto;padding:32px 24px;background:#fff;border-radius:12px;box-shadow:0 2px 16px #0001;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft Logo" style="width:120px;display:block;margin:0 auto 24px auto;">
            <h2 style="font-weight:600;text-align:center;margin-bottom:24px;">Awareness Training</h2>
            <p style="text-align:center;">Dies war eine simulierte Sicherheitsübung. Bitte geben Sie keine persönlichen oder vertraulichen Daten ein. Keine Sorge – es ist nichts passiert. Diese Übung dient lediglich dazu, unser Bewusstsein für IT‑Sicherheit zu stärken. Beim nächsten Mal einfach einen Moment genauer hinschauen</p>
          </div>
        </body>
      </html>
    `);
  };
};
