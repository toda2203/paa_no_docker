import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';

import { createPrismaClient } from './db/prisma';
import { createGraphClient } from './services/graph';
import { loadAzureConfigFromDb } from './utils/azureConfigDb';
import { createApiRouter, createPublicRouter, RouteDeps } from './routes';
import { loadConfig, Config } from './utils/config';
import { createLogger, Logger } from './utils/logger';
import { requestLogger } from './utils/requestLogger';

export type AppDeps = {
  prisma: RouteDeps['prisma'];
  graphClient: RouteDeps['graphClient'];
  config: Config;
  logger: Logger;
};

export const createApp = async (overrides: Partial<AppDeps> = {}) => {
  const config = overrides.config || loadConfig();
  const logger = overrides.logger || createLogger(config.logLevel);
  const prisma = overrides.prisma || createPrismaClient();
  // Azure-Konfiguration aus DB laden
  const azureConfig = await loadAzureConfigFromDb(prisma);
  config.azureTenantId = azureConfig.AZURE_TENANT_ID;
  config.azureClientId = azureConfig.AZURE_CLIENT_ID;
  config.azureClientSecret = azureConfig.AZURE_CLIENT_SECRET;
  const graphClient = overrides.graphClient || createGraphClient(config, logger);

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger(logger));

  const deps: RouteDeps = { prisma, config, graphClient, logger };

  app.use('/api', createApiRouter(deps));
  app.use('/', createPublicRouter(deps));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('request_error', { message: error.message });
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
};
