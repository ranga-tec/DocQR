import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, usersApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatDate } from '../lib/utils';

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string; code: string } | null;
  headUserId?: string | null;
  headUser?: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  } | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    userDepartments?: number;
    children?: number;
  };
}

interface UserOption {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

function parseError(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { message?: string | string[] } } };
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (message) return message;
  return fallback;
}

export default function Departments() {
  const queryClient = useQueryClient();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    parentId: '',
    headUserId: '',
  });

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    code: '',
    description: '',
    parentId: '',
    headUserId: '',
    isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-dept-head'],
    queryFn: () => usersApi.list({ page: 1, limit: 200 }),
  });

  const departments: Department[] = data?.data?.data || data?.data || [];
  const users: UserOption[] = usersData?.data?.data || [];

  const rootDepartments = useMemo(
    () => departments.filter((department) => !department.parentId),
    [departments],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      departmentsApi.create({
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        description: createForm.description.trim() || undefined,
        parentId: createForm.parentId || undefined,
        headUserId: createForm.headUserId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        code: '',
        description: '',
        parentId: '',
        headUserId: '',
      });
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to create department'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      departmentsApi.update(editForm.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        parentId: editForm.parentId || undefined,
        headUserId: editForm.headUserId || undefined,
        isActive: editForm.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowEditModal(false);
      setSelectedDepartment(null);
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to update department'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowEditModal(false);
      setSelectedDepartment(null);
    },
    onError: (error) => {
      alert(parseError(error, 'Failed to delete department'));
    },
  });

  const openEdit = (department: Department) => {
    setEditForm({
      id: department.id,
      name: department.name,
      code: department.code,
      description: department.description || '',
      parentId: department.parentId || '',
      headUserId: department.headUserId || '',
      isActive: department.isActive,
    });
    setShowEditModal(true);
  };

  const formatUser = (user?: UserOption | null) => {
    if (!user) return 'Unassigned';
    if (user.firstName) return `${user.firstName} ${user.lastName || ''}`.trim();
    return user.username;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Manage organization structure and department hierarchy</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Department
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Departments</p>
            <p className="text-2xl font-bold">{departments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Departments</p>
            <p className="text-2xl font-bold">{departments.filter((department) => department.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Root Departments</p>
            <p className="text-2xl font-bold">{rootDepartments.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No departments found</div>
          ) : (
            <div className="space-y-2">
              {departments.map((department) => (
                <div
                  key={department.id}
                  className={`flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 ${
                    department.parentId ? 'ml-8' : ''
                  }`}
                >
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setSelectedDepartment(department)}
                  >
                    <div className="p-2 rounded-lg bg-primary/10">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{department.name}</span>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">{department.code}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Head: {formatUser(department.headUser as UserOption | undefined)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {department._count?.userDepartments || 0} users
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        department.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {department.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(department)}>
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
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
                <h2 className="text-xl font-semibold">Create Department</h2>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input required value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input required value={createForm.code} onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                    rows={3}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parent Department</Label>
                  <select
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    value={createForm.parentId}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, parentId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name} ({department.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Department Head</Label>
                  <select
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    value={createForm.headUserId}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, headUserId: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {formatUser(user)} (@{user.username})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Department'}
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
                <h2 className="text-xl font-semibold">Edit Department</h2>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={editForm.code} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input required value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parent Department</Label>
                  <select
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    value={editForm.parentId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, parentId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {departments
                      .filter((department) => department.id !== editForm.id)
                      .map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name} ({department.code})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Department Head</Label>
                  <select
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    value={editForm.headUserId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, headUserId: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {formatUser(user)} (@{user.username})
                      </option>
                    ))}
                  </select>
                </div>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
              <div className="flex justify-between p-4 border-t">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Delete this department?')) {
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

      {selectedDepartment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedDepartment(null)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{selectedDepartment.name}</h2>
                  <p className="text-muted-foreground">{selectedDepartment.code}</p>
                </div>
                <button onClick={() => setSelectedDepartment(null)} className="text-muted-foreground hover:text-foreground">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Description:</span> {selectedDepartment.description || '-'}</p>
                <p><span className="text-muted-foreground">Parent:</span> {selectedDepartment.parent?.name || 'None'}</p>
                <p><span className="text-muted-foreground">Head:</span> {formatUser(selectedDepartment.headUser as UserOption | undefined)}</p>
                <p><span className="text-muted-foreground">Status:</span> {selectedDepartment.isActive ? 'Active' : 'Inactive'}</p>
                <p><span className="text-muted-foreground">Created:</span> {formatDate(selectedDepartment.createdAt)}</p>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedDepartment(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setSelectedDepartment(null);
                    openEdit(selectedDepartment);
                  }}
                >
                  Edit Department
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
