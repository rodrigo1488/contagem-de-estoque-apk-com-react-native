import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import getApiClient from '../../services/api';

export default function ListagemScreen() {
  const [contagens, setContagens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchContagens = async () => {
    setLoading(true);
    try {
      const api = await getApiClient();
      const url = searchTerm ? `/listar-contagem/${searchTerm}` : '/listar-contagem';
      const response = await api.get(url);
      setContagens(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as contagens.');
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchContagens();
    }, [])
  );

  const handleEdit = async (item) => {
    // Simple prompt for new quantity for this prototype
    const newQuantity = prompt('Nova quantidade:');
    if (newQuantity && !isNaN(newQuantity)) {
      try {
        const api = await getApiClient();
        await api.put(`/editar/${item.id}`- {
          quantidade_contada: parseInt(newQuantity, 10),
        });
        Alert.alert('Sucesso', 'Quantidade atualizada.');
        fetchContagens(); // Refresh list
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível editar o item.');
      }
    }
  };

  const handleDelete = async (itemId) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Você tem certeza que deseja excluir este item?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', onPress: async () => {
            try {
              const api = await getApiClient();
              await api.delete(`/excluir/${itemId}`);
              Alert.alert('Sucesso', 'Item excluído.');
              fetchContagens(); // Refresh list
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir o item.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <Text>Descrição: {item.descricao}</Text>
      <Text>Cód. Barras: {item.codigo_barras}</Text>
      <Text>Qtd. Contada: {item.quantidade_contada}</Text>
      <Text>Qtd. Sistema: {item.quantidade_sistema}</Text>
      <Text>Usuário: {item.nome_usuario}</Text>
      <Text>Data/Hora: {new Date(item.data_hora).toLocaleString()}</Text>
      <View style={styles.buttonContainer}>
        <Button title="Editar" onPress={() => handleEdit(item)} />
        <Button title="Excluir" color="red" onPress={() => handleDelete(item.id)} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por descrição..."
        value={searchTerm}
        onChangeText={setSearchTerm}
        onSubmitEditing={fetchContagens}
      />
      <Button title="Buscar" onPress={fetchContagens} />
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={contagens}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          onRefresh={fetchContagens}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  itemContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
});
