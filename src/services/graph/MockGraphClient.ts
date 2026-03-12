import { Config } from '../../utils/config';
import { Logger } from '../../utils/logger';

import {
  GraphClient,
  GraphEmailMessage,
  GraphSendResult,
  GraphSender,
  GraphRecipient,
} from './GraphClient';

export class MockGraphClient implements GraphClient {
  private logger: Logger;
  private config: Config;

  constructor(config: Config, logger: Logger) {
    this.logger = logger.child({ service: 'graph', mode: 'mock' });
    this.config = config;
  }

  async sendMail(message: GraphEmailMessage): Promise<GraphSendResult> {
    this.logger.info('mock_send_mail', {
      to: message.to,
      subject: message.subject,
      from: message.from,
      contentType: message.contentType,
    });

    return { id: `mock-${Date.now()}` };
  }

  async listSenders(): Promise<GraphSender[]> {
    if (this.config.graphSenderAddress) {
      const displayName = this.config.tenantName?.trim()
        ? `${this.config.tenantName.trim()} Sender`
        : 'Mock Sender';

      return [{ email: this.config.graphSenderAddress, displayName }];
    }

    return [];
  }

  async listRecipients(): Promise<GraphRecipient[]> {
    return [
      { email: 'alex.rauch@example.com', displayName: 'Alex Rauch', department: 'Security' },
      { email: 'mira.kline@example.com', displayName: 'Mira Kline', department: 'Finance' },
      { email: 'noah.berg@example.com', displayName: 'Noah Berg', department: 'Engineering' },
    ];
  }

  async listDepartments(): Promise<string[]> {
    return ['Engineering', 'Finance', 'Security'];
  }

  async getTenantName(): Promise<string | null> {
    return this.config.tenantName || null;
  }
}
