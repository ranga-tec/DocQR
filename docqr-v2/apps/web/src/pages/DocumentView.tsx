import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import DocumentEditor from '../components/DocumentEditor';
import { useAuth } from '../context/AuthContext';

export default function DocumentView() {
  const { attachmentId } = useParams<{ attachmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const requestedMode = (searchParams.get('mode') || 'view') as 'view' | 'edit';
  const mode = requestedMode === 'edit' && hasPermission('attachment:edit') ? 'edit' : 'view';
  const fileName = searchParams.get('name') || 'Document';

  if (!attachmentId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Invalid attachment ID</p>
      </div>
    );
  }

  return (
    <DocumentEditor
      attachmentId={attachmentId}
      fileName={fileName}
      mode={mode}
      onClose={() => navigate(-1)}
    />
  );
}
