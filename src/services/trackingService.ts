import { PrismaClient } from '@prisma/client';

import { Logger } from '../utils/logger';

export type TrackInfo = {
  ip?: string | null;
  userAgent?: string | null;
  tenantName?: string | null;
};

export const trackToken = async (
  prisma: PrismaClient,
  logger: Logger,
  token: string,
  info: TrackInfo,
) => {
  const recipient = await prisma.recipient.findUnique({ where: { token } });

  if (!recipient || recipient.tokenExpiresAt < new Date()) {
    await prisma.auditLog.create({
      data: {
        action: 'track_miss',
        entity: 'recipient',
        entityId: recipient?.id,
        meta: { token },
      },
    });

    logger.warn('track_miss', { token });
    return { recipientFound: false };
  }

  await prisma.clickEvent.create({
    data: {
      recipient: { connect: { id: recipient.id } },
      tenantName: info.tenantName || null,
      ip: info.ip || null,
      userAgent: info.userAgent || null,
    },
  });

  return { recipientFound: true };
};
