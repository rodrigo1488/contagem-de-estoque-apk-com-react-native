import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { getSettings, saveSettings } from '../../storage/settings';
import { api } from '../../services/api';

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
      // Logic requires saving first usually, or passing temp config?
      // Since API service reads from Storage, we must save first OR logic in API needs to accept overrides.
      // For now, let's warn user to save first.
      await handleSave();

      const data = await api.checkHealth();
      if (data.status === 'OK') {
        Alert.alert('Sucesso', 'Conexão com o servidor operacional!');
      } else {
        Alert.alert('Atenção', `Resposta incomum: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao conectar. Verifique IP/Porta e se o servidor está rodando.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configurações</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usuário</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome do Operador</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Ex: João Silva"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conexão</Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Usar Servidor Local</Text>
              <Switch
                value={useLocalServer}
                onValueChange={setUseLocalServer}
                trackColor={{ false: '#ddd', true: '#34C759' }}
              />
            </View>

            {useLocalServer ? (
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 2, marginRight: 10 }]}>
                  <Text style={styles.label}>IP Local</Text>
                  <TextInput
                    style={styles.input}
                    value={localIp}
                    onChangeText={setLocalIp}
                    placeholder="192.168.x.x"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Porta</Text>
                  <TextInput
                    style={styles.input}
                    value={localPort}
                    onChangeText={setLocalPort}
                    placeholder="3000"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>URL Pública</Text>
                <TextInput
                  style={styles.input}
                  value={publicUrl}
                  onChangeText={setPublicUrl}
                  placeholder="https://api.meusite.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <TouchableOpacity style={styles.testButton} onPress={handleTestConnection}>
              <Text style={styles.testButtonText}>Salvar e Testar Conexão</Text>
            </TouchableOpacity>
          </View>

          {/* Finalize Count Button */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ações</Text>
            <TouchableOpacity style={styles.finalizeButton} onPress={() => {
              Alert.alert(
                'Finalizar Contagem',
                'Deseja realmente finalizar a contagem atual? Isso moverá os dados para o histórico.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Finalizar',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const res = await api.finalizeCount();
                        Alert.alert('Sucesso', res.message);
                      } catch (error: any) {
                        const msg = error.response?.data?.message || 'Erro desconhecido';
                        Alert.alert('Erro', `Falha ao finalizar: ${msg}`);
                      }
                    }
                  }
                ]
              );
            }}>
              <Text style={styles.finalizeButtonText}>Finalizar Contagem Atual</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },

  scrollContent: { padding: 20 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#000' },

  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333'
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  switchLabel: { fontSize: 16 },

  testButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  testButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  finalizeButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  finalizeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
