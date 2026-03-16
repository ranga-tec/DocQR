import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { docketsApi } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getStatusColor, getPriorityColor, formatDate } from '../../lib/utils';
import { isDirectScannerAvailable, pickScannedFile, scanDocumentFromProvider } from '../../lib/scanner';
import { normalizeDocket } from '../../lib/docket';
import ForwardModal from '../../components/ForwardModal';
import ReturnModal from '../../components/ReturnModal';
import RejectModal from '../../components/RejectModal';
import { useAuth } from '../../context/AuthContext';

// File extensions supported by OnlyOffice for editing
const EDITABLE_EXTENSIONS = ['doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp'];
const VIEWABLE_EXTENSIONS = [...EDITABLE_EXTENSIONS, 'pdf', 'djvu', 'xps', 'epub'];

function isFileEditable(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EDITABLE_EXTENSIONS.includes(ext);
}

function isFileViewable(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return VIEWABLE_EXTENSIONS.includes(ext);
}

interface CommentNode {
  id: string;
  content: string;
  createdAt: string;
  isInternal?: boolean;
  parentCommentId?: string | null;
  attachment?: { id: string; originalFileName: string } | null;
  author?: { id: string; username: string; firstName?: string } | null;
  replies?: CommentNode[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function DocketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [showQr, setShowQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isQrPrinting, setIsQrPrinting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [scanError, setScanError] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [isInternalComment, setIsInternalComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const canEditAttachment = hasPermission('attachment:edit');
  const canUploadAttachment = hasPermission('attachment:upload');
  const canDownloadAttachment = hasPermission('attachment:download') || hasPermission('attachment:view') || canEditAttachment;
  const canDeleteAttachment = canEditAttachment;
  const canForwardDocket = hasPermission('docket:forward');
  const canCommentDocket = hasPermission('docket:comment');

  useEffect(() => {
    return () => {
      if (qrImage) {
        URL.revokeObjectURL(qrImage);
      }
    };
  }, [qrImage]);

  const { data: docket, isLoading } = useQuery({
    queryKey: ['docket', id],
    queryFn: () => docketsApi.get(id!),
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ['docket', id, 'history'],
    queryFn: () => docketsApi.getHistory(id!),
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ['docket', id, 'comments'],
    queryFn: () => docketsApi.getComments(id!),
    enabled: !!id,
  });

  const { data: attachments } = useQuery({
    queryKey: ['docket', id, 'attachments'],
    queryFn: () => docketsApi.getAttachments(id!),
    enabled: !!id,
  });

  const { data: allowedActions } = useQuery({
    queryKey: ['docket', id, 'actions'],
    queryFn: () => docketsApi.getAllowedActions(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => docketsApi.approve(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['docket', id] }),
  });

  const acceptMutation = useMutation({
    mutationFn: () => docketsApi.accept(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket', id] });
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'history'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => docketsApi.close(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['docket', id] }),
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: () => docketsApi.submitForApproval(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket', id] });
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'history'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => docketsApi.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket', id] });
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'history'] });
    },
  });

