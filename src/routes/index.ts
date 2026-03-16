import { PrismaClient } from '@prisma/client';
import { Router } from 'express';

import {
  createCampaignHandler,
  deleteCampaignHandler,
  listCampaignClicksHandler,
  listCampaignSummariesHandler,
  listCampaignsHandler,
  startCampaignHandler,
} from '../controllers/campaignController';
import { healthHandler } from '../controllers/healthController';
import { listDepartmentsHandler, listRecipientsHandler } from '../controllers/recipientController';
import { listSendersHandler } from '../controllers/senderController';
import { landingHandler, trackTokenHandler } from '../controllers/trackingController';
import {
  createTemplateHandler,
  deleteTemplateHandler,
  listTemplatesHandler,
  updateTemplateHandler,
} from '../controllers/templateController';
import { GraphClient } from '../services/graph/GraphClient';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';

import { getAzureConfigHandler, setAzureConfigHandler } from '../controllers/settingsController';
import { validateAzureConfigHandler } from '../controllers/validateAzureController';

export type RouteDeps = {
  prisma: PrismaClient;
  config: Config;
  graphClient: GraphClient;
  logger: Logger;
};

export const createApiRouter = (deps: RouteDeps) => {
  const router = Router();

  router.get('/templates', listTemplatesHandler(deps.prisma));
  router.post('/templates', createTemplateHandler(deps.prisma));
  router.put('/templates/:id', updateTemplateHandler(deps.prisma));
  router.delete('/templates/:id', deleteTemplateHandler(deps.prisma));
  router.get('/senders', listSendersHandler(deps.graphClient));
  router.get('/recipients', listRecipientsHandler(deps.graphClient));
  router.get('/departments', listDepartmentsHandler(deps.graphClient));
  router.get('/campaigns', listCampaignsHandler(deps.prisma));
  router.get('/campaigns/summary', listCampaignSummariesHandler(deps.prisma));
  router.post('/campaigns', createCampaignHandler(deps.prisma, deps.config));
  router.delete('/campaigns/:id', deleteCampaignHandler(deps.prisma));
  router.get('/campaigns/:id/clicks', listCampaignClicksHandler(deps.prisma));
  router.post(
    '/campaigns/:id/start',
    startCampaignHandler(deps.prisma, deps.config, deps.graphClient, deps.logger),
  );

  // Azure-Konfiguration
  router.get('/settings/azure', getAzureConfigHandler(deps.prisma));
  router.post('/settings/azure', setAzureConfigHandler(deps.prisma));
  router.get('/settings/azure/validate', validateAzureConfigHandler(deps.prisma));

  return router;
};

export const createPublicRouter = (deps: RouteDeps) => {
  const router = Router();

  router.get('/health', healthHandler(deps.config));
  router.get(
    '/t/:token',
    trackTokenHandler(deps.prisma, deps.config, deps.graphClient, deps.logger),
  );
  router.get('/landing', landingHandler());

  return router;
};
