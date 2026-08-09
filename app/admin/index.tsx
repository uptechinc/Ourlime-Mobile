import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { auth, db } from '@/lib/firebaseConfig';
import { collection, getDocs, limit, query } from 'firebase/firestore';

export default function AdminPortalScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    usersCount: 0,
    postsCount: 0,
    reelsCount: 0,
    eventsCount: 0,
    reportsCount: 0,
  });

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const [usersSnap, postsSnap, reelsSnap, eventsSnap, reportsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), limit(50))),
          getDocs(query(collection(db, 'posts'), limit(50))),
          getDocs(query(collection(db, 'reels'), limit(50))),
          getDocs(query(collection(db, 'events'), limit(50))),
          getDocs(query(collection(db, 'reports'), limit(50))),
        ]);

        setStats({
          usersCount: usersSnap.size,
          postsCount: postsSnap.size,
          reelsCount: reelsSnap.size,
          eventsCount: eventsSnap.size,
          reportsCount: reportsSnap.size,
        });
      } catch (err) {
        console.error('[AdminPortal] Error loading stats:', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchAdminStats();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={{ marginTop: 12, color: '#64748b' }}>Loading admin dashboard…</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={styles.sectionTitle}>Overview & Metrics</Text>

          {/* Metric Cards */}
          <View style={styles.grid}>
            <View style={styles.metricCard}>
              <Icon name="users" size={22} color="#10b981" />
              <Text style={styles.metricVal}>{stats.usersCount}</Text>
              <Text style={styles.metricLabel}>Total Users</Text>
            </View>
            <View style={styles.metricCard}>
              <Icon name="file-text" size={22} color="#3b82f6" />
              <Text style={styles.metricVal}>{stats.postsCount}</Text>
              <Text style={styles.metricLabel}>Total Posts</Text>
            </View>
            <View style={styles.metricCard}>
              <Icon name="video" size={22} color="#8b5cf6" />
              <Text style={styles.metricVal}>{stats.reelsCount}</Text>
              <Text style={styles.metricLabel}>Total Limes</Text>
            </View>
            <View style={styles.metricCard}>
              <Icon name="calendar" size={22} color="#f59e0b" />
              <Text style={styles.metricVal}>{stats.eventsCount}</Text>
              <Text style={styles.metricLabel}>Events</Text>
            </View>
          </View>

          {/* Admin Management Tools */}
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Admin Management</Text>
          <View style={styles.toolList}>
            {[
              { label: 'User Management', icon: 'users', desc: 'Manage user accounts, roles & bans' },
              { label: 'Content Moderation', icon: 'shield', desc: 'Review reported posts & comments' },
              { label: 'Reports & Flagged Content', icon: 'flag', desc: `${stats.reportsCount} open reports` },
              { label: 'Category & Sticker Management', icon: 'grid', desc: 'Configure platform taxonomy' },
              { label: 'Analytics & Performance', icon: 'bar-chart-2', desc: 'System traffic and user engagement' },
            ].map((tool) => (
              <TouchableOpacity key={tool.label} style={styles.toolRow} activeOpacity={0.75}>
                <View style={styles.toolIconCircle}>
                  <Icon name={tool.icon} size={20} color="#10b981" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.toolLabel}>{tool.label}</Text>
                  <Text style={styles.toolDesc}>{tool.desc}</Text>
                </View>
                <Icon name="chevron-right" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '47%', padding: 16, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  metricVal: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  metricLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 2 },
  toolList: { gap: 10 },
  toolRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  toolIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  toolDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
