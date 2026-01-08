import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api, DashboardStatsResponse, HistoryItem } from '../../services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function DashboardScreen() {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const loadData = async () => {
        try {
            const [statsData, historyData] = await Promise.all([
                api.getDashboardStats(),
                api.getHistory()
            ]);
            setStats(statsData);
            setHistory(historyData);
        } catch (error) {
            console.error(error);
            // Alert.alert('Erro', 'Falha ao carregar dados do dashboard.');
        }
    };

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadData().finally(() => setLoading(false));
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData().finally(() => setRefreshing(false));
    }, []);

    const handleFinalize = async () => {
        Alert.alert(
            'Finalizar Contagem',
            'Deseja realmente finalizar a contagem atual? Isso moverá os dados para o histórico.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Finalizar',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const res = await api.finalizeCount();
                            Alert.alert('Sucesso', res.message);
                            loadData(); // Refresh data
                        } catch (error: any) {
                            const msg = error.response?.data?.message || 'Erro desconhecido';
                            Alert.alert('Erro', `Falha ao finalizar: ${msg}`);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr: string) => {
        // Assuming naive string from backend, clean up if needed
        return dateStr;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Dashboard</Text>
            </View>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Stats Cards */}
                <View style={styles.statsGrid}>
                    <View style={[styles.card, styles.cardBlue]}>
                        <Text style={styles.cardLabel}>Itens coletados</Text>
                        <Text style={styles.cardValue}>{stats?.total_itens_coletados || 0}</Text>
                    </View>
                    <View style={[
                        styles.card,
                        (stats?.valor_divergencia || 0) < 0 ? styles.cardRed : styles.cardGreen
                    ]}>
                        <Text style={styles.cardLabel}>Valor de Divergência</Text>
                        <Text style={styles.cardValue}>
                            {formatCurrency(stats?.valor_divergencia || 0)}
                        </Text>
                    </View>
                    <View style={[styles.card, styles.cardOrange]}>
                        <Text style={styles.cardLabel}>Divergências</Text>
                        <Text style={styles.cardValue}>{stats?.total_divergencias || 0}</Text>
                    </View>
                    <View style={[styles.card, styles.cardGray]}>
                        <Text style={styles.cardLabel}>Finalizadas</Text>
                        <Text style={styles.cardValue}>{stats?.contagens_finalizadas || 0}</Text>
                    </View>
                </View>


                {/* Recents */}
                <Text style={styles.sectionTitle}>Atividade Recente</Text>
                {stats?.itens_recentes && stats.itens_recentes.length > 0 ? (
                    stats.itens_recentes.map((item, idx) => (
                        <View key={idx} style={styles.listItem}>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle} numberOfLines={2} ellipsizeMode="tail">{item.descricao}</Text>
                                <Text style={styles.itemSub}>{item.data_hora}</Text>
                            </View>
                            <Text style={styles.itemQty}>{item.quantidade} UN</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>Nenhuma atividade recente.</Text>
                )}

                {/* History */}
                <Text style={styles.sectionTitle}>Histórico de Contagens</Text>
                {history.length > 0 ? (
                    history.map((h) => (
                        <View key={h.id} style={styles.historyItem}>
                            <View style={styles.historyHeader}>
                                <Text style={styles.historyDate}>{formatDate(h.data_finalizacao)}</Text>
                                <Text style={styles.historyId}>#{h.id}</Text>
                            </View>
                            <View style={styles.historyDetails}>
                                <Text style={styles.historyDetailText}>Itens: {h.total_itens}</Text>
                                <Text style={styles.historyDetailText}>Valor: {formatCurrency(h.valor_total)}</Text>
                            </View>
                            {h.total_divergencias > 0 && (
                                <Text style={styles.historyWarning}>⚠ {h.total_divergencias} Divergências</Text>
                            )}
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>Nenhum histórico encontrado.</Text>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
            {loading && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
    content: { padding: 15 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    card: { width: '48%', padding: 15, borderRadius: 12, elevation: 2 },
    cardLabel: { color: '#fff', fontSize: 12, fontWeight: '600', marginBottom: 5 },
    cardValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    cardValueNegative: { color: '#FF3B30' },

    cardBlue: { backgroundColor: '#007AFF' },
    cardGreen: { backgroundColor: '#34C759' },
    cardRed: { backgroundColor: '#FF3B30' },
    cardOrange: { backgroundColor: '#FF9500' },
    cardGray: { backgroundColor: '#8E8E93' },

    finalizeButton: {
        backgroundColor: '#FF3B30',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 12,
        marginBottom: 25,
        gap: 10,
        elevation: 3
    },
    finalizeText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 10 },

    listItem: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeftWidth: 3,
        borderLeftColor: '#007AFF'
    },
    itemContent: {
        flex: 1,
        marginRight: 10
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        flexWrap: 'wrap'
    },
    itemSub: { fontSize: 12, color: '#666', marginTop: 2 },
    itemQty: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
        minWidth: 60,
        textAlign: 'right'
    },

    emptyText: { color: '#999', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },

    historyItem: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee'
    },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    historyDate: { fontWeight: 'bold', fontSize: 16, color: '#333' },
    historyId: { color: '#999', fontSize: 12 },
    historyDetails: { flexDirection: 'row', justifyContent: 'space-between' },
    historyDetailText: { color: '#555' },
    historyWarning: { color: '#FF9500', fontWeight: 'bold', marginTop: 6, fontSize: 12 },

    loaderOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center'
    }
});
