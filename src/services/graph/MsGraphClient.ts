import { ConfidentialClientApplication } from '@azure/msal-node';

import { Config } from '../../utils/config';
import { Logger } from '../../utils/logger';

import {
  GraphClient,
  GraphEmailMessage,
  GraphSendResult,
  GraphSender,
  GraphRecipient,
} from './GraphClient';

export class MsGraphClient implements GraphClient {
  private app: ConfidentialClientApplication;
  private logger: Logger;
  private tenantNameCache: string | null = null;

  constructor(config: Config, logger: Logger) {
    this.logger = logger.child({ service: 'graph', mode: 'msal' });
    this.app = new ConfidentialClientApplication({
      auth: {
        clientId: config.azureClientId || '',
        authority: `https://login.microsoftonline.com/${config.azureTenantId}`,
        clientSecret: config.azureClientSecret || '',
      },
    });
  }

  private async getAccessToken(): Promise<string> {
    const result = await this.app.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });

    if (!result || !result.accessToken) {
      throw new Error('Failed to acquire Graph access token');
    }

    return result.accessToken;
  }

  async sendMail(message: GraphEmailMessage): Promise<GraphSendResult> {
    const accessToken = await this.getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      message.from,
    )}/sendMail`;

    const payload = {
      message: {
        subject: message.subject,
        body: {
          contentType: message.contentType,
          content: message.body,
        },
        toRecipients: message.to.map((email) => ({
          emailAddress: { address: email },
        })),
      },
      saveToSentItems: 'false',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error('graph_send_failed', { status: response.status, body });
      throw new Error('Graph sendMail failed');
    }

    return { id: response.headers.get('request-id') || 'graph-send' };
  }

  async listSenders(): Promise<GraphSender[]> {
    const accessToken = await this.getAccessToken();
    const url =
      'https://graph.microsoft.com/v1.0/users' +
      '?$select=mail,userPrincipalName,displayName,accountEnabled' +
      '&$filter=accountEnabled eq true' +
      '&$top=999';

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error('graph_list_senders_failed', { status: response.status, body });
      throw new Error('Graph listSenders failed');
    }

    const payload = (await response.json()) as {
      value?: Array<{
        mail?: string | null;
        userPrincipalName?: string | null;
        displayName?: string | null;
      }>;
    };

    return (payload.value || [])
      .map((user) => ({
        email: user.mail || user.userPrincipalName || '',
        displayName: user.displayName,
      }))
      .filter((user) => user.email);
  }

  async listRecipients(options: { department?: string } = {}): Promise<GraphRecipient[]> {
    const accessToken = await this.getAccessToken();
    const filters = ['accountEnabled eq true'];

    if (options.department) {
      const escaped = options.department.replace(/'/g, "''");
      filters.push(`department eq '${escaped}'`);
    }

    const url =
      'https://graph.microsoft.com/v1.0/users' +
      '?$select=mail,userPrincipalName,displayName,department,accountEnabled' +
      `&$filter=${encodeURIComponent(filters.join(' and '))}` +
      '&$top=999';

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error('graph_list_recipients_failed', { status: response.status, body });
      throw new Error('Graph listRecipients failed');
    }

    const payload = (await response.json()) as {
      value?: Array<{
        mail?: string | null;
        userPrincipalName?: string | null;
        displayName?: string | null;
        department?: string | null;
      }>;
    };

    return (payload.value || [])
      .map((user) => ({
        email: user.mail || user.userPrincipalName || '',
        displayName: user.displayName,
        department: user.department,
      }))
      .filter((user) => user.email);
  }

  async listDepartments(): Promise<string[]> {
    const recipients = await this.listRecipients();
    const set = new Set<string>();

    for (const recipient of recipients) {
      if (recipient.department) {
        set.add(recipient.department);
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  async getTenantName(): Promise<string | null> {
    if (this.tenantNameCache) {
      return this.tenantNameCache;
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error('graph_org_failed', { status: response.status, body });
      throw new Error('Graph getTenantName failed');
    }

    const payload = (await response.json()) as {
      value?: Array<{
        displayName?: string | null;
        verifiedDomains?: Array<{ name?: string | null } | null>;
      }>;
    };

    const org = payload.value?.[0];
    const displayName = org?.displayName || null;
    const domainName = org?.verifiedDomains?.find((domain) => domain?.name)?.name || null;
    const resolved = displayName || domainName;

    this.tenantNameCache = resolved || null;
    return this.tenantNameCache;
  }
}
