import { useState } from 'react';
import { Button } from './ui/button';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason?: string; notes?: string }) => void;
  isLoading?: boolean;
}

export default function ReturnModal({ isOpen, onClose, onSubmit, isLoading }: ReturnModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      reason: reason.trim() || undefined,
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
          <h2 className="text-lg font-semibold mb-4">Return Docket</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Return this docket to the previous handler for further action.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason */}
            <div>
              <label className="block text-sm font-medium mb-2">Reason for Return (Optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[80px]"
                placeholder="Why is this being returned?"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[60px]"
                placeholder="Any additional instructions..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Returning...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                    Return
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
