import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { docketsApi } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getStatusColor, getPriorityColor, formatDate } from '../lib/utils';

interface Docket {
  id: string;
  docketNumber: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
  createdBy?: {
    firstName?: string;
    lastName?: string;
    username: string;
  };
  docketType?: {
    name: string;
  };
}

export default function QrScan() {
  const { token } = useParams<{ token: string }>();
  const [docket, setDocket] = useState<Docket | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Invalid QR code');
      setIsLoading(false);
      return;
    }

    const fetchDocket = async () => {
      try {
        const response = await docketsApi.getByQrToken(token);
        setDocket(response.data);
      } catch {
        setError('Docket not found or QR code has expired');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocket();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading docket...</p>
        </div>
      </div>
    );
  }

  if (error || !docket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Docket Not Found</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link to="/login">
              <Button>Sign in to access dockets</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-bold">DOCQR</span>
            </div>
            <Link to="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-muted-foreground font-mono">{docket.docketNumber}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(docket.status)}`}>
                {docket.status.replace('_', ' ')}
              </span>
              <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(docket.priority)}`}>
                {docket.priority}
              </span>
            </div>
            <CardTitle>{docket.subject}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {docket.description && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                <p>{docket.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created by:</span>
                <p className="font-medium">
                  {docket.createdBy?.firstName
                    ? `${docket.createdBy.firstName} ${docket.createdBy.lastName || ''}`
                    : docket.createdBy?.username || 'Restricted'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p>{formatDate(docket.createdAt)}</p>
              </div>
              {docket.docketType && (
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p>{docket.docketType.name}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Sign in to view full details, attachments, and take actions on this docket.
              </p>
              <div className="flex justify-center mt-4">
                <Link to="/login">
                  <Button>Sign In for Full Access</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
