import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { docketTypesApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatDate } from '../lib/utils';

interface DocketType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  slaDays?: number | null;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
}

function errorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string | string[] } } };
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (message) return message;
  return fallback;
}

export default function DocketTypes() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState<DocketType | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    slaDays: '',
    requiresApproval: false,
    isActive: true,
  });

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    code: '',
    description: '',
    slaDays: '',
    requiresApproval: false,
    isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['docket-types'],
    queryFn: () => docketTypesApi.list({ includeInactive: true }),
  });

  const docketTypes: DocketType[] = data?.data?.data || data?.data || [];

  const createMutation = useMutation({
    mutationFn: () => docketTypesApi.create({
      name: createForm.name.trim(),
      code: createForm.code.trim().toUpperCase(),
      description: createForm.description.trim() || undefined,
      slaDays: createForm.slaDays ? Number(createForm.slaDays) : undefined,
      requiresApproval: createForm.requiresApproval,
      isActive: createForm.isActive,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket-types'] });
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        code: '',
        description: '',
        slaDays: '',
        requiresApproval: false,
        isActive: true,
      });
    },
    onError: (error) => alert(errorMessage(error, 'Failed to create docket type')),
  });

  const updateMutation = useMutation({
    mutationFn: () => docketTypesApi.update(editForm.id, {
      name: editForm.name.trim(),
      code: editForm.code.trim().toUpperCase(),
      description: editForm.description.trim() || undefined,
      slaDays: editForm.slaDays ? Number(editForm.slaDays) : undefined,
      requiresApproval: editForm.requiresApproval,
      isActive: editForm.isActive,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket-types'] });
      setShowEditModal(false);
      setSelectedType(null);
    },
    onError: (error) => alert(errorMessage(error, 'Failed to update docket type')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => docketTypesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket-types'] });
      setShowEditModal(false);
      setSelectedType(null);
    },
    onError: (error) => alert(errorMessage(error, 'Failed to delete docket type')),
  });

  const openEdit = (type: DocketType) => {
    setEditForm({
      id: type.id,
      name: type.name,
      code: type.code,
      description: type.description || '',
      slaDays: type.slaDays ? String(type.slaDays) : '',
      requiresApproval: type.requiresApproval,
      isActive: type.isActive,
    });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Docket Types</h1>
          <p className="text-muted-foreground">Manage document type master data and SLA defaults</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Docket Types</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : docketTypes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No docket types found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Code</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">SLA Days</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Approval</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Created</th>
                    <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docketTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{type.name}</div>
                        <div className="text-sm text-muted-foreground">{type.description || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 rounded bg-muted">{type.code}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{type.slaDays ?? '-'}</td>
                      <td className="px-4 py-3 text-sm">{type.requiresApproval ? 'Required' : 'Optional'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            type.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {type.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(type.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedType(type)}>
                          View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(type)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Create Docket Type</h2>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input required value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input required value={createForm.code} onChange={(e) => setCreateForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                    rows={3}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SLA Days</Label>
                  <Input type="number" min={0} value={createForm.slaDays} onChange={(e) => setCreateForm((p) => ({ ...p, slaDays: e.target.value }))} />
                </div>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createForm.requiresApproval}
                    onChange={(e) => setCreateForm((p) => ({ ...p, requiresApproval: e.target.checked }))}
                  />
                  Requires approval
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Type'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
            >
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Edit Docket Type</h2>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input required value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input required value={editForm.code} onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SLA Days</Label>
                  <Input type="number" min={0} value={editForm.slaDays} onChange={(e) => setEditForm((p) => ({ ...p, slaDays: e.target.value }))} />
                </div>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.requiresApproval}
                    onChange={(e) => setEditForm((p) => ({ ...p, requiresApproval: e.target.checked }))}
                  />
                  Requires approval
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
              <div className="flex justify-between p-4 border-t">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Delete this docket type?')) {
                      deleteMutation.mutate(editForm.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedType(null)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{selectedType.name}</h2>
                  <p className="text-muted-foreground">{selectedType.code}</p>
                </div>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedType(null)}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Description:</span> {selectedType.description || '-'}</p>
                <p><span className="text-muted-foreground">SLA Days:</span> {selectedType.slaDays ?? '-'}</p>
                <p><span className="text-muted-foreground">Requires Approval:</span> {selectedType.requiresApproval ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">Status:</span> {selectedType.isActive ? 'Active' : 'Inactive'}</p>
                <p><span className="text-muted-foreground">Created:</span> {formatDate(selectedType.createdAt)}</p>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedType(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setSelectedType(null);
                    openEdit(selectedType);
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
