import { PageLoading } from '@/components/shell/page-loading';

// Its own (AGENTS.md: a nested route gets its own loading.tsx): a move from
// My packs to a course's packs, or from one course to another, does not
// show the folder above's placeholder.
export default function Loading() {
  return <PageLoading />;
}
