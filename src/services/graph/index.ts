import { Config } from '../../utils/config';
import { Logger } from '../../utils/logger';

import { GraphClient } from './GraphClient';
import { MockGraphClient } from './MockGraphClient';
import { MsGraphClient } from './MsGraphClient';

export const createGraphClient = (config: Config, logger: Logger): GraphClient => {
  if (config.graphMockMode) {
    return new MockGraphClient(config, logger);
  }

  return new MsGraphClient(config, logger);
};
