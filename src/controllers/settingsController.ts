import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

export const getAzureConfigHandler = (prisma: PrismaClient) => async (_req: Request, res: Response) => {
  const keys = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const config: Record<string, string> = {};
  for (const key of keys) {
    config[key] = settings.find(s => s.key === key)?.value || '';
  }
  res.json(config);
};

export const setAzureConfigHandler = (prisma: PrismaClient) => async (req: Request, res: Response) => {
  const keys = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
  const updates: Record<string, string> = req.body;
  for (const key of keys) {
    if (typeof updates[key] === 'string') {
      await prisma.setting.upsert({
        where: { key },
        update: { value: updates[key] },
        create: { key, value: updates[key] },
      });
    }
  }
  res.json({ success: true });
};
