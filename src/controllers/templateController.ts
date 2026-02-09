import { Request, Response } from 'express';
import { z } from 'zod';

import { PrismaClient } from '@prisma/client';

import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from '../services/templateService';

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const createTemplateHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const payload = templateSchema.parse(req.body);
    const template = await createTemplate(prisma, payload);

    res.status(201).json(template);
  };
};

export const listTemplatesHandler = (prisma: PrismaClient) => {
  return async (_req: Request, res: Response) => {
    const templates = await listTemplates(prisma);
    res.json(templates);
  };
};

export const deleteTemplateHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const templateId = req.params.id;
    const deleted = await deleteTemplate(prisma, templateId);

    if (!deleted) {
      res.status(409).json({ error: 'template_has_campaigns' });
      return;
    }

    res.status(204).send();
  };
};

export const updateTemplateHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const templateId = req.params.id;
    const payload = templateSchema.parse(req.body);
    const template = await updateTemplate(prisma, templateId, payload);

    res.json(template);
  };
};
