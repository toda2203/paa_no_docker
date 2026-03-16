import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';

export const validateAzureConfigHandler = (prisma: PrismaClient) => async (_req: Request, res: Response) => {
  const keys = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const config: Record<string, string> = {};
  for (const key of keys) {
    config[key] = settings.find(s => s.key === key)?.value || '';
  }
  try {
    const app = new ConfidentialClientApplication({
      auth: {
        clientId: config.AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${config.AZURE_TENANT_ID}`,
        clientSecret: config.AZURE_CLIENT_SECRET,
      },
    });
    const result = await app.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    if (!result || !result.accessToken) {
      throw new Error('No access token');
    }
    res.json({ valid: true });
  } catch (err) {
    res.status(400).json({ valid: false, error: (err as Error).message });
  }
};
