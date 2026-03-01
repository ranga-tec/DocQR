import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { registersApi, departmentsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatDate } from '../lib/utils';

interface Register {
  id: string;
  name: string;
  registerCode: string;
  description?: string;
  departmentId?: string;
  department?: { id: string; name: string; code: string };
  registerType: string;
  yearStart?: string;
  yearEnd?: string;
  isActive: boolean;
  createdAt: string;
  creator?: { id: string; username: string; firstName?: string; lastName?: string };
  _count?: { entries: number };
}

interface RegisterEntry {
  id: string;
  registerId: string;
  register?: { id: string; name: string; registerCode: string };
  entryNumber: string;
  entryDate: string;
  subject: string;
  fromParty?: string;
  toParty?: string;
  remarks?: string;
  docketId?: string;
  docket?: { id: string; docketNumber: string; subject: string; status: string };
  createdAt: string;
  creator?: { id: string; username: string };
}

interface Stats {
  totalRegisters: number;
  activeRegisters: number;
  totalEntries: number;
  recentEntries: number;
  byType: Record<string, number>;
}

const REGISTER_TYPES = [
  { value: 'inward', label: 'Inward Register' },
  { value: 'outward', label: 'Outward Register' },
  { value: 'contract', label: 'Contract Register' },
  { value: 'general', label: 'General Register' },
];

function parseError(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { message?: string | string[] } } };
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (message) return message;
  return fallback;
}

