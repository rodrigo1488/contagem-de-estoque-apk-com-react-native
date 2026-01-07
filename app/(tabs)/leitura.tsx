import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, TextInput } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import getApiClient from '../../services/api';
import { getSettings } from '../../storage/settings';

export default function LeituraScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState(null);
  const [countedQuantity, setCountedQuantity] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    try {
      const api = await getApiClient();
      const response = await api.get(`/produto/${data}`);
      setProduct(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Produto não encontrado ou falha na comunicação com o servidor.');
    }
  };

  const handleSave = async () => {
    if (!product || !countedQuantity) {
      Alert.alert('Atenção', 'Preencha a quantidade contada.');
      return;
    }

    try {
      const settings = await getSettings();
      const api = await getApiClient();
      await api.post(`/salvar/${settings.username}`- {
        ...product,
        quantidade_contada: parseInt(countedQuantity, 10),
        novo_preco: newPrice ? parseFloat(newPrice) : undefined,
      });
      Alert.alert('Sucesso', 'Contagem salva com sucesso!');
      setProduct(null);
      setCountedQuantity('');
      setNewPrice('');
      setScanned(false);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a contagem.');
    }
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      {!product ? (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View style={styles.formContainer}>
          <Text>Descrição: {product.descricao}</Text>
          <Text>Preço Atual: {product.preco_atual}</Text>
          <Text>Quantidade no Sistema: {product.quantidade_sistema}</Text>

          <TextInput
            style={styles.input}
            placeholder="Quantidade Contada"
            keyboardType="numeric"
            value={countedQuantity}
            onChangeText={setCountedQuantity}
          />
          <TextInput
            style={styles.input}
            placeholder="Novo Preço (opcional)"
            keyboardType="numeric"
            value={newPrice}
            onChangeText={setNewPrice}
          />
          <Button title="Salvar Contagem" onPress={handleSave} />
          <Button title="Escanear Novamente" onPress={() => {
            setProduct(null);
            setScanned(false);
            setCountedQuantity('');
            setNewPrice('');
          }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  formContainer: {
    padding: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
});
