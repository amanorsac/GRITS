import { useCallback } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { CrownMark } from '@/components/CrownMark';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useMe } from '@/lib/auth';
import { must, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { Certificate } from '@/lib/types';
import { useLoader } from '@/lib/useLoader';

export default function Certificates() {
  const me = useMe();
  const t = useTheme();
  const loader = useCallback(
    async () =>
      must(
        await supabase
          .from('certificates')
          .select('id, code, title, issued_at')
          .eq('member_id', me.id)
          .order('issued_at', { ascending: false }),
      ) as Certificate[],
    [me.id],
  );
  const { data, error, loading, refreshing, refresh } = useLoader(loader);

  return (
    <Screen back title="Certificates" refreshing={refreshing} onRefresh={refresh}>
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {data && data.length === 0 ? (
        <EmptyState icon="certificate-outline" title="No certificates yet" body="Finish every lesson in a month and its certificate appears here." />
      ) : null}
      {data?.map((c) => (
        <Card key={c.id} style={{ borderColor: t.gold, borderWidth: 1.5, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <CrownMark size={48} color={t.gold} jewel={t.surface} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">{c.title}</Txt>
            <Txt variant="meta" muted>
              {new Date(c.issued_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="check-decagram" size={16} color={t.status.complete.fg} />
              <Txt variant="meta" color={t.status.complete.fg} selectable>
                Verified · code {c.code}
              </Txt>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
