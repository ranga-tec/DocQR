import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rolesApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatDate } from '../lib/utils';

interface Role {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  isSystemRole: boolean;
  permissions: string[] | string;
  createdAt: string;
  userCount?: number;
}

interface Permission {
  id: string;
  code: string;
  name: string;
  resourceType: string;
}

function toPermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function errorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string | string[] } } };
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (message) return message;
  return fallback;
}

function extractList<T>(input: unknown): T[] {
  if (Array.isArray(input)) {
    return input as T[];
  }
  if (!input || typeof input !== 'object') {
    return [];
  }

  const root = input as { data?: unknown; items?: unknown };
  if (Array.isArray(root.data)) {
    return root.data as T[];
  }
  if (Array.isArray(root.items)) {
    return root.items as T[];
  }

  if (root.data && typeof root.data === 'object') {
    const nested = root.data as { data?: unknown; items?: unknown };
    if (Array.isArray(nested.data)) {
      return nested.data as T[];
    }
    if (Array.isArray(nested.items)) {
      return nested.items as T[];
    }
  }

  return [];
}

export default function Roles() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
    isSystemRole: false,
  });

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesApi.getPermissions(),
  });

  const roles: Role[] = extractList<Role>(rolesData?.data);
  const permissions: Permission[] = extractList<Permission>(permissionsData?.data);

  const permissionsByResource = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.resourceType]) {
        acc[perm.resourceType] = [];
      }
      acc[perm.resourceType].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissions]);

  const createRoleMutation = useMutation({
    mutationFn: () =>
      rolesApi.create({
        name: createForm.name.trim(),
        displayName: createForm.displayName.trim() || createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        permissions: createForm.permissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowCreateModal(false);
      setCreateForm({ name: '', displayName: '', description: '', permissions: [] });
    },
    onError: (error) => alert(errorMessage(error, 'Failed to create role')),
  });

  const updateRoleMutation = useMutation({
    mutationFn: () =>
      rolesApi.update(editForm.id, {
        displayName: editForm.displayName.trim() || editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        permissions: editForm.permissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowEditModal(false);
      setSelectedRole(null);
    },
    onError: (error) => alert(errorMessage(error, 'Failed to update role')),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedRole(null);
      setShowEditModal(false);
    },
    onError: (error) => alert(errorMessage(error, 'Failed to delete role')),
  });

  const togglePermission = (
    currentPermissions: string[],
    permissionCode: string,
    onChange: (nextPermissions: string[]) => void,
  ) => {
    if (currentPermissions.includes(permissionCode)) {
      onChange(currentPermissions.filter((code) => code !== permissionCode));
    } else {
      onChange([...currentPermissions, permissionCode]);
    }
  };

  const openEdit = (role: Role) => {
    setEditForm({
      id: role.id,
      name: role.name,
      displayName: role.displayName || role.name,
      description: role.description || '',
      permissions: toPermissions(role.permissions),
      isSystemRole: role.isSystemRole,
    });
    setShowEditModal(true);
  };

  const detailPermissions = selectedRole ? toPermissions(selectedRole.permissions) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">Manage role creation, updates, and access controls</p>
          <p className="text-xs text-muted-foreground mt-1">System roles are locked and cannot be edited or deleted.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Role
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Roles</p>
            <p className="text-2xl font-bold">{roles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">System Roles</p>
            <p className="text-2xl font-bold">{roles.filter((role) => role.isSystemRole).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Permissions</p>
            <p className="text-2xl font-bold">{permissions.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : roles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No roles found
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => {
                const rolePermissions = toPermissions(role.permissions);
                return (
                  <div key={role.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${role.isSystemRole ? 'bg-blue-100' : 'bg-primary/10'}`}>
                        <svg
                          className={`w-5 h-5 ${role.isSystemRole ? 'text-blue-600' : 'text-primary'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{role.displayName || role.name}</span>
                          {role.isSystemRole ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">System</span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{role.description || 'No description'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{role.userCount || 0} users</span>
                      <span className="text-xs text-muted-foreground">{rolePermissions.length} permissions</span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRole(role)}>
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(role)}
                        disabled={role.isSystemRole}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRoleMutation.mutate();
              }}
            >
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Create Role</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">Name *</Label>
                    <Input
                      id="role-name"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-display-name">Display Name</Label>
                    <Input
                      id="role-display-name"
                      value={createForm.displayName}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-description">Description</Label>
                  <textarea
                    id="role-description"
                    className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-3">
                    {Object.entries(permissionsByResource).map(([resource, perms]) => (
                      <div key={resource}>
                        <h4 className="text-sm font-medium mb-2 capitalize">{resource}</h4>
                        <div className="flex flex-wrap gap-2">
                          {perms.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2 text-sm px-2 py-1 border rounded">
                              <input
                                type="checkbox"
                                checked={createForm.permissions.includes(perm.code)}
                                onChange={() =>
                                  togglePermission(createForm.permissions, perm.code, (next) =>
                                    setCreateForm((prev) => ({ ...prev, permissions: next })),
                                  )
                                }
                              />
                              {perm.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRoleMutation.isPending}>
                  {createRoleMutation.isPending ? 'Creating...' : 'Create Role'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRoleMutation.mutate();
              }}
            >
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Edit Role</h2>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editForm.name} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={editForm.displayName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-3">
                    {Object.entries(permissionsByResource).map(([resource, perms]) => (
                      <div key={resource}>
                        <h4 className="text-sm font-medium mb-2 capitalize">{resource}</h4>
                        <div className="flex flex-wrap gap-2">
                          {perms.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2 text-sm px-2 py-1 border rounded">
                              <input
                                type="checkbox"
                                checked={editForm.permissions.includes(perm.code)}
                                onChange={() =>
                                  togglePermission(editForm.permissions, perm.code, (next) =>
                                    setEditForm((prev) => ({ ...prev, permissions: next })),
                                  )
                                }
                              />
                              {perm.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-between p-4 border-t">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Delete this role?')) {
                      deleteRoleMutation.mutate(editForm.id);
                    }
                  }}
                  disabled={deleteRoleMutation.isPending || editForm.isSystemRole}
                  title={editForm.isSystemRole ? 'System roles cannot be deleted' : undefined}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateRoleMutation.isPending}>
                    {updateRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedRole(null)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{selectedRole.displayName || selectedRole.name}</h2>
                  <p className="text-muted-foreground">{selectedRole.name}</p>
                </div>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedRole(null)}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Description</label>
                  <p className="font-medium">{selectedRole.description || 'No description'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Users</label>
                    <p className="font-medium">{selectedRole.userCount || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Created</label>
                    <p className="font-medium">{formatDate(selectedRole.createdAt)}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Permissions</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {detailPermissions.length > 0 ? (
                      detailPermissions.map((permission) => (
                        <span key={permission} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                          {permission}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">No permissions assigned</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedRole(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setSelectedRole(null);
                    openEdit(selectedRole);
                  }}
                >
                  Edit Role
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
