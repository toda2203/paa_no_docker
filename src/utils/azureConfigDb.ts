import { PrismaClient } from '@prisma/client';

export const loadAzureConfigFromDb = async (prisma: PrismaClient) => {
  const keys = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const config: Record<string, string> = {};
  for (const key of keys) {
    config[key] = settings.find(s => s.key === key)?.value || '';
  }
  return config;
};
