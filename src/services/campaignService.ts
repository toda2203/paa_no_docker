import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { Config } from '../utils/config';
import { Logger } from '../utils/logger';
import { GraphClient } from './graph/GraphClient';

export type CampaignRecipientInput = {
  email: string;
  azureObjectId?: string | null;
};

export type CreateCampaignInput = {
  name: string;
  templateId: string;
  senderEmail?: string;
  startDate?: string;
  endDate?: string;
  recipients: CampaignRecipientInput[];
};

export const createCampaign = async (
  prisma: PrismaClient,
  config: Config,
  input: CreateCampaignInput,
) => {
  const startDate = input.startDate ? new Date(input.startDate) : null;
  const endDate = input.endDate ? new Date(input.endDate) : null;

  if (startDate && Number.isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate');
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate');
  }

  if (startDate && endDate && startDate > endDate) {
    throw new Error('startDate must be before endDate');
  }

  const template = await prisma.template.findUnique({
    where: { id: input.templateId },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const tokenExpiresAt = endDate
    ? endDate
    : new Date(Date.now() + config.tokenTtlDays * 24 * 60 * 60 * 1000);

  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      templateId: input.templateId,
      senderEmail: input.senderEmail || null,
      startDate,
      endDate,
    },
  });

  await prisma.recipient.createMany({
    data: input.recipients.map((recipient) => ({
      email: recipient.email,
      azureObjectId: recipient.azureObjectId || null,
      token: uuidv4(),
      tokenExpiresAt,
      campaignId: campaign.id,
    })),
  });

  await prisma.auditLog.create({
    data: {
      action: 'campaign_created',
      entity: 'campaign',
      entityId: campaign.id,
      meta: { recipientCount: input.recipients.length },
    },
  });

  return {
    id: campaign.id,
    recipientCount: input.recipients.length,
  };
};

export const listCampaigns = async (prisma: PrismaClient) => {
  const campaigns = await prisma.campaign.findMany({
    include: {
      template: true,
      _count: { select: { recipients: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    templateId: campaign.templateId,
    templateName: campaign.template.name,
    senderEmail: campaign.senderEmail,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    createdAt: campaign.createdAt,
    startedAt: campaign.startedAt,
    recipientCount: campaign._count.recipients,
  }));
};

export const deleteCampaign = async (prisma: PrismaClient, campaignId: string) => {
  const recipients = await prisma.recipient.findMany({
    where: { campaignId },
    select: { id: true },
  });
  const recipientIds = recipients.map((recipient) => recipient.id);

  await prisma.$transaction([
    prisma.clickEvent.deleteMany({ where: { recipientId: { in: recipientIds } } }),
    prisma.recipient.deleteMany({ where: { campaignId } }),
    prisma.campaign.delete({ where: { id: campaignId } }),
  ]);
};

export const listCampaignClicks = async (prisma: PrismaClient, campaignId: string) => {
  const clicks = await prisma.clickEvent.findMany({
    where: { recipient: { campaignId } },
    include: { recipient: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const uniqueByRecipient = new Map<string, { click: (typeof clicks)[number]; count: number }>();
  for (const click of clicks) {
    const key = click.recipient?.id || click.id;
    const existing = uniqueByRecipient.get(key);
    if (!existing) {
      uniqueByRecipient.set(key, { click, count: 1 });
      continue;
    }
    existing.count += 1;
  }

  return Array.from(uniqueByRecipient.values()).map(({ click, count }) => ({
    id: click.id,
    recipientEmail: click.recipient?.email || 'unknown',
    tenantName: click.tenantName,
    ip: click.ip,
    userAgent: click.userAgent,
    createdAt: click.createdAt,
    clickCount: count,
  }));
};

export const listCampaignClickDetails = async (prisma: PrismaClient, campaignId: string) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, startedAt: true, createdAt: true, recipients: { select: { id: true } } },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const clicks = await prisma.clickEvent.findMany({
    where: { recipient: { campaignId } },
    include: { recipient: true },
    orderBy: { createdAt: 'asc' },
    take: 5000,
  });

  const byDay = new Map<string, number>();
  const perRecipient = new Map<string, { latest: (typeof clicks)[number]; count: number; first: (typeof clicks)[number] }>();

  for (const click of clicks) {
    const dayKey = click.createdAt.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);

    const recipientKey = click.recipient?.id || click.id;
    const existing = perRecipient.get(recipientKey);
    if (!existing) {
      perRecipient.set(recipientKey, { latest: click, first: click, count: 1 });
      continue;
    }
    existing.count += 1;
    existing.latest = click;
  }

  const baseTime = campaign.startedAt || campaign.createdAt;
  const firstClicks = Array.from(perRecipient.values()).map((entry) => entry.first);
  const firstClickAt = clicks[0]?.createdAt || null;
  const avgSeconds = firstClicks.length
    ? Math.round(
        firstClicks.reduce((sum, click) => sum + (click.createdAt.getTime() - baseTime.getTime()) / 1000, 0) /
          firstClicks.length,
      )
    : null;

  const items = Array.from(perRecipient.values()).map((entry) => ({
    id: entry.latest.id,
    recipientEmail: entry.latest.recipient?.email || 'unknown',
    tenantName: entry.latest.tenantName,
    ip: entry.latest.ip,
    userAgent: entry.latest.userAgent,
    createdAt: entry.latest.createdAt,
    clickCount: entry.count,
  }));

  return {
    items,
    byDay: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })),
    stats: {
      totalClicks: clicks.length,
      uniqueRecipients: perRecipient.size,
      firstClickAt,
      avgSeconds,
      recipientTotal: campaign.recipients.length,
    },
  };
};

