import { Request, Response } from 'express';

import { GraphClient } from '../services/graph/GraphClient';

export const listRecipientsHandler = (graphClient: GraphClient) => {
  return async (req: Request, res: Response) => {
    const department = req.query.department ? String(req.query.department) : undefined;
    const recipients = await graphClient.listRecipients({ department });
    res.json(recipients);
  };
};

export const listDepartmentsHandler = (graphClient: GraphClient) => {
  return async (_req: Request, res: Response) => {
    const departments = await graphClient.listDepartments();
    res.json(departments);
  };
};