  const forwardMutation = useMutation({
    mutationFn: (data: { toUserId?: string; toDepartmentId?: string; instructions?: string }) =>
      docketsApi.forward(id!, data),
    onSuccess: () => {
      setShowForwardModal(false);
      queryClient.invalidateQueries({ queryKey: ['docket', id] });
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'history'] });
    },
  });

  const returnMutation = useMutation({
    mutationFn: (data?: { reason?: string; notes?: string }) =>
      docketsApi.return(id!, data),
    onSuccess: () => {
      setShowReturnModal(false);
      queryClient.invalidateQueries({ queryKey: ['docket', id] });
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'history'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { reason: string; notes?: string }) =>
      docketsApi.reject(id!, data),
    onSuccess: () => {
      setShowRejectModal(false);
      queryClient.invalidateQueries({ queryKey: ['docket', id] });
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'history'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => docketsApi.uploadAttachment(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'attachments'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: (payload: {
      file: File;
      metadata?: {
        scannerProvider?: string;
        scannerDevice?: string;
        resolutionDpi?: number;
        colorMode?: string;
        pageCount?: number;
      };
    }) => docketsApi.scanAttachment(id!, payload.file, payload.metadata),
    onSuccess: () => {
      setScanError('');
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'attachments'] });
    },
    onError: () => {
      setScanError('Scanner upload failed. Please try again.');
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => docketsApi.deleteAttachment(id!, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'attachments'] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (payload: {
      content: string;
      file?: File | null;
      parentCommentId?: string | null;
      isInternal?: boolean;
    }) => {
      if (payload.file) {
        return docketsApi.addCommentWithAttachment(id!, {
          file: payload.file,
          content: payload.content,
          parentCommentId: payload.parentCommentId || undefined,
          isInternal: payload.isInternal,
        });
      }

      return docketsApi.addComment(id!, {
        content: payload.content,
        parentCommentId: payload.parentCommentId || undefined,
        isInternal: payload.isInternal,
      });
    },
    onSuccess: () => {
      setNewComment('');
      setCommentFile(null);
      setReplyToCommentId(null);
      setIsInternalComment(false);
      queryClient.invalidateQueries({ queryKey: ['docket', id, 'comments'] });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    // Reset input so the same file can be selected again
    event.target.value = '';
  };

  const handleScan = async () => {
    setScanError('');

    try {
      let scanned: Awaited<ReturnType<typeof scanDocumentFromProvider>>;
      if (isDirectScannerAvailable()) {
        try {
          scanned = await scanDocumentFromProvider();
        } catch (providerError) {
          const providerMessage = providerError instanceof Error ? providerError.message : 'unknown provider error';
          scanned = await pickScannedFile();
          setScanError(`Direct scanner unavailable (${providerMessage}). Please select a scanned file.`);
        }
      } else {
        scanned = await pickScannedFile();
      }

      scanMutation.mutate({
        file: scanned.file,
        metadata: scanned.metadata,
      });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Scanner action failed');
    }
  };

  const getQrImageUrl = async () => {
    if (!id) {
      throw new Error('Missing docket id');
    }

    if (qrImage) {
      return qrImage;
    }

    const response = await docketsApi.getQrCode(id);
    const url = URL.createObjectURL(response.data);
    setQrImage(url);
    return url;
  };

  const loadQrCode = async () => {
    setIsQrLoading(true);
    try {
      await getQrImageUrl();
      setShowQr(true);
    } catch (error) {
      console.error('Failed to load QR code', error);
    } finally {
      setIsQrLoading(false);
    }
  };

  const printQrCode = async () => {
    setIsQrPrinting(true);
    try {
      const qrUrl = await getQrImageUrl();
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';

      const cleanup = () => {
        window.setTimeout(() => {
          printFrame.remove();
        }, 0);
      };

      document.body.appendChild(printFrame);

      const printWindow = printFrame.contentWindow;
      const printDocument = printWindow?.document;

      if (!printWindow || !printDocument) {
        cleanup();
        throw new Error('Unable to create print window');
      }

      printWindow.addEventListener('afterprint', cleanup, { once: true });

      printDocument.open();
      printDocument.write(`
        <!doctype html>
        <html>
          <head>
            <title>Print QR</title>
            <style>
              body {
                margin: 0;
                font-family: Arial, sans-serif;
                color: #111827;
              }
              main {
                min-height: 100vh;
                display: grid;
                place-items: center;
                padding: 32px;
              }
              .sheet {
                text-align: center;
              }
              h1 {
                margin: 0 0 8px;
                font-size: 22px;
              }
              p {
                margin: 0 0 24px;
                color: #4b5563;
                font-size: 14px;
              }
              img {
                width: 320px;
                height: 320px;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <main>
              <section class="sheet">
                <h1>${escapeHtml(d.subject)}</h1>
                <p>${escapeHtml(d.docketNumber)}</p>
                <img
                  src="${qrUrl}"
                  alt="QR Code"
                  onload="window.focus(); setTimeout(function () { window.print(); }, 150);"
                />
              </section>
            </main>
          </body>
        </html>
      `);
      printDocument.close();

      window.setTimeout(cleanup, 3000);
    } catch (error) {
      console.error('Failed to print QR code', error);
    } finally {
      setIsQrPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!docket?.data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Docket not found</h2>
        <Button onClick={() => navigate('/dockets')}>Back to Dockets</Button>
      </div>
    );
  }

  const docketPayload = (docket.data && typeof docket.data === 'object' && 'data' in docket.data)
    ? (docket.data as { data: unknown }).data
    : docket.data;
  const d = normalizeDocket(docketPayload);
  const actions = Array.isArray(allowedActions?.data)
    ? allowedActions.data.map((entry: unknown) => {
        if (typeof entry === 'string') return entry;
        const obj = entry as { action?: string };
        return obj?.action || '';
      }).filter(Boolean)
    : [];
  const commentTree: CommentNode[] = comments?.data || [];

  const renderCommentNode = (comment: CommentNode, depth = 0): React.ReactNode => (
    <li key={comment.id} className="border-b pb-4 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
          {(comment.author?.firstName?.[0] || comment.author?.username?.[0] || '?').toUpperCase()}
        </div>
        <span className="font-medium text-sm">
          {comment.author?.firstName || comment.author?.username || 'Unknown'}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(comment.createdAt)}
        </span>
        {comment.isInternal ? (
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">Internal</span>
        ) : null}
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
      {comment.attachment ? (
        <div className="mt-2">
          {canDownloadAttachment ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                docketsApi.downloadAttachment(id!, comment.attachment!.id).then((response) => {
                  const url = URL.createObjectURL(response.data);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = comment.attachment?.originalFileName || 'comment-attachment';
                  a.click();
                  URL.revokeObjectURL(url);
                });
              }}
            >
              Attachment: {comment.attachment.originalFileName}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Attachment available</span>
          )}
        </div>
      ) : null}
      {canCommentDocket ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReplyToCommentId(comment.id)}
          >
            Reply
          </Button>
        </div>
      ) : null}
      {(comment.replies?.length ?? 0) > 0 ? (
        <ul className={`space-y-3 mt-3 ${depth >= 0 ? 'pl-5 border-l' : ''}`}>
          {comment.replies!.map((reply) => renderCommentNode(reply, depth + 1))}
        </ul>
      ) : null}
    </li>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-mono">{d.docketNumber}</span>
            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(d.status)}`}>
              {d.status.replace('_', ' ')}
            </span>
            <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(d.priority)}`}>
              {d.priority}
            </span>
          </div>
          <h1 className="text-2xl font-bold mt-2">{d.subject}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadQrCode} disabled={isQrLoading || isQrPrinting}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            {isQrLoading ? 'Loading QR...' : 'QR Code'}
          </Button>
          <Button variant="outline" onClick={printQrCode} disabled={isQrPrinting || isQrLoading}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V4h12v5M6 14h12M8 18h8M8 14V9h8v5" />
            </svg>
            {isQrPrinting ? 'Preparing Print...' : 'Print QR'}
          </Button>
        </div>
      </div>

      {/* QR Modal */}
      {showQr && qrImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQr(false)}>
          <div className="bg-card p-6 rounded-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Docket QR Code</h3>
            <img src={qrImage} alt="QR Code" className="w-64 h-64" />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Scan to view this docket
            </p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" variant="outline" onClick={printQrCode} disabled={isQrPrinting}>
                {isQrPrinting ? 'Preparing Print...' : 'Print'}
              </Button>
              <Button className="flex-1" onClick={() => setShowQr(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {d.description || 'No description provided'}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created by:</span>
                  <span className="ml-2 font-medium">
                    {d.creator?.firstName || d.creator?.username}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <span className="ml-2">{formatDate(d.createdAt)}</span>
                </div>
                {d.docketType && (
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-2">{d.docketType.name}</span>
                  </div>
                )}
                {d.currentAssignee && (
                  <div>
                    <span className="text-muted-foreground">Assigned to:</span>
                    <span className="ml-2">
                      {d.currentAssignee?.firstName || d.currentAssignee?.username}
                    </span>
                  </div>
                )}
                {d.currentDepartment && (
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <span className="ml-2">{d.currentDepartment.name}</span>
                  </div>
                )}
                {d.currentAssignment?.assignedBy && (
                  <div>
                    <span className="text-muted-foreground">Sent by:</span>
                    <span className="ml-2">
                      {d.currentAssignment.assignedBy.firstName || d.currentAssignment.assignedBy.username}
                    </span>
                  </div>
                )}
                {d.receivedDate && (
                  <div>
                    <span className="text-muted-foreground">Received:</span>
                    <span className="ml-2">{formatDate(d.receivedDate)}</span>
                  </div>
                )}
                {d.progressSummary && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2 font-medium">{d.progressSummary}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sender Information */}
          {(d.senderName || d.senderOrganization) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Sender Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {d.senderName && (
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium">{d.senderName}</span>
                    </div>
                  )}
                  {d.senderOrganization && (
                    <div>
                      <span className="text-muted-foreground">Organization:</span>
                      <span className="ml-2">{d.senderOrganization}</span>
                    </div>
                  )}
                  {d.senderEmail && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <a href={`mailto:${d.senderEmail}`} className="ml-2 text-primary hover:underline">
                        {d.senderEmail}
                      </a>
                    </div>
                  )}
                  {d.senderPhone && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <a href={`tel:${d.senderPhone}`} className="ml-2 text-primary hover:underline">
                        {d.senderPhone}
                      </a>
                    </div>
                  )}
                  {d.senderAddress && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="ml-2">{d.senderAddress}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attachments</CardTitle>
              {canUploadAttachment ? (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScan}
                    disabled={scanMutation.isPending}
                    title={isDirectScannerAvailable()
                      ? 'Scan directly from configured scanner integration'
                      : 'No direct scanner connector found, file picker will open'}
                  >
                    {scanMutation.isPending ? (
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V4h12v5M6 14h12M8 19h8" />
                      </svg>
                    )}
                    {scanMutation.isPending ? 'Scanning...' : 'Scan'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {scanError && (
                <div className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {scanError}
                </div>
              )}
              {(attachments?.data?.length ?? 0) > 0 ? (
                <ul className="space-y-2">
                  {attachments?.data?.map((att: {
                    id: string;
                    originalFileName: string;
                    fileName: string;
                    fileSize: string | number;
                    ingestionSource?: string;
                    extractedContent?: {
                      status?: string;
                      extractionMethod?: string;
                      processedAt?: string;
                    };
                  }) => (
                    <li key={att.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div className="flex flex-col">
                          <span>{att.originalFileName || att.fileName}</span>
                          <span className="text-xs text-muted-foreground">
                            Source: {att.ingestionSource || 'upload'}
                            {att.extractedContent?.status && (
                              <> | OCR: {att.extractedContent.status}</>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground mr-2">
                          {(Number(att.fileSize) / 1024).toFixed(1)} KB
                        </span>
                        {/* View button - for viewable documents */}
                        {isFileViewable(att.originalFileName || att.fileName) && (
                          <Link
                            to={`/document/${att.id}?mode=view&docketId=${encodeURIComponent(id || '')}&name=${encodeURIComponent(att.originalFileName || att.fileName)}`}
                          >
                            <Button variant="ghost" size="sm" title="View Document">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Button>
                          </Link>
                        )}
                        {/* Edit button - for editable documents */}
                        {canEditAttachment && isFileEditable(att.originalFileName || att.fileName) && (
                          <Link
                            to={`/document/${att.id}?mode=edit&docketId=${encodeURIComponent(id || '')}&name=${encodeURIComponent(att.originalFileName || att.fileName)}`}
                          >
                            <Button variant="ghost" size="sm" title="Edit Document">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Button>
                          </Link>
                        )}
                        {/* Download button */}
                        {canDownloadAttachment ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Download"
                            onClick={() => {
                              docketsApi.downloadAttachment(id!, att.id).then((response) => {
                                const url = URL.createObjectURL(response.data);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = att.originalFileName || att.fileName;
                                a.click();
                                URL.revokeObjectURL(url);
                              });
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </Button>
                        ) : null}
                        {/* Delete button */}
                        {canDeleteAttachment ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this attachment?')) {
                                deleteAttachmentMutation.mutate(att.id);
                              }
                            }}
                            disabled={deleteAttachmentMutation.isPending}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No attachments yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!canCommentDocket) return;
                  if (newComment.trim() || commentFile) {
                    addCommentMutation.mutate({
                      content: newComment.trim(),
                      file: commentFile,
                      parentCommentId: replyToCommentId,
                      isInternal: isInternalComment,
                    });
                  }
                }}
                className="space-y-2"
              >
                {canCommentDocket ? (
                  <>
                    {replyToCommentId ? (
                      <div className="text-xs text-muted-foreground">
                        Replying to comment
                        <button
                          type="button"
                          className="ml-2 text-primary hover:underline"
                          onClick={() => setReplyToCommentId(null)}
                        >
                          Cancel reply
                        </button>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment... Use @username to mention"
                        className="flex-1 px-3 py-2 border rounded-md bg-background text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => commentFileInputRef.current?.click()}
                      >
                        Attach
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={(!newComment.trim() && !commentFile) || addCommentMutation.isPending}
                      >
                        {addCommentMutation.isPending ? 'Posting...' : 'Post'}
                      </Button>
                    </div>
                    <input
                      type="file"
                      ref={commentFileInputRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setCommentFile(file);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isInternalComment}
                          onChange={(e) => setIsInternalComment(e.target.checked)}
                        />
                        Internal comment
                      </label>
                      {commentFile ? (
                        <span className="text-xs text-muted-foreground">
                          Attached: {commentFile.name}
                          <button
                            type="button"
                            className="ml-2 text-primary hover:underline"
                            onClick={() => setCommentFile(null)}
                          >
                            remove
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You have view-only access. Commenting is restricted for your role.
                  </p>
                )}
              </form>

              {/* Comments List */}
              {(commentTree.length ?? 0) > 0 ? (
                <ul className="space-y-4">
                  {commentTree.map((comment) => renderCommentNode(comment))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No comments yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canForwardDocket && actions.includes('forward') && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowForwardModal(true)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Forward
                </Button>
              )}
              {actions.includes('return') && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => setShowReturnModal(true)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  Return
                </Button>
              )}
              {actions.includes('approve') && (
                <Button
                  className="w-full justify-start bg-green-600 hover:bg-green-700"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {approveMutation.isPending ? 'Approving...' : 'Approve'}
                </Button>
              )}
              {actions.includes('accept') && (
                <Button
                  className="w-full justify-start"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {acceptMutation.isPending ? 'Accepting...' : 'Accept'}
                </Button>
              )}
              {actions.includes('submit_for_approval') && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => submitForApprovalMutation.mutate()}
                  disabled={submitForApprovalMutation.isPending}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m-4-4h8" />
                  </svg>
                  {submitForApprovalMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              )}
              {actions.includes('reject') && (
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => setShowRejectModal(true)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </Button>
              )}
              {actions.includes('close') && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  {closeMutation.isPending ? 'Closing...' : 'Close'}
                </Button>
              )}
              {actions.includes('reopen') && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => docketsApi.reopen(id!).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['docket', id] });
                    queryClient.invalidateQueries({ queryKey: ['docket', id, 'history'] });
                  })}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reopen
                </Button>
              )}
              {actions.includes('archive') && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l1 12h12l1-12M9 8V6h6v2" />
                  </svg>
                  {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
                </Button>
              )}
              {actions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No actions available
                </p>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {(history?.data?.length ?? 0) > 0 ? (
                <ul className="space-y-3">
                  {history?.data?.slice(0, 5).map((entry: {
                    id: string;
                    action: string;
                    description?: string;
                    notes?: string;
                    performedAt: string;
                    performedBy: { firstName?: string; username: string };
                  }) => (
                    <li key={entry.id} className="flex gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {entry.description || entry.action}
                        </p>
                        {entry.performedBy && (
                          <p className="text-xs text-muted-foreground">
                            By {entry.performedBy.firstName || entry.performedBy.username}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.performedAt)}
                        </p>
                        {entry.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  No history yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <ForwardModal
        isOpen={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        onSubmit={(data) => forwardMutation.mutate(data)}
        isLoading={forwardMutation.isPending}
      />

      <ReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onSubmit={(data) => returnMutation.mutate(data)}
        isLoading={returnMutation.isPending}
      />

      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onSubmit={(data) => rejectMutation.mutate(data)}
        isLoading={rejectMutation.isPending}
      />
    </div>
  );
}