export default function Registers() {
  const [activeTab, setActiveTab] = useState<'registers' | 'entries'>('registers');
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditRegisterModal, setShowEditRegisterModal] = useState(false);
  const [showCreateEntryModal, setShowCreateEntryModal] = useState(false);
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RegisterEntry | null>(null);
  const [filterRegisterId, setFilterRegisterId] = useState<string>('');
  const [searchEntries, setSearchEntries] = useState('');
  const [entriesPage, setEntriesPage] = useState(1);
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null);
  const queryClient = useQueryClient();

  // Form state for creating register
  const [registerForm, setRegisterForm] = useState({
    name: '',
    registerCode: '',
    description: '',
    departmentId: '',
    registerType: 'inward' as const,
  });

  // Form state for creating entry
  const [entryForm, setEntryForm] = useState({
    registerId: '',
    entryNumber: '',
    entryDate: new Date().toISOString().split('T')[0],
    subject: '',
    fromParty: '',
    toParty: '',
    remarks: '',
    docketId: '',
  });

  const [editRegisterForm, setEditRegisterForm] = useState({
    id: '',
    name: '',
    registerCode: '',
    description: '',
    departmentId: '',
    registerType: 'inward' as 'inward' | 'outward' | 'contract' | 'general',
    isActive: true,
  });

  const [editEntryForm, setEditEntryForm] = useState({
    id: '',
    registerId: '',
    entryNumber: '',
    entryDate: new Date().toISOString().split('T')[0],
    subject: '',
    fromParty: '',
    toParty: '',
    remarks: '',
    docketId: '',
  });

  // Queries
  const { data: registersData, isLoading: registersLoading } = useQuery({
    queryKey: ['registers'],
    queryFn: () => registersApi.list(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['registers-stats'],
    queryFn: () => registersApi.getStats(),
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['register-entries', filterRegisterId, searchEntries, entriesPage],
    queryFn: () => registersApi.listEntries({
      registerId: filterRegisterId || undefined,
      search: searchEntries || undefined,
      page: entriesPage,
      limit: 20,
    }),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });

  const { data: nextEntryNumberData } = useQuery({
    queryKey: ['register-next-entry-number', entryForm.registerId],
    queryFn: () => registersApi.getNextEntryNumber(entryForm.registerId),
    enabled: showCreateEntryModal && !!entryForm.registerId,
  });

  const registers = registersData?.data?.data || registersData?.data || [];
  const stats: Stats = statsData?.data?.data || statsData?.data || { totalRegisters: 0, activeRegisters: 0, totalEntries: 0, recentEntries: 0, byType: {} };
  const entries = entriesData?.data?.data || [];
  const entriesTotal = entriesData?.data?.meta?.total || entriesData?.data?.total || 0;
  const entriesTotalPages = entriesData?.data?.meta?.totalPages || entriesData?.data?.totalPages || 1;
  const departments = departmentsData?.data?.data || departmentsData?.data || [];

  const nextEntryNumber =
    typeof nextEntryNumberData?.data === 'string'
      ? nextEntryNumberData.data
      : nextEntryNumberData?.data?.nextEntryNumber;

  useEffect(() => {
    if (!showCreateEntryModal) return;
    if (!entryForm.registerId) return;
    const next = nextEntryNumber;
    if (!next || entryForm.entryNumber.trim()) return;
    setEntryForm((prev) => ({ ...prev, entryNumber: String(next) }));
  }, [
    showCreateEntryModal,
    entryForm.registerId,
    entryForm.entryNumber,
    nextEntryNumber,
  ]);

  // Mutations
  const createRegisterMutation = useMutation({
    mutationFn: (data: typeof registerForm) => registersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      queryClient.invalidateQueries({ queryKey: ['registers-stats'] });
      setShowCreateModal(false);
      setRegisterForm({ name: '', registerCode: '', description: '', departmentId: '', registerType: 'inward' });
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to create register'));
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: (data: typeof entryForm) => registersApi.createEntry({
      ...data,
      entryDate: new Date(data.entryDate).toISOString(),
      docketId: data.docketId.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-entries'] });
      queryClient.invalidateQueries({ queryKey: ['registers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setShowCreateEntryModal(false);
      setEntryForm({
        registerId: '',
        entryNumber: '',
        entryDate: new Date().toISOString().split('T')[0],
        subject: '',
        fromParty: '',
        toParty: '',
        remarks: '',
        docketId: '',
      });
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to create register entry'));
    },
  });

  const updateRegisterMutation = useMutation({
    mutationFn: () =>
      registersApi.update(editRegisterForm.id, {
        name: editRegisterForm.name.trim(),
        description: editRegisterForm.description.trim() || undefined,
        departmentId: editRegisterForm.departmentId || undefined,
        registerType: editRegisterForm.registerType,
        isActive: editRegisterForm.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      queryClient.invalidateQueries({ queryKey: ['registers-stats'] });
      setShowEditRegisterModal(false);
      setSelectedRegister(null);
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to update register'));
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: () =>
      registersApi.updateEntry(editEntryForm.id, {
        entryDate: new Date(editEntryForm.entryDate).toISOString(),
        subject: editEntryForm.subject.trim(),
        fromParty: editEntryForm.fromParty.trim() || undefined,
        toParty: editEntryForm.toParty.trim() || undefined,
        remarks: editEntryForm.remarks.trim() || undefined,
        docketId: editEntryForm.docketId.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-entries'] });
      queryClient.invalidateQueries({ queryKey: ['registers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setShowEditEntryModal(false);
      setSelectedEntry(null);
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to update register entry'));
    },
  });

  const deleteRegisterMutation = useMutation({
    mutationFn: (id: string) => registersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      queryClient.invalidateQueries({ queryKey: ['registers-stats'] });
      setSelectedRegister(null);
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to delete register'));
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => registersApi.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-entries'] });
      queryClient.invalidateQueries({ queryKey: ['registers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      setSelectedEntry(null);
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to delete register entry'));
    },
  });

  const unlinkDocketMutation = useMutation({
    mutationFn: (entryId: string) => registersApi.unlinkDocket(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register-entries'] });
      setSelectedEntry((prev) => (prev ? { ...prev, docket: undefined, docketId: undefined } : prev));
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to unlink docket'));
    },
  });

  const handleCreateRegister = (e: React.FormEvent) => {
    e.preventDefault();
    createRegisterMutation.mutate({
      ...registerForm,
      name: registerForm.name.trim(),
      registerCode: registerForm.registerCode.trim().toUpperCase(),
      description: registerForm.description.trim(),
    });
  };

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    createEntryMutation.mutate(entryForm);
  };

  const openEditRegister = (register: Register) => {
    setEditRegisterForm({
      id: register.id,
      name: register.name,
      registerCode: register.registerCode,
      description: register.description || '',
      departmentId: register.departmentId || '',
      registerType: register.registerType as 'inward' | 'outward' | 'contract' | 'general',
      isActive: register.isActive,
    });
    setShowEditRegisterModal(true);
  };

  const openEditEntry = (entry: RegisterEntry) => {
    setEditEntryForm({
      id: entry.id,
      registerId: entry.registerId,
      entryNumber: entry.entryNumber,
      entryDate: String(entry.entryDate).slice(0, 10),
      subject: entry.subject,
      fromParty: entry.fromParty || '',
      toParty: entry.toParty || '',
      remarks: entry.remarks || '',
      docketId: entry.docketId || '',
    });
    setShowEditEntryModal(true);
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const extractFileName = (contentDisposition?: string, fallback = 'register-entries-export') => {
    if (!contentDisposition) return fallback;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const regularMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    if (regularMatch?.[1]) {
      return regularMatch[1];
    }

    return fallback;
  };

  const handleExportEntries = async (format: 'excel' | 'pdf') => {
    setExportingFormat(format);
    try {
      const params = {
        registerId: filterRegisterId || undefined,
        search: searchEntries || undefined,
      };

      const response = format === 'excel'
        ? await registersApi.exportEntriesExcel(params)
        : await registersApi.exportEntriesPdf(params);

      const fallbackName = format === 'excel'
        ? `register-entries-${new Date().toISOString().slice(0, 10)}.xlsx`
        : `register-entries-${new Date().toISOString().slice(0, 10)}.pdf`;
      const fileName = extractFileName(response.headers?.['content-disposition'] as string | undefined, fallbackName);
      downloadBlob(response.data as Blob, fileName);
    } catch {
      alert('Failed to export register entries. Please try again.');
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Physical Registers</h1>
          <p className="text-muted-foreground">Manage physical document registers and entries</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'registers' ? (
            <Button onClick={() => setShowCreateModal(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Register
            </Button>
          ) : (
            <Button onClick={() => setShowCreateEntryModal(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalRegisters}</p>
                <p className="text-sm text-muted-foreground">Total Registers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeRegisters}</p>
                <p className="text-sm text-muted-foreground">Active Registers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEntries}</p>
                <p className="text-sm text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.recentEntries}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('registers')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'registers'
                ? 'border-primary text-primary'
                : 'border-transparent hover:border-muted-foreground/30'
            }`}
          >
            Registers
          </button>
          <button
            onClick={() => setActiveTab('entries')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'entries'
                ? 'border-primary text-primary'
                : 'border-transparent hover:border-muted-foreground/30'
            }`}
          >
            Entries
          </button>
        </div>
      </div>

      {/* Registers Tab */}
      {activeTab === 'registers' && (
        <Card>
          <CardHeader>
            <CardTitle>All Registers</CardTitle>
          </CardHeader>
          <CardContent>
            {registersLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : registers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-lg font-medium mb-2">No registers yet</p>
                <p className="mb-4">Create your first physical register to get started</p>
                <Button onClick={() => setShowCreateModal(true)}>Create Register</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {registers.map((reg: Register) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedRegister(reg)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{reg.name}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                            {reg.registerCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{reg.registerType}</span>
                          {reg.department && (
                            <>
                              <span>•</span>
                              <span>{reg.department.name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{reg._count?.entries || 0} entries</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          reg.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {reg.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Button variant="ghost" size="sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Entries Tab */}
      {activeTab === 'entries' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Register Entries</CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={filterRegisterId}
                  onChange={(e) => {
                    setFilterRegisterId(e.target.value);
                    setEntriesPage(1);
                  }}
                  className="px-3 py-2 rounded-md border bg-background text-sm"
                >
                  <option value="">All Registers</option>
                  {registers.map((reg: Register) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name} ({reg.registerCode})
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Search entries..."
                  value={searchEntries}
                  onChange={(e) => {
                    setSearchEntries(e.target.value);
                    setEntriesPage(1);
                  }}
                  className="w-64"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportEntries('excel')}
                  disabled={exportingFormat !== null}
                >
                  {exportingFormat === 'excel' ? 'Exporting...' : 'Excel'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportEntries('pdf')}
                  disabled={exportingFormat !== null}
                >
                  {exportingFormat === 'pdf' ? 'Exporting...' : 'PDF'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {entriesLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No entries found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium">Entry #</th>
                        <th className="text-left px-4 py-3 text-sm font-medium">Date</th>
                        <th className="text-left px-4 py-3 text-sm font-medium">Subject</th>
                        <th className="text-left px-4 py-3 text-sm font-medium">From</th>
                        <th className="text-left px-4 py-3 text-sm font-medium">To</th>
                        <th className="text-left px-4 py-3 text-sm font-medium">Register</th>
                        <th className="text-left px-4 py-3 text-sm font-medium">Linked Docket</th>
                        <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entries.map((entry: RegisterEntry) => (
                        <tr key={entry.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{entry.entryNumber}</td>
                          <td className="px-4 py-3 text-sm">{formatDate(entry.entryDate)}</td>
                          <td className="px-4 py-3 text-sm max-w-xs truncate">{entry.subject}</td>
                          <td className="px-4 py-3 text-sm">{entry.fromParty || '-'}</td>
                          <td className="px-4 py-3 text-sm">{entry.toParty || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="text-xs px-2 py-0.5 rounded bg-muted">
                              {entry.register?.registerCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {entry.docket ? (
                              <a
                                href={`/dockets/${entry.docket.id}`}
                                className="text-primary hover:underline"
                              >
                                {entry.docket.docketNumber}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEntry(entry)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {entriesTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {((entriesPage - 1) * 20) + 1} to {Math.min(entriesPage * 20, entriesTotal)} of {entriesTotal} entries
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={entriesPage === 1}
                        onClick={() => setEntriesPage(entriesPage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={entriesPage === entriesTotalPages}
                        onClick={() => setEntriesPage(entriesPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Register Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateRegister}>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Create Physical Register</h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="regName">Register Name *</Label>
                      <Input
                        id="regName"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="regCode">Register Code *</Label>
                      <Input
                        id="regCode"
                        value={registerForm.registerCode}
                        onChange={(e) => setRegisterForm({ ...registerForm, registerCode: e.target.value.toUpperCase() })}
                        placeholder="e.g., INW-2024"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="regType">Register Type *</Label>
                    <select
                      id="regType"
                      value={registerForm.registerType}
                      onChange={(e) => setRegisterForm({ ...registerForm, registerType: e.target.value as typeof registerForm.registerType })}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                      required
                    >
                      {REGISTER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="regDept">Department</Label>
                    <select
                      id="regDept"
                      value={registerForm.departmentId}
                      onChange={(e) => setRegisterForm({ ...registerForm, departmentId: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                    >
                      <option value="">No Department</option>
                      {departments.map((dept: { id: string; name: string }) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="regDesc">Description</Label>
                    <textarea
                      id="regDesc"
                      value={registerForm.description}
                      onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRegisterMutation.isPending}>
                  {createRegisterMutation.isPending ? 'Creating...' : 'Create Register'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Entry Modal */}
      {showCreateEntryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateEntryModal(false)}
        >
          <div
            className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateEntry}>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Add Register Entry</h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entryRegister">Register *</Label>
                    <select
                      id="entryRegister"
                      value={entryForm.registerId}
                      onChange={(e) => setEntryForm({
                        ...entryForm,
                        registerId: e.target.value,
                        entryNumber: '',
                      })}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                      required
                    >
                      <option value="">Select Register</option>
                      {registers.filter((r: Register) => r.isActive).map((reg: Register) => (
                        <option key={reg.id} value={reg.id}>
                          {reg.name} ({reg.registerCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entryNumber">Entry Number *</Label>
                      <Input
                        id="entryNumber"
                        value={entryForm.entryNumber}
                        onChange={(e) => setEntryForm({ ...entryForm, entryNumber: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entryDate">Entry Date *</Label>
                      <Input
                        id="entryDate"
                        type="date"
                        value={entryForm.entryDate}
                        onChange={(e) => setEntryForm({ ...entryForm, entryDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="entrySubject">Subject *</Label>
                    <Input
                      id="entrySubject"
                      value={entryForm.subject}
                      onChange={(e) => setEntryForm({ ...entryForm, subject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entryFrom">From Party</Label>
                      <Input
                        id="entryFrom"
                        value={entryForm.fromParty}
                        onChange={(e) => setEntryForm({ ...entryForm, fromParty: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entryTo">To Party</Label>
                      <Input
                        id="entryTo"
                        value={entryForm.toParty}
                        onChange={(e) => setEntryForm({ ...entryForm, toParty: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="entryRemarks">Remarks</Label>
                    <textarea
                      id="entryRemarks"
                      value={entryForm.remarks}
                      onChange={(e) => setEntryForm({ ...entryForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="entryDocketId">Link to Docket ID (Optional)</Label>
                    <Input
                      id="entryDocketId"
                      value={entryForm.docketId}
                      onChange={(e) => setEntryForm({ ...entryForm, docketId: e.target.value })}
                      placeholder="Paste docket UUID to link"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateEntryModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createEntryMutation.isPending}>
                  {createEntryMutation.isPending ? 'Adding...' : 'Add Entry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Detail Modal */}
      {selectedRegister && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedRegister(null)}
        >
          <div
            className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{selectedRegister.name}</h2>
                    <p className="text-muted-foreground">{selectedRegister.registerCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRegister(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {selectedRegister.description && (
                  <div>
                    <label className="text-sm text-muted-foreground">Description</label>
                    <p className="font-medium">{selectedRegister.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Type</label>
                    <p className="font-medium capitalize">{selectedRegister.registerType}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <p>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          selectedRegister.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {selectedRegister.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Department</label>
                    <p className="font-medium">{selectedRegister.department?.name || 'None'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Total Entries</label>
                    <p className="font-medium">{selectedRegister._count?.entries || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Created</label>
                    <p className="font-medium">{formatDate(selectedRegister.createdAt)}</p>
                  </div>
                  {selectedRegister.creator && (
                    <div>
                      <label className="text-sm text-muted-foreground">Created By</label>
                      <p className="font-medium">
                        {selectedRegister.creator.firstName || selectedRegister.creator.username}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this register?')) {
                      deleteRegisterMutation.mutate(selectedRegister.id);
                    }
                  }}
                  disabled={deleteRegisterMutation.isPending || (selectedRegister._count?.entries || 0) > 0}
                >
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setSelectedRegister(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    openEditRegister(selectedRegister);
                    setSelectedRegister(null);
                  }}
                >
                  Edit Register
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">Entry #{selectedEntry.entryNumber}</h2>
                  <p className="text-muted-foreground">{selectedEntry.register?.name}</p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Subject</label>
                  <p className="font-medium">{selectedEntry.subject}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Entry Date</label>
                    <p className="font-medium">{formatDate(selectedEntry.entryDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Register</label>
                    <p className="font-medium">{selectedEntry.register?.registerCode}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">From Party</label>
                    <p className="font-medium">{selectedEntry.fromParty || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">To Party</label>
                    <p className="font-medium">{selectedEntry.toParty || '-'}</p>
                  </div>
                </div>

                {selectedEntry.remarks && (
                  <div>
                    <label className="text-sm text-muted-foreground">Remarks</label>
                    <p className="font-medium">{selectedEntry.remarks}</p>
                  </div>
                )}

                {selectedEntry.docket && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <label className="text-sm text-muted-foreground">Linked Docket</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-medium">{selectedEntry.docket.docketNumber}</span>
                      <span className="text-sm text-muted-foreground">-</span>
                      <span className="text-sm">{selectedEntry.docket.subject}</span>
                    </div>
                    <a
                      href={`/dockets/${selectedEntry.docket.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View Docket
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                {selectedEntry.docket && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('Unlink this entry from the docket?')) {
                        unlinkDocketMutation.mutate(selectedEntry.id);
                      }
                    }}
                    disabled={unlinkDocketMutation.isPending}
                  >
                    {unlinkDocketMutation.isPending ? 'Unlinking...' : 'Unlink Docket'}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Delete this register entry?')) {
                      deleteEntryMutation.mutate(selectedEntry.id);
                    }
                  }}
                  disabled={deleteEntryMutation.isPending}
                >
                  {deleteEntryMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
                <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    openEditEntry(selectedEntry);
                    setSelectedEntry(null);
                  }}
                >
                  Edit Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Register Modal */}
      {showEditRegisterModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowEditRegisterModal(false)}
        >
          <div
            className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRegisterMutation.mutate();
              }}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Edit Register</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="editRegCode">Register Code</Label>
                    <Input id="editRegCode" value={editRegisterForm.registerCode} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editRegName">Register Name *</Label>
                    <Input
                      id="editRegName"
                      value={editRegisterForm.name}
                      onChange={(e) => setEditRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editRegType">Register Type *</Label>
                    <select
                      id="editRegType"
                      value={editRegisterForm.registerType}
                      onChange={(e) =>
                        setEditRegisterForm((prev) => ({
                          ...prev,
                          registerType: e.target.value as 'inward' | 'outward' | 'contract' | 'general',
                        }))
                      }
                      className="w-full px-3 py-2 rounded-md border bg-background"
                      required
                    >
                      {REGISTER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editRegDept">Department</Label>
                    <select
                      id="editRegDept"
                      value={editRegisterForm.departmentId}
                      onChange={(e) => setEditRegisterForm((prev) => ({ ...prev, departmentId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                    >
                      <option value="">No Department</option>
                      {departments.map((dept: { id: string; name: string }) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editRegDescription">Description</Label>
                    <textarea
                      id="editRegDescription"
                      value={editRegisterForm.description}
                      onChange={(e) => setEditRegisterForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                      rows={3}
                    />
                  </div>
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editRegisterForm.isActive}
                      onChange={(e) => setEditRegisterForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowEditRegisterModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRegisterMutation.isPending}>
                  {updateRegisterMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {showEditEntryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowEditEntryModal(false)}
        >
          <div
            className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateEntryMutation.mutate();
              }}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Edit Register Entry</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Entry Number</Label>
                      <Input value={editEntryForm.entryNumber} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Register</Label>
                      <Input value={registers.find((reg: Register) => reg.id === editEntryForm.registerId)?.registerCode || '-'} disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEntryDate">Entry Date *</Label>
                    <Input
                      id="editEntryDate"
                      type="date"
                      value={editEntryForm.entryDate}
                      onChange={(e) => setEditEntryForm((prev) => ({ ...prev, entryDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEntrySubject">Subject *</Label>
                    <Input
                      id="editEntrySubject"
                      value={editEntryForm.subject}
                      onChange={(e) => setEditEntryForm((prev) => ({ ...prev, subject: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editEntryFrom">From Party</Label>
                      <Input
                        id="editEntryFrom"
                        value={editEntryForm.fromParty}
                        onChange={(e) => setEditEntryForm((prev) => ({ ...prev, fromParty: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editEntryTo">To Party</Label>
                      <Input
                        id="editEntryTo"
                        value={editEntryForm.toParty}
                        onChange={(e) => setEditEntryForm((prev) => ({ ...prev, toParty: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEntryRemarks">Remarks</Label>
                    <textarea
                      id="editEntryRemarks"
                      value={editEntryForm.remarks}
                      onChange={(e) => setEditEntryForm((prev) => ({ ...prev, remarks: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEntryDocketId">Docket ID (Optional)</Label>
                    <Input
                      id="editEntryDocketId"
                      value={editEntryForm.docketId}
                      onChange={(e) => setEditEntryForm((prev) => ({ ...prev, docketId: e.target.value }))}
                      placeholder="Paste docket UUID to link"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to keep the current docket link. Use Unlink in entry details to remove.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowEditEntryModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateEntryMutation.isPending}>
                  {updateEntryMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
