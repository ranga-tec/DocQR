import { useState } from 'react';
import { Button } from './ui/button';

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; notes?: string }) => void;
  isLoading?: boolean;
}

export default function RejectModal({ isOpen, onClose, onSubmit, isLoading }: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    onSubmit({
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });
  };

  const handleClose = () => {
    setReason('');
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Reject Docket</h2>
              <p className="text-sm text-muted-foreground">This action cannot be undone easily.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason - Required */}
            <div>
              <label className="block text-sm font-medium mb-2">Reason for Rejection *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[100px]"
                placeholder="Please explain why this docket is being rejected..."
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[60px]"
                placeholder="Any additional information..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
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
