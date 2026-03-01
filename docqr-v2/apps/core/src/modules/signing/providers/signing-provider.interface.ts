export interface SigningRequestInput {
  docketNumber: string;
  attachmentName: string;
  signers: Array<{
    userId: string;
    order: number;
    role?: string;
  }>;
  expiresAt?: Date;
}

export interface SigningDispatchResult {
  accepted: boolean;
  externalRequestId?: string;
  message: string;
}

export interface SigningProvider {
  code: string;
  name: string;
  isConfigured(): boolean;
  dispatchRequest(input: SigningRequestInput): Promise<SigningDispatchResult>;
}
