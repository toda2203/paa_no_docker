export type Config = {
  port: number;
  nodeEnv: string;
  logLevel: string;
  databaseUrl: string;
  graphMockMode: boolean;
  tokenTtlDays: number;
  publicBaseUrl: string;
  landingRedirectUrl: string;
  graphSenderAddress: string;
  tenantName?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
};

const parseBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === 'true';
};

export const loadConfig = (): Config => {
  const config: Config = {
    port: Number.parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL || '',
    graphMockMode: parseBool(process.env.GRAPH_MOCK_MODE, true),
    tokenTtlDays: Number.parseInt(process.env.TOKEN_TTL_DAYS || '90', 10),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
    landingRedirectUrl: process.env.LANDING_REDIRECT_URL || 'http://localhost:3000/landing',
    graphSenderAddress: process.env.GRAPH_SENDER_ADDRESS || '',
    tenantName: process.env.TENANT_NAME,
    azureTenantId: process.env.AZURE_TENANT_ID,
    azureClientId: process.env.AZURE_CLIENT_ID,
    azureClientSecret: process.env.AZURE_CLIENT_SECRET,
  };

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return config;
};
