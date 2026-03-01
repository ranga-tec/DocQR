import { Injectable } from '@nestjs/common';
import {
  SigningDispatchResult,
  SigningProvider,
  SigningRequestInput,
} from './signing-provider.interface';

@Injectable()
export class NoopSigningProvider implements SigningProvider {
  code = 'placeholder';
  name = 'Placeholder Provider';

  isConfigured(): boolean {
    return false;
  }

  async dispatchRequest(_input: SigningRequestInput): Promise<SigningDispatchResult> {
    return {
      accepted: false,
      message: 'Digital signing provider is not configured. Add a third-party provider integration.',
    };
  }
}
