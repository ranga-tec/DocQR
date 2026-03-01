import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { docketsApi, usersApi, docketTypesApi } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { isDirectScannerAvailable, pickScannedFile, scanDocumentFromProvider } from '../../lib/scanner';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function CreateDocket() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    docketTypeId: '',
    priority: 'NORMAL',
    assignToUserId: '',
    // Sender information
    senderName: '',
    senderOrganization: '',
    senderEmail: '',
    senderPhone: '',
    senderAddress: '',
    receivedDate: new Date().toISOString().split('T')[0],
  });
  const [showSenderDetails, setShowSenderDetails] = useState(false);
  const [initialAttachments, setInitialAttachments] = useState<Array<{
    file: File;
    source: 'upload' | 'scanner';
    metadata?: {
      scannerProvider?: string;
      scannerDevice?: string;
      resolutionDpi?: number;
      colorMode?: string;
      pageCount?: number;
    };
  }>>([]);
  const [scanError, setScanError] = useState('');
  const [error, setError] = useState('');

  const { data: docketTypes } = useQuery({
    queryKey: ['docketTypes'],
    queryFn: () => docketTypesApi.list(),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: Parameters<typeof docketsApi.create>[0]) => {
      const response = await docketsApi.create(data);
      const docketId: string = response.data.id;

      if (initialAttachments.length > 0) {
        await Promise.all(
          initialAttachments.map((item) => {
            if (item.source === 'scanner') {
              return docketsApi.scanAttachment(docketId, item.file, item.metadata);
            }
            return docketsApi.uploadAttachment(docketId, item.file);
          }),
        );
      }

      return response;
    },
    onSuccess: (response) => {
      navigate(`/dockets/${response.data.id}`);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create docket');
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate({
      subject: formData.subject,
      description: formData.description || undefined,
      docketTypeId: formData.docketTypeId || undefined,
      priority: formData.priority,
      assignToUserId: formData.assignToUserId || undefined,
      // Sender information
      senderName: formData.senderName || undefined,
      senderOrganization: formData.senderOrganization || undefined,
      senderEmail: formData.senderEmail || undefined,
      senderPhone: formData.senderPhone || undefined,
      senderAddress: formData.senderAddress || undefined,
      receivedDate: formData.receivedDate ? new Date(formData.receivedDate).toISOString() : undefined,
    });
  };

  const handleUploadSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setInitialAttachments((prev) => [
        ...prev,
        ...files.map((file) => ({ file, source: 'upload' as const })),
      ]);
    }
    event.target.value = '';
  };

  const handleScan = async () => {
    setScanError('');
    try {
      const scanned = isDirectScannerAvailable()
        ? await scanDocumentFromProvider()
        : await pickScannedFile();

      setInitialAttachments((prev) => [
        ...prev,
        {
          file: scanned.file,
          source: 'scanner',
          metadata: scanned.metadata,
        },
      ]);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scanner action failed');
    }
  };

  const removeAttachment = (index: number) => {
    setInitialAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Docket</CardTitle>
          <CardDescription>
            Fill in the details below to create a new document docket
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                placeholder="Brief description of the docket"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Detailed description (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="docketTypeId">Docket Type</Label>
                <select
                  id="docketTypeId"
                  name="docketTypeId"
                  value={formData.docketTypeId}
                  onChange={handleChange}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select type...</option>
                  {docketTypes?.data?.data?.map((type: { id: string; name: string }) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignToUserId">Assign To (Optional)</Label>
              <select
                id="assignToUserId"
                name="assignToUserId"
                value={formData.assignToUserId}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Do not assign yet</option>
                {users?.data?.data?.map((user: { id: string; firstName?: string; lastName?: string; username: string }) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName
                      ? `${user.firstName} ${user.lastName || ''}`
                      : user.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <Label>Initial Documents (Optional)</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.ods,.png,.jpg,.jpeg,.tif,.tiff"
                  onChange={handleUploadSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Add Files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScan}
                  title={isDirectScannerAvailable()
                    ? 'Scan directly from configured scanner integration'
                    : 'No direct scanner connector found, file picker will open'}
                >
                  Scan Document
                </Button>
              </div>
              {scanError && (
                <p className="text-sm text-destructive">{scanError}</p>
              )}
              {initialAttachments.length > 0 && (
                <ul className="space-y-2 rounded-md border p-3">
                  {initialAttachments.map((item, index) => (
                    <li key={`${item.file.name}-${index}`} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.file.name}</span>
                        <span className="ml-2 text-muted-foreground">({item.source})</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeAttachment(index)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sender Information Section */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSenderDetails(!showSenderDetails)}
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium">Sender Information</span>
                  {formData.senderName && (
                    <span className="text-sm text-muted-foreground">({formData.senderName})</span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 transition-transform ${showSenderDetails ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showSenderDetails && (
                <div className="p-4 space-y-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="senderName">Sender Name</Label>
                      <Input
                        id="senderName"
                        name="senderName"
                        value={formData.senderName}
                        onChange={handleChange}
                        placeholder="Name of sender"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderOrganization">Organization</Label>
                      <Input
                        id="senderOrganization"
                        name="senderOrganization"
                        value={formData.senderOrganization}
                        onChange={handleChange}
                        placeholder="Organization name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="senderEmail">Email</Label>
                      <Input
                        id="senderEmail"
                        name="senderEmail"
                        type="email"
                        value={formData.senderEmail}
                        onChange={handleChange}
                        placeholder="sender@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderPhone">Phone</Label>
                      <Input
                        id="senderPhone"
                        name="senderPhone"
                        type="tel"
                        value={formData.senderPhone}
                        onChange={handleChange}
                        placeholder="+1234567890"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="senderAddress">Address</Label>
                    <textarea
                      id="senderAddress"
                      name="senderAddress"
                      value={formData.senderAddress}
                      onChange={handleChange}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Full address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receivedDate">Date Received</Label>
                    <Input
                      id="receivedDate"
                      name="receivedDate"
                      type="date"
                      value={formData.receivedDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Docket'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
