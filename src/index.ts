import 'dotenv/config';

import { createApp } from './app';
import { createPrismaClient } from './db/prisma';
import { createGraphClient } from './services/graph';
import { loadConfig } from './utils/config';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { createLogger } from './utils/logger';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const prisma = createPrismaClient();

async function main() {
  // Azure-Credentials aus DB laden und ins config schreiben (wie in app.ts)
  const { loadAzureConfigFromDb } = await import('./utils/azureConfigDb');
  const azureConfig = await loadAzureConfigFromDb(prisma);
  config.azureTenantId = azureConfig.AZURE_TENANT_ID;
  config.azureClientId = azureConfig.AZURE_CLIENT_ID;
  config.azureClientSecret = azureConfig.AZURE_CLIENT_SECRET;

  const graphClient = createGraphClient(config, logger);
  const app = await createApp({ config, logger, prisma, graphClient });
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('server_started', { port: config.port });
  });
  setupGracefulShutdown({ server, logger, prisma });
}

main();
