export type GraphContentType = 'Text' | 'HTML';

export type GraphEmailMessage = {
  from: string;
  to: string[];
  subject: string;
  body: string;
  contentType: GraphContentType;
};

export type GraphSendResult = {
  id: string;
};

export type GraphSender = {
  email: string;
  displayName?: string | null;
};

export type GraphRecipient = {
  email: string;
  displayName?: string | null;
  department?: string | null;
};

export interface GraphClient {
  sendMail(message: GraphEmailMessage): Promise<GraphSendResult>;
  listSenders(): Promise<GraphSender[]>;
  listRecipients(options?: { department?: string }): Promise<GraphRecipient[]>;
  listDepartments(): Promise<string[]>;
  getTenantName(): Promise<string | null>;
}
