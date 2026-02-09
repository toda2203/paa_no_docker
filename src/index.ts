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
const graphClient = createGraphClient(config, logger);

const app = createApp({ config, logger, prisma, graphClient });
const server = app.listen(config.port, () => {
  logger.info('server_started', { port: config.port });
});

setupGracefulShutdown({ server, logger, prisma });
