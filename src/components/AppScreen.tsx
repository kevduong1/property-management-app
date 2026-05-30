import { RefreshControl, ScrollView, View } from 'react-native';
import { SeriesContextBar } from './SeriesContextBar';

/**
 * Standard staff screen container: a persistent series-context bar pinned at the
 * top (so "which series" is always obvious) above scrollable content.
 */
export function AppScreen({
  children,
  refreshing,
  onRefresh,
  showSeriesBar = true,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  showSeriesBar?: boolean;
}) {
  return (
    <View className="flex-1 bg-background">
      {showSeriesBar ? <SeriesContextBar /> : null}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 56, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
