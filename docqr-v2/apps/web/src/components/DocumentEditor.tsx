import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { onlyOfficeApi } from '../lib/api';
import { Button } from './ui/button';

interface DocumentEditorProps {
  attachmentId: string;
  fileName: string;
  mode?: 'view' | 'edit';
  onClose: () => void;
}

declare global {
  interface Window {
    DocsAPI: any;
  }
}

export default function DocumentEditor({
  attachmentId,
  fileName,
  mode = 'edit',
  onClose,
}: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch editor configuration
  const { data: configData, isLoading, isError } = useQuery({
    queryKey: ['onlyoffice-config', attachmentId, mode],
    queryFn: () => onlyOfficeApi.getEditorConfig(attachmentId, mode),
  });

  // Load OnlyOffice script
  useEffect(() => {
    if (!configData?.data?.onlyOfficeUrl) return;

    const existingScript = document.querySelector(`script[src="${configData.data.onlyOfficeUrl}"]`);
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = configData.data.onlyOfficeUrl;
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
    };
    script.onerror = () => {
      setError('Failed to load OnlyOffice editor. Make sure OnlyOffice Document Server is running.');
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script on unmount as it may be reused
    };
  }, [configData?.data?.onlyOfficeUrl]);

  // Initialize editor when script is loaded and config is ready
  useEffect(() => {
    if (!scriptLoaded || !configData?.data?.config || !editorRef.current) return;
    if (!window.DocsAPI) {
      setError('OnlyOffice API not available. Please check if the Document Server is running.');
      return;
    }

    try {
      const docEditor = new window.DocsAPI.DocEditor('onlyoffice-editor', configData.data.config);

      return () => {
        if (docEditor) {
          docEditor.destroyEditor();
        }
      };
    } catch (err) {
      console.error('Failed to initialize OnlyOffice editor:', err);
      setError('Failed to initialize document editor.');
    }
  }, [scriptLoaded, configData?.data?.config]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card p-8 rounded-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading document editor...</p>
        </div>
      </div>
    );
  }

  if (isError || error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card p-8 rounded-lg text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Unable to Load Editor</h3>
          <p className="text-muted-foreground mb-4">
            {error || 'Failed to load document editor configuration.'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Make sure OnlyOffice Document Server is running on port 8080.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <div>
            <h2 className="font-semibold">{fileName}</h2>
            <p className="text-xs text-muted-foreground">
              {mode === 'edit' ? 'Editing' : 'Viewing'} - Changes are saved automatically
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs rounded ${mode === 'edit' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {mode === 'edit' ? 'Edit Mode' : 'View Mode'}
          </span>
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 overflow-hidden">
        <div
          id="onlyoffice-editor"
          ref={editorRef}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
