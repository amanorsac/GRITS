import { useCallback, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useMe } from '@/lib/auth';
import { must, supabase } from '@/lib/supabase';
import type { JournalEntry } from '@/lib/types';
import { useLoader } from '@/lib/useLoader';

const PAGE = 20;

export default function Journal() {
  const me = useMe();
  const [limit, setLimit] = useState(PAGE);
  const loader = useCallback(
    async () =>
      must(
        await supabase
          .from('journal_entries')
          .select('id, prompt, body, created_at, lesson_id')
          .eq('member_id', me.id)
          .order('created_at', { ascending: false })
          .limit(limit + 1),
      ) as JournalEntry[],
    [me.id, limit],
  );
  const { data, error, loading, refreshing, refresh } = useLoader(loader);
  const entries = data?.slice(0, limit) ?? [];
  const more = (data?.length ?? 0) > limit;

  return (
    <Screen back eyebrow="Private · Only you see this" title="My journal" refreshing={refreshing} onRefresh={refresh}>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {data && entries.length === 0 ? (
        <EmptyState icon="notebook-outline" title="Your journal is empty" body="Each lesson has a question to think about. Your answers are kept here, just for you." />
      ) : null}
      {entries.map((e) => (
        <Card key={e.id}>
          <Txt variant="meta" muted>
            {new Date(e.created_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
          </Txt>
          {e.prompt ? <Txt variant="heading">{e.prompt}</Txt> : null}
          <Txt>{e.body}</Txt>
        </Card>
      ))}
      {more ? <Button label="Show earlier entries" variant="secondary" onPress={() => setLimit((l) => l + PAGE)} /> : null}
    </Screen>
  );
}
