import { PrismaClient, Template } from '@prisma/client';

export type CreateTemplateInput = {
  name: string;
  subject: string;
  body: string;
};

export const createTemplate = async (
  prisma: PrismaClient,
  input: CreateTemplateInput,
): Promise<Template> => {
  return prisma.template.create({ data: input });
};

export const listTemplates = async (prisma: PrismaClient): Promise<Template[]> => {
  return prisma.template.findMany({ orderBy: { createdAt: 'desc' } });
};

export const updateTemplate = async (
  prisma: PrismaClient,
  templateId: string,
  input: CreateTemplateInput,
): Promise<Template> => {
  return prisma.template.update({
    where: { id: templateId },
    data: input,
  });
};

export const deleteTemplate = async (
  prisma: PrismaClient,
  templateId: string,
): Promise<boolean> => {
  const campaignCount = await prisma.campaign.count({ where: { templateId } });

  if (campaignCount > 0) {
    return false;
  }

  await prisma.template.delete({ where: { id: templateId } });
  return true;
};
