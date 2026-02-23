import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { docketsApi } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getStatusColor, getPriorityColor, formatDate } from '../../lib/utils';

export default function DocketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showQr, setShowQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);

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

  const closeMutation = useMutation({
    mutationFn: () => docketsApi.close(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['docket', id] }),
  });

  const loadQrCode = async () => {
    if (!id) return;
    try {
      const response = await docketsApi.getQrCode(id);
      const url = URL.createObjectURL(response.data);
      setQrImage(url);
      setShowQr(true);
    } catch {
      console.error('Failed to load QR code');
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

  const d = docket.data;
  const actions = allowedActions?.data || [];

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadQrCode}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            QR Code
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
            <Button className="w-full mt-4" onClick={() => setShowQr(false)}>
              Close
            </Button>
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
                    {d.createdBy?.firstName || d.createdBy?.username}
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
                {d.currentAssignment && (
                  <div>
                    <span className="text-muted-foreground">Assigned to:</span>
                    <span className="ml-2">
                      {d.currentAssignment.assignedTo?.firstName ||
                        d.currentAssignment.assignedTo?.username}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attachments</CardTitle>
              <Button variant="outline" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload
              </Button>
            </CardHeader>
            <CardContent>
              {(attachments?.data?.length ?? 0) > 0 ? (
                <ul className="space-y-2">
                  {attachments?.data?.map((att: { id: string; fileName: string; fileSize: number }) => (
                    <li key={att.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{att.fileName}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {(att.fileSize / 1024).toFixed(1)} KB
                      </span>
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
            <CardContent>
              {(comments?.data?.length ?? 0) > 0 ? (
                <ul className="space-y-4">
                  {comments?.data?.map((comment: {
                    id: string;
                    content: string;
                    createdAt: string;
                    createdBy: { firstName?: string; username: string };
                  }) => (
                    <li key={comment.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                          {(comment.createdBy.firstName?.[0] || comment.createdBy.username[0]).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm">
                          {comment.createdBy.firstName || comment.createdBy.username}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </li>
                  ))}
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
              {actions.includes('forward') && (
                <Button variant="outline" className="w-full justify-start">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Forward
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
                  Approve
                </Button>
              )}
              {actions.includes('reject') && (
                <Button variant="destructive" className="w-full justify-start">
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
                  Close
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
                    createdAt: string;
                    performedBy: { firstName?: string; username: string };
                  }) => (
                    <li key={entry.id} className="flex gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{entry.action}</span>
                          {' by '}
                          {entry.performedBy?.firstName || entry.performedBy?.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.createdAt)}
                        </p>
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
    </div>
  );
}
