import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { ActivityService } from '@/lib/services/ActivityService';

type ActivityStat = {
  icon: string;
  label: string;
  value: number;
  color: string;
  bgColor: string;
};

type ActivityCardProps = {
  userId: string;
};

const activityService = ActivityService.getInstance();

export default function ActivityCard({ userId }: ActivityCardProps) {
  const [stats, setStats] = useState<ActivityStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchActivity = async () => {
      setIsLoading(true);
      try {
        const summary = await activityService.getWeeklyActivity(userId);
        buildStats(summary.likesReceived, summary.commentsReceived, summary.postsCreated);
      } catch {
        // Silent fail — hide the card if data is unavailable
        setStats([]);
      } finally {
        setIsLoading(false);
      }
    };

    const buildStats = (likes: number, comments: number, posts?: number) => {
      const items: ActivityStat[] = [];
      if (likes > 0) {
        items.push({ icon: 'heart', label: 'Likes Received', value: likes, color: '#e11d48', bgColor: '#ffe4e6' });
      }
      if (comments > 0) {
        items.push({ icon: 'message-circle', label: 'Comments Received', value: comments, color: '#2563eb', bgColor: '#dbeafe' });
      }
      if (posts !== undefined && posts > 0) {
        items.push({ icon: 'file-text', label: 'Posts This Week', value: posts, color: '#059669', bgColor: '#d1fae5' });
      }
      setStats(items);
    };

    void fetchActivity();
  }, [userId]);

  // Don't render if nothing to show
  if (!isLoading && stats.length === 0) return null;

  return (
    <View style={{
      marginBottom: 16,
      backgroundColor: '#ffffff',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    }}>
      {/* Header row */}
      <TouchableOpacity
        onPress={() => setIsCollapsed(c => !c)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCollapsed ? 0 : 14 }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: '#d1fae5',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
          }}>
            <Icon name="trending-up" size={15} color="#059669" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Activity This Week</Text>
        </View>
        <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color="#9ca3af" />
      </TouchableOpacity>

      {!isCollapsed && (
        isLoading ? (
          // Skeleton
          <View style={{ gap: 12 }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#f1f5f9' }} />
                  <View style={{ width: 100, height: 14, borderRadius: 6, backgroundColor: '#f1f5f9' }} />
                </View>
                <View style={{ width: 28, height: 20, borderRadius: 6, backgroundColor: '#f1f5f9' }} />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {stats.map(stat => (
              <View key={stat.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: stat.bgColor,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Icon name={stat.icon} size={17} color={stat.color} />
                  </View>
                  <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>{stat.label}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{stat.value}</Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}
