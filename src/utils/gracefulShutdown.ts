import { Server } from 'http';

import { PrismaClient } from '@prisma/client';

import { Logger } from './logger';

type ShutdownDeps = {
  server: Server;
  logger: Logger;
  prisma?: PrismaClient;
};

export const setupGracefulShutdown = ({ server, logger, prisma }: ShutdownDeps) => {
  const shutdown = async (signal: string) => {
    logger.info('shutdown_start', { signal });

    server.close(async () => {
      try {
        if (prisma) {
          await prisma.$disconnect();
        }
        logger.info('shutdown_complete');
        process.exit(0);
      } catch (error) {
        logger.error('shutdown_error', { error });
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.warn('shutdown_force_exit');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
