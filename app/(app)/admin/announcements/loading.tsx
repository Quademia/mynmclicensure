import { PageLoading } from '@/components/shell/page-loading';

// The placeholder for a move between the list and a notice's page, and
// from one notice to another (08.17, 08.18): a move inside this folder is
// not covered by the admin area's own (AGENTS.md).
export default function Loading() {
  return <PageLoading />;
}
