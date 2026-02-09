import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const ttlDays = Number.parseInt(process.env.TOKEN_TTL_DAYS || '90', 10);
const now = new Date();
const tokenExpiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

async function main() {
  const template = await prisma.template.create({
    data: {
      name: 'Sample Template',
      subject: 'Security Awareness Check',
      body: 'Please review the attached message and confirm.',
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: 'Sample Campaign',
      templateId: template.id,
    },
  });

  await prisma.recipient.createMany({
    data: [
      {
        email: 'alice@example.com',
        azureObjectId: null,
        token: uuidv4(),
        tokenExpiresAt,
        campaignId: campaign.id,
      },
      {
        email: 'bob@example.com',
        azureObjectId: null,
        token: uuidv4(),
        tokenExpiresAt,
        campaignId: campaign.id,
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      action: 'seed',
      entity: 'campaign',
      entityId: campaign.id,
      meta: { templateId: template.id },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
