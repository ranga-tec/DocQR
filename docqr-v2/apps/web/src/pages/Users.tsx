import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, rolesApi, usersApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatDate } from '../lib/utils';

interface UserRole {
  id: string;
  name: string;
  displayName?: string;
}

interface UserDepartment {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  roles?: UserRole[];
  departments?: UserDepartment[];
}

interface RoleOption {
  id: string;
  name: string;
  displayName?: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

function extractNumber(input: unknown, keys: string[], fallback: number): number {
  if (!input || typeof input !== 'object') return fallback;
  const root = input as Record<string, unknown>;

  for (const key of keys) {
    const value = root[key];
    if (typeof value === 'number') return value;
  }

  const data = root.data;
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;
    for (const key of keys) {
      const value = nested[key];
      if (typeof value === 'number') return value;
    }

    const nestedMeta = nested.meta;
    if (nestedMeta && typeof nestedMeta === 'object') {
      const meta = nestedMeta as Record<string, unknown>;
      for (const key of keys) {
        const value = meta[key];
        if (typeof value === 'number') return value;
      }
    }
  }

  const rootMeta = root.meta;
  if (rootMeta && typeof rootMeta === 'object') {
    const meta = rootMeta as Record<string, unknown>;
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === 'number') return value;
    }
  }

  return fallback;
}

function extractPagination(input: unknown, fallbackPageSize: number): PaginationMeta {
  const total = extractNumber(input, ['total'], 0);
  const page = extractNumber(input, ['page'], 1);
  const pageSize = extractNumber(input, ['pageSize', 'limit'], fallbackPageSize);
  const totalPages = extractNumber(
    input,
    ['totalPages'],
    Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
  );

  return { total, page, pageSize, totalPages };
}

