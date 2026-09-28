import { PageLoading } from '@/components/shell/page-loading';

// Its own, not only the student area's: My Packs and the builder are
// both inside this folder, and a move between them does not show the
// area's placeholder (walked 2026-09-28).
export default function Loading() {
  return <PageLoading />;
}
