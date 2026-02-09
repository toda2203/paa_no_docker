import { Request, Response } from 'express';
import { z } from 'zod';

import { PrismaClient } from '@prisma/client';

import {
  createCampaign,
  deleteCampaign,
  listCampaignClickDetails,
  listCampaignSummaries,
  listCampaigns,
  startCampaign,
} from '../services/campaignService';
import { GraphClient } from '../services/graph/GraphClient';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';

const campaignSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().min(1),
  senderEmail: z.string().email().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        azureObjectId: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

export const createCampaignHandler = (prisma: PrismaClient, config: Config) => {
  return async (req: Request, res: Response) => {
    const payload = campaignSchema.parse(req.body);
    const campaign = await createCampaign(prisma, config, payload);

    res.status(201).json(campaign);
  };
};

export const listCampaignsHandler = (prisma: PrismaClient) => {
  return async (_req: Request, res: Response) => {
    const campaigns = await listCampaigns(prisma);
    res.json(campaigns);
  };
};

export const startCampaignHandler = (
  prisma: PrismaClient,
  config: Config,
  graphClient: GraphClient,
  logger: Logger,
) => {
  return async (req: Request, res: Response) => {
    const campaignId = req.params.id;
    const result = await startCampaign(prisma, config, graphClient, logger, campaignId);

    res.json(result);
  };
};

export const deleteCampaignHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const campaignId = req.params.id;
    await deleteCampaign(prisma, campaignId);
    res.status(204).send();
  };
};

export const listCampaignClicksHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const campaignId = req.params.id;
    const clicks = await listCampaignClickDetails(prisma, campaignId);
    res.json(clicks);
  };
};

export const listCampaignSummariesHandler = (prisma: PrismaClient) => {
  return async (_req: Request, res: Response) => {
    const summaries = await listCampaignSummaries(prisma);
    res.json(summaries);
  };
};
