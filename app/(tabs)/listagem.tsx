import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, CountItem } from '../../services/api';
import { IconSymbol } from '@/components/ui/icon-symbol'; // Using IconSymbol if available or text fallback

export default function ListagemScreen() {
  const [contagens, setContagens] = useState<CountItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('');

  const fetchContagens = async () => {
    setLoading(true);
    try {
      const data = searchTerm ? await api.searchCounts(searchTerm) : await api.getCounts();
      setContagens(data);
    } catch (error: any) {
      Alert.alert('Erro', `Não foi possível carregar as contagens: ${error.message}`);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchContagens();
    }, [])
  );

  const startEdit = (item: CountItem) => {
    setEditingId(item.id);
    setEditQuantity(item.quantidade.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuantity('');
  };

  const saveEdit = async (id: number) => {
    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erro', 'Quantidade inválida.');
      return;
    }

    try {
      await api.editCount(id, { quantidade: qty });
      Alert.alert('Sucesso', 'Quantidade atualizada.');
      setEditingId(null);
      fetchContagens();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Erro desconhecido';
      Alert.alert('Erro', `Não foi possível editar o item: ${msg}`);
    }
  };

  const handleDelete = async (itemId: number) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Você tem certeza que deseja excluir este item?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive', onPress: async () => {
            try {
              await api.deleteCount(itemId);
              fetchContagens();
            } catch (error: any) {
              const msg = error.response?.data?.message || error.message || 'Erro desconhecido';
              Alert.alert('Erro', `Não foi possível excluir o item: ${msg}`);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: CountItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.itemName} numberOfLines={1}>{item.descricao}</Text>
        <Text style={styles.itemDate}>{item.data_hora}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Cód. Barras</Text>
          <Text style={styles.value}>{item.codigo_barras}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Qtd. Sist</Text>
          <Text style={styles.value}>{item.qnt_sist}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Contada</Text>
          {editingId === item.id ? (
            <TextInput
              style={styles.editInput}
              value={editQuantity}
              onChangeText={setEditQuantity}
              keyboardType="numeric"
              autoFocus
            />
          ) : (
            <Text style={[styles.value, styles.highlight]}>{item.quantidade}</Text>
          )}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.userLabel}>Usuário: {item.nome_user}</Text>
        <View style={styles.actions}>
          {editingId === item.id ? (
            <>
              <TouchableOpacity onPress={() => saveEdit(item.id)} style={[styles.actionBtn, styles.saveBtn]}>
                <Text style={styles.btnText}>Salvar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEdit} style={[styles.actionBtn, styles.cancelBtn]}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => startEdit(item)} style={[styles.actionBtn, styles.editBtn]}>
              <Text style={styles.btnText}>Editar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.actionBtn, styles.deleteBtn]}>
            <Text style={styles.btnText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Listagem de Contagens</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filtrar por descrição..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={fetchContagens}
        />
        <TouchableOpacity onPress={fetchContagens} style={styles.searchButton}>
          <Text style={styles.btnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={contagens}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          onRefresh={fetchContagens}
          refreshing={loading}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma contagem encontrada.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },

  searchContainer: { flexDirection: 'row', padding: 15, gap: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  searchButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 8
  },

  listContent: { padding: 15 },
  loader: { marginTop: 20 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#999', fontSize: 16 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  itemName: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10 },
  itemDate: { fontSize: 12, color: '#999' },

  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, backgroundColor: '#fafafa', padding: 10, borderRadius: 8 },
  infoCol: { alignItems: 'center', flex: 1 },
  label: { fontSize: 10, color: '#666', marginBottom: 2, textTransform: 'uppercase' },
  value: { fontSize: 14, fontWeight: '600' },
  highlight: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
  editInput: { borderWidth: 1, borderColor: '#007AFF', padding: 2, borderRadius: 4, width: 60, textAlign: 'center', backgroundColor: '#fff' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  userLabel: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  editBtn: { backgroundColor: '#FF9500' },
  saveBtn: { backgroundColor: '#34C759' },
  cancelBtn: { backgroundColor: '#8E8E93' },
  deleteBtn: { backgroundColor: '#FF3B30' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});
