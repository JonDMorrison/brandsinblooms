import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { NewsletterEditor } from '@/features/newsletter/editor/NewsletterEditor';

export const NewsletterEditorPage: React.FC = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const docId = useMemo(() => id || params.get('docId') || crypto.randomUUID(), [id, params]);

  React.useEffect(() => {
    document.title = 'Magazine Newsletter Editor | BloomSuite';
  }, []);

  return (
    <div className="h-[calc(100vh-60px)]">
      <NewsletterEditor docId={docId} />
    </div>
  );
};

export default NewsletterEditorPage;
