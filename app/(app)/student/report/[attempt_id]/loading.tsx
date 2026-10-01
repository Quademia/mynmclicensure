import { PageLoading } from '@/components/shell/page-loading';

// Its own, not only the student area's: a move from one report to
// another stays inside this folder, where the area's placeholder does
// not show (the course page's lesson, walked 2026-09-28).
export default function Loading() {
  return <PageLoading />;
}
