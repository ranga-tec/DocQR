export interface ScannedDocument {
  file: File;
  metadata: {
    scannerProvider: string;
    scannerDevice?: string;
    resolutionDpi?: number;
    colorMode?: string;
    pageCount?: number;
  };
}

interface ScannerProvider {
  name: string;
  isAvailable(): boolean;
  scan(): Promise<ScannedDocument>;
}

declare global {
  interface Window {
    Dynamsoft?: unknown;
  }
}

class DynamsoftTwainProvider implements ScannerProvider {
  name = 'dynamsoft-webtwain';

  isAvailable(): boolean {
    return Boolean(window.Dynamsoft);
  }

  async scan(): Promise<ScannedDocument> {
    throw new Error(
      'Dynamsoft WebTWAIN SDK is detected but not configured for browser capture in this deployment.',
    );
  }
}

class LocalScannerBridgeProvider implements ScannerProvider {
  name = 'local-scanner-bridge';

  private get bridgeUrl(): string | undefined {
    return import.meta.env.VITE_SCANNER_BRIDGE_URL;
  }

  isAvailable(): boolean {
    return Boolean(this.bridgeUrl);
  }

  async scan(): Promise<ScannedDocument> {
    const url = this.bridgeUrl;
    if (!url) {
      throw new Error('Scanner bridge URL is not configured.');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        output: 'pdf',
      }),
    });

    if (!response.ok) {
      throw new Error(`Scanner bridge request failed: ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const ext = contentType.includes('image') ? 'png' : 'pdf';
    const file = new File([blob], `scan-${Date.now()}.${ext}`, { type: contentType });

    return {
      file,
      metadata: {
        scannerProvider: this.name,
        scannerDevice: response.headers.get('x-scanner-device') || undefined,
        resolutionDpi: Number(response.headers.get('x-scanner-dpi') || 0) || undefined,
        colorMode: response.headers.get('x-scanner-color-mode') || undefined,
        pageCount: Number(response.headers.get('x-scanner-pages') || 0) || undefined,
      },
    };
  }
}

const providers: ScannerProvider[] = [
  new LocalScannerBridgeProvider(),
  new DynamsoftTwainProvider(),
];

export function isDirectScannerAvailable(): boolean {
  return providers.some((provider) => provider.isAvailable());
}

export async function scanDocumentFromProvider(): Promise<ScannedDocument> {
  const availableProviders = providers.filter((provider) => provider.isAvailable());
  if (availableProviders.length === 0) {
    throw new Error(
      'No direct scanner integration is configured. Set VITE_SCANNER_BRIDGE_URL or install a TWAIN bridge.',
    );
  }

  const errors: string[] = [];
  for (const provider of availableProviders) {
    try {
      return await provider.scan();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(`All scanner providers failed. ${errors.join(' | ')}`);
}

export function pickScannedFile(): Promise<ScannedDocument> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.tif,.tiff';
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();

      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      resolve({
        file,
        metadata: {
          scannerProvider: 'manual-file',
          pageCount: 1,
        },
      });
    };

    input.onerror = () => {
      input.remove();
      reject(new Error('File picker failed'));
    };

    document.body.appendChild(input);
    input.click();
  });
}
