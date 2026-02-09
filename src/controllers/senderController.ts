import { Request, Response } from 'express';

import { GraphClient } from '../services/graph/GraphClient';

export const listSendersHandler = (graphClient: GraphClient) => {
  return async (_req: Request, res: Response) => {
    const senders = await graphClient.listSenders();
    res.json(senders);
  };
};