export default function Users() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    email: '',
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    roleIds: [] as string[],
    departmentIds: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    id: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    isActive: true,
    roleIds: [] as string[],
    departmentIds: [] as string[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, page }],
    queryFn: () => usersApi.list({ search: search || undefined, page, limit: 20 }),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles-options'],
    queryFn: () => rolesApi.list(),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments-options'],
    queryFn: () => departmentsApi.list(),
  });

  const users: User[] = extractList<User>(data?.data);
  const pagination = extractPagination(data?.data, 20);
  const total = pagination.total;
  const totalPages = pagination.totalPages;
  const roleOptions: RoleOption[] = extractList<RoleOption>(rolesData?.data);
  const departmentOptions: DepartmentOption[] = extractList<DepartmentOption>(departmentsData?.data);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  const createUserMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: createForm.email.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
        firstName: createForm.firstName.trim() || undefined,
        lastName: createForm.lastName.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        roleIds: createForm.roleIds,
        departmentIds: createForm.departmentIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      setCreateForm({
        email: '',
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        roleIds: [],
        departmentIds: [],
      });
    },
    onError: (error) => {
      alert(errorMessage(error, 'Failed to create user'));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: () =>
      usersApi.update(editForm.id, {
        email: editForm.email.trim(),
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        isActive: editForm.isActive,
        roleIds: editForm.roleIds,
        departmentIds: editForm.departmentIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowEditModal(false);
      const updated = usersById.get(editForm.id);
      if (updated) {
        setSelectedUser({
          ...updated,
          email: editForm.email.trim(),
          firstName: editForm.firstName.trim() || undefined,
          lastName: editForm.lastName.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          isActive: editForm.isActive,
          roles: roleOptions.filter((role) => editForm.roleIds.includes(role.id)),
          departments: departmentOptions.filter((dept) => editForm.departmentIds.includes(dept.id)),
        });
      }
    },
    onError: (error) => {
      alert(errorMessage(error, 'Failed to update user'));
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUser(null);
      setShowEditModal(false);
    },
    onError: (error) => {
      alert(errorMessage(error, 'Failed to delete user'));
    },
  });

  const toggleSelection = (
    currentValues: string[],
    value: string,
    onChange: (next: string[]) => void,
  ) => {
    if (currentValues.includes(value)) {
      onChange(currentValues.filter((item) => item !== value));
    } else {
      onChange([...currentValues, value]);
    }
  };

  const openEditModal = (user: User) => {
    setEditForm({
      id: user.id,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      isActive: user.isActive,
      roleIds: (user.roles || []).map((role) => role.id),
      departmentIds: (user.departments || []).map((department) => department.id),
    });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage system users, roles, and departments</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">User</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Phone</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Roles</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Created</th>
                    <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                            {(user.firstName?.[0] || user.username[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">
                              {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username}
                            </div>
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{user.email}</td>
                      <td className="px-4 py-3 text-sm">{user.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles || []).length > 0 ? (
                            user.roles?.map((role) => (
                              <span
                                key={role.id}
                                className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
                              >
                                {role.displayName || role.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            user.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>
                            View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Delete this user?')) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                            disabled={deleteUserMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} users
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate();
              }}
            >
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Create User</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-email">Email *</Label>
                    <Input
                      id="create-email"
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-username">Username *</Label>
                    <Input
                      id="create-username"
                      required
                      value={createForm.username}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">Password *</Label>
                    <Input
                      id="create-password"
                      type="password"
                      required
                      minLength={8}
                      value={createForm.password}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-phone">Phone</Label>
                    <Input
                      id="create-phone"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-first-name">First Name</Label>
                    <Input
                      id="create-first-name"
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-last-name">Last Name</Label>
                    <Input
                      id="create-last-name"
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Roles</Label>
                    <div className="border rounded-md p-3 max-h-44 overflow-y-auto space-y-2">
                      {roleOptions.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={createForm.roleIds.includes(role.id)}
                            onChange={() =>
                              toggleSelection(createForm.roleIds, role.id, (next) =>
                                setCreateForm((prev) => ({ ...prev, roleIds: next })),
                              )
                            }
                          />
                          {role.displayName || role.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Departments</Label>
                    <div className="border rounded-md p-3 max-h-44 overflow-y-auto space-y-2">
                      {departmentOptions.map((department) => (
                        <label key={department.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={createForm.departmentIds.includes(department.id)}
                            onChange={() =>
                              toggleSelection(createForm.departmentIds, department.id, (next) =>
                                setCreateForm((prev) => ({ ...prev, departmentIds: next })),
                              )
                            }
                          />
                          {department.name} ({department.code})
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUserMutation.mutate();
              }}
            >
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Edit User</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email *</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-first-name">First Name</Label>
                    <Input
                      id="edit-first-name"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-last-name">Last Name</Label>
                    <Input
                      id="edit-last-name"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active user
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Roles</Label>
                    <div className="border rounded-md p-3 max-h-44 overflow-y-auto space-y-2">
                      {roleOptions.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.roleIds.includes(role.id)}
                            onChange={() =>
                              toggleSelection(editForm.roleIds, role.id, (next) =>
                                setEditForm((prev) => ({ ...prev, roleIds: next })),
                              )
                            }
                          />
                          {role.displayName || role.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Departments</Label>
                    <div className="border rounded-md p-3 max-h-44 overflow-y-auto space-y-2">
                      {departmentOptions.map((department) => (
                        <label key={department.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.departmentIds.includes(department.id)}
                            onChange={() =>
                              toggleSelection(editForm.departmentIds, department.id, (next) =>
                                setEditForm((prev) => ({ ...prev, departmentIds: next })),
                              )
                            }
                          />
                          {department.name} ({department.code})
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
          <div className="bg-card rounded-lg shadow-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-medium">
                    {(selectedUser.firstName?.[0] || selectedUser.username[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedUser.firstName
                        ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim()
                        : selectedUser.username}
                    </h2>
                    <p className="text-muted-foreground">@{selectedUser.username}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <p className="font-medium">{selectedUser.phone || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <p>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          selectedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {selectedUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Created</label>
                    <p className="font-medium">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Roles</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(selectedUser.roles || []).length > 0 ? (
                      selectedUser.roles?.map((role) => (
                        <span key={role.id} className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary">
                          {role.displayName || role.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">No roles assigned</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Departments</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(selectedUser.departments || []).length > 0 ? (
                      selectedUser.departments?.map((department) => (
                        <span key={department.id} className="px-3 py-1 text-sm rounded-full bg-muted">
                          {department.name} ({department.code})
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">No departments assigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setSelectedUser(null);
                    openEditModal(selectedUser);
                  }}
                >
                  Edit User
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
