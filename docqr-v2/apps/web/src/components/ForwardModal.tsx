import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi, departmentsApi } from '../lib/api';
import { Button } from './ui/button';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { toUserId?: string; toDepartmentId?: string; instructions?: string }) => void;
  isLoading?: boolean;
}

function extractList<T>(input: unknown): T[] {
  if (Array.isArray(input)) {
    return input as T[];
  }
  if (!input || typeof input !== 'object') {
    return [];
  }

  const first = (input as { data?: unknown }).data;
  if (Array.isArray(first)) {
    return first as T[];
  }
  if (first && typeof first === 'object' && Array.isArray((first as { data?: unknown }).data)) {
    return (first as { data: T[] }).data;
  }

  return [];
}

export default function ForwardModal({ isOpen, onClose, onSubmit, isLoading }: ForwardModalProps) {
  const [assignmentType, setAssignmentType] = useState<'user' | 'department'>('user');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [instructions, setInstructions] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 100 }),
    enabled: isOpen && assignmentType === 'user',
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    enabled: isOpen && assignmentType === 'department',
  });

  const userOptions = extractList<{ id: string; firstName?: string; lastName?: string; username: string; email: string }>(users?.data);
  const departmentOptions = extractList<{ id: string; name: string; code: string }>(departments?.data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (assignmentType === 'user' && !selectedUserId) {
      alert('Please select a user');
      return;
    }
    if (assignmentType === 'department' && !selectedDepartmentId) {
      alert('Please select a department');
      return;
    }

    onSubmit({
      toUserId: assignmentType === 'user' ? selectedUserId : undefined,
      toDepartmentId: assignmentType === 'department' ? selectedDepartmentId : undefined,
      instructions: instructions.trim() || undefined,
    });
  };

  const handleClose = () => {
    setSelectedUserId('');
    setSelectedDepartmentId('');
    setInstructions('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Forward Docket</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Assignment Type Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">Forward To</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentType('user')}
                  className={`flex-1 py-2 px-4 text-sm rounded-md border transition-colors ${
                    assignmentType === 'user'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:bg-accent'
                  }`}
                >
                  Individual User
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentType('department')}
                  className={`flex-1 py-2 px-4 text-sm rounded-md border transition-colors ${
                    assignmentType === 'department'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:bg-accent'
                  }`}
                >
                  Department
                </button>
              </div>
            </div>

            {/* User Selection */}
            {assignmentType === 'user' && (
              <div>
                <label className="block text-sm font-medium mb-2">Select User *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  required
                >
                  <option value="">-- Select a user --</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department Selection */}
            {assignmentType === 'department' && (
              <div>
                <label className="block text-sm font-medium mb-2">Select Department *</label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  required
                >
                  <option value="">-- Select a department --</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium mb-2">Instructions (Optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[100px]"
                placeholder="Add any instructions or notes for the recipient..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Forwarding...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Forward
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
