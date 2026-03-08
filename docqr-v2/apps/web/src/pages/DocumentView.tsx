import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import DocumentEditor from '../components/DocumentEditor';
import { Button } from '../components/ui/button';
import { docketsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/csv',
  'text/csv',
]);

function isPdf(mimeType: string, fileName: string): boolean {
  return mimeType.toLowerCase().includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
}

function isImage(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

function isText(mimeType: string, fileName: string): boolean {
  const normalized = mimeType.toLowerCase();
  if (TEXT_MIME_TYPES.has(normalized)) return true;
  if (TEXT_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;

  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith('.txt')
    || lowerName.endsWith('.csv')
    || lowerName.endsWith('.json')
    || lowerName.endsWith('.xml')
    || lowerName.endsWith('.md');
}

export default function DocumentView() {
  const { attachmentId } = useParams<{ attachmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestedMode = (searchParams.get('mode') || 'view') as 'view' | 'edit';
  const mode = requestedMode === 'edit' && hasPermission('attachment:edit') ? 'edit' : 'view';
  const docketId = searchParams.get('docketId');
  const fileName = searchParams.get('name') || 'Document';

  useEffect(() => {
    if (mode !== 'view' || !attachmentId) {
      return;
    }

    if (!docketId) {
      setError('Docket context is missing for this document. Please open it from the docket details page.');
      setBlobUrl(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    docketsApi.downloadAttachment(docketId, attachmentId)
      .then((response) => {
        if (isCancelled) return;

        const blob = response.data as Blob;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setMimeType(blob.type || '');
      })
      .catch((downloadError: unknown) => {
        if (isCancelled) return;

        const apiError = downloadError as { response?: { data?: { message?: string } } };
        const message = apiError.response?.data?.message || 'Unable to load the attachment for viewing.';
        setError(message);
        setBlobUrl(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [mode, docketId, attachmentId]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (!attachmentId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Invalid attachment ID</p>
      </div>
    );
  }

  if (mode === 'view') {
    const showPdf = blobUrl ? isPdf(mimeType, fileName) : false;
    const showImage = blobUrl ? isImage(mimeType) : false;
    const showText = blobUrl ? isText(mimeType, fileName) : false;

    const triggerDownload = () => {
      if (!blobUrl) return;
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
    };

    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
            <div>
              <h2 className="font-semibold">{fileName}</h2>
              <p className="text-xs text-muted-foreground">View Mode</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={triggerDownload} disabled={!blobUrl}>
            Download
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-muted/10">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-sm text-muted-foreground">Loading document preview...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="max-w-md text-center">
                <h3 className="text-lg font-semibold mb-2">Unable to open document</h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => navigate(-1)}>Back</Button>
              </div>
            </div>
          ) : !blobUrl ? (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground">No preview available for this file.</p>
            </div>
          ) : showPdf || showText ? (
            <iframe
              src={blobUrl}
              title={fileName}
              className="w-full h-full border-0"
            />
          ) : showImage ? (
            <div className="h-full flex items-center justify-center p-6">
              <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-4">
              <div className="max-w-md text-center">
                <h3 className="text-lg font-semibold mb-2">Preview not supported for this file type</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This attachment can be downloaded and opened in a local app.
                </p>
                <Button onClick={triggerDownload}>Download File</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <DocumentEditor
      attachmentId={attachmentId}
      fileName={fileName}
      mode={mode}
      onClose={() => navigate(-1)}
    />
  );
}