export const listCampaignSummaries = async (prisma: PrismaClient) => {
  const campaigns = await prisma.campaign.findMany({
    include: {
      recipients: {
        select: { id: true, clickEvents: { select: { createdAt: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return campaigns.map((campaign) => {
    const baseTime = campaign.startedAt || campaign.createdAt;
    const perRecipient = campaign.recipients.map((recipient) => {
      const sorted = recipient.clickEvents.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      return sorted[0];
    });
    const clickedRecipients = perRecipient.filter(Boolean) as { createdAt: Date }[];
    const firstClickAt = clickedRecipients[0]?.createdAt || null;
    const avgSeconds = clickedRecipients.length
      ? Math.round(
          clickedRecipients.reduce(
            (sum, click) => sum + (click.createdAt.getTime() - baseTime.getTime()) / 1000,
            0,
          ) / clickedRecipients.length,
        )
      : null;

    return {
      id: campaign.id,
      name: campaign.name,
      recipientTotal: campaign.recipients.length,
      clickedRecipients: clickedRecipients.length,
      firstClickAt,
      avgSeconds,
    };
  });
};

export const startCampaign = async (
  prisma: PrismaClient,
  config: Config,
  graphClient: GraphClient,
  logger: Logger,
  campaignId: string,
) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true, recipients: true },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const now = new Date();
  if (campaign.startDate && now < campaign.startDate) {
    throw new Error('Campaign has not started yet');
  }

  if (campaign.endDate && now > campaign.endDate) {
    throw new Error('Campaign has already ended');
  }

  const trackingBase = config.publicBaseUrl.replace(/\/$/, '');
  const senderEmail = campaign.senderEmail || config.graphSenderAddress;

  if (!senderEmail) {
    throw new Error('Sender email is required to start a campaign');
  }

  for (const recipient of campaign.recipients) {
    const trackingUrl = `${trackingBase}/t/${recipient.token}`;
    const templateBody = campaign.template.body;
    const hasTrackingToken = /{{\s*tracking_url\s*}}/.test(templateBody);
    const resolvedBody = hasTrackingToken
      ? templateBody.replace(/{{\s*tracking_url\s*}}/g, trackingUrl)
      : `${templateBody}<br/><br/><a href="${trackingUrl}">${trackingUrl}</a>`;

    await graphClient.sendMail({
      from: senderEmail,
      to: [recipient.email],
      subject: campaign.template.subject,
      body: resolvedBody,
      contentType: 'HTML',
    });
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'STARTED', startedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      action: 'campaign_started',
      entity: 'campaign',
      entityId: campaign.id,
      meta: { sent: campaign.recipients.length },
    },
  });

  logger.info('campaign_started', { id: campaign.id, sent: campaign.recipients.length });

  return { sent: campaign.recipients.length };
};
