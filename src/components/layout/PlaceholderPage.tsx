import { Construction } from 'lucide-react';
import { Card } from '@/components/ui';
import { PageContainer } from './PageContainer';
import { PageHeader } from './PageHeader';

export interface PlaceholderPageProps {
  title: string;
  /** One line on what this screen will hold. */
  description: string;
  width?: 'default' | 'wide';
}

/** Scaffold for a route whose screen hasn't been built yet. */
export function PlaceholderPage({ title, description, width }: PlaceholderPageProps) {
  return (
    <PageContainer width={width}>
      <PageHeader title={title} />
      <Card className="flex items-start gap-3">
        <Construction aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-3" />
        <div>
          <p className="text-callout text-ink">{description}</p>
          <p className="mt-1 text-footnote text-ink-3">This screen isn't built yet.</p>
        </div>
      </Card>
    </PageContainer>
  );
}
