import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Switch, StyleSheet, Alert } from 'react-native';
import { getSettings, saveSettings } from '../../storage/settings';
import getApiClient from '../../services/api';

export default function ConfiguracoesScreen() {
  const [localIp, setLocalIp] = useState('');
  const [localPort, setLocalPort] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [username, setUsername] = useState('');
  const [useLocalServer, setUseLocalServer] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      if (settings) {
        setLocalIp(settings.localIp || '');
        setLocalPort(settings.localPort || '');
        setPublicUrl(settings.publicUrl || '');
        setUsername(settings.username || '');
        setUseLocalServer(settings.useLocalServer === true);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    const newSettings = { localIp, localPort, publicUrl, username, useLocalServer };
    await saveSettings(newSettings);
    Alert.alert('Sucesso', 'Configurações salvas com sucesso!');
  };

  const handleTestConnection = async () => {
    try {
      const api = await getApiClient();
      const response = await api.get('/check_health');
      if (response.status === 200) {
        Alert.alert('Sucesso', 'Conexão com o servidor bem-sucedida!');
      } else {
        Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
      }
    } catch (error) {
      console.error('Connection test failed', error);
      Alert.alert('Erro', 'Falha no teste de conexão. Verifique as configurações e o servidor.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome de Usuário</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} />

      <Text style={styles.label}>IP do Servidor Local</Text>
      <TextInput style={styles.input} value={localIp} onChangeText={setLocalIp} />

      <Text style={styles.label}>Porta do Servidor Local</Text>
      <TextInput style={styles.input} value={localPort} onChangeText={setLocalPort} keyboardType="numeric" />

      <Text style={styles.label}>URL Pública da API</Text>
      <TextInput style={styles.input} value={publicUrl} onChangeText={setPublicUrl} />

      <View style={styles.switchContainer}>
        <Text>Usar Servidor Local</Text>
        <Switch value={useLocalServer} onValueChange={setUseLocalServer} />
      </View>

      <Button title="Salvar Configurações" onPress={handleSave} />
      <View style={{ marginVertical: 10 }} />
      <Button title="Testar Conexão" onPress={handleTestConnection} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
});
