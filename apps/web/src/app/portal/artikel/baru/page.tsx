'use client';

import { ArticleEditor } from '@/components/portal/article-editor';
import { ArticleGate } from '@/components/portal/article-gate';
import { t } from '@/messages/id';
import { PortalShell } from '../../portal-shell';

export default function NewArticlePage() {
  return (
    <PortalShell title={t.articleEditor.newTitle}>
      {(me) => (
        <ArticleGate me={me}>
          <ArticleEditor article={null} />
        </ArticleGate>
      )}
    </PortalShell>
  );
}
