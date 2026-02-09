import { Request, Response } from 'express';

import { Config } from '../utils/config';

export const healthHandler = (config: Config) => {
  return (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      mockMode: config.graphMockMode,
    });
  };
};
