import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Button
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera'; // Use useCameraPermissions
import { api, ProductResponse, StockItem } from '../../services/api';

export default function LeituraScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  // State
  const [mode, setMode] = useState<'scan' | 'form'>('scan');
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<StockItem[]>([]);

  // Form State
  const [selectedProduct, setSelectedProduct] = useState<ProductResponse | null>(null);
  const [scannedCode, setScannedCode] = useState(''); // The code being saved
  const [qty, setQty] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // --- Live Search Effect ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // Logic: Only search if length >= 3 and NOT numeric (barcode assumption)
      const isNumeric = /^\d+$/.test(searchQuery);
      if (searchQuery.length >= 3 && !isNumeric) {
        performLiveSearch(searchQuery);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 400); // 400ms debounce per backend spec

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performLiveSearch = async (query: string) => {
    try {
      const res = await api.searchStock(query, 1, 10); // Page 1, 10 results per backend spec
      if (res.produtos && res.produtos.length > 0) {
        setSuggestions(res.produtos);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.log('Live search error', error);
    }
  };

  // --- Handlers ---

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || mode !== 'scan') return;
    setScanned(true);
    setScannedCode(data);
    loadProduct(data);
  };

  const handleManualSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchResults([]);

    // Check if query is purely numeric (likely a barcode)
    const isBarcode = /^\d+$/.test(searchQuery);

    if (isBarcode) {
      // Try fetching as product directly
      try {
        const product = await api.getProduct(searchQuery);
        setScannedCode(searchQuery);
        setSelectedProduct(product);
        setMode('form');
        setQty('');
        setNewPrice('');
      } catch (err: any) {
        Alert.alert('Erro', `Falha na busca: ${err.message}`);
      }
    } else {
      // Search by description
      try {
        const res = await api.searchStock(searchQuery);
        if (res.produtos && res.produtos.length > 0) {
          setSearchResults(res.produtos);
        } else {
          Alert.alert('Não encontrado', 'Nenhum produto com esta descrição.');
        }
      } catch (err: any) {
        Alert.alert('Erro', `Falha na busca por descrição: ${err.message}`);
      }
    }
    setLoading(false);
  };

  const loadProduct = async (code: string) => {
    setLoading(true);
    try {
      const product = await api.getProduct(code);
      setSelectedProduct(product);
      setMode('form');
      setQty('');
      setNewPrice(String(product.Preco));
    } catch (error) {
      Alert.alert('Erro', 'Produto não cadastrado ou erro na busca.');
      setScanned(false); // allow ensuring scanning again
    }
    setLoading(false);
  };

  const selectSearchResult = async (item: StockItem) => {
    // When selecting from search list, we treat it as found.
    // We need to fetch full details or just use the item data? 
    // The Contract says `getProduct` returns {Descricao, Preco, Quantidade, ID_ESTOQUE}. 
    // The `searchStock` returns items with {Descricao, Preco, Quantidade, ID_ESTOQUE, codigo_barras}.
    // They are compatible.

    // We set scannedCode to the item's barcode if connected, or empty/generated?
    // User needs to save with a barcode. Use the one from the search result.

    setScannedCode(item.codigo_barras);
    setSelectedProduct({
      Descricao: item.Descricao,
      Preco: item.Preco,
      Quantidade: item.Quantidade,
      ID_ESTOQUE: item.ID_ESTOQUE
    });
    setMode('form');
    setSearchResults([]);
    setSuggestions([]); // Clear suggestions
    setShowSuggestions(false);
    setSearchQuery('');
    setQty('');
    setNewPrice(String(item.Preco));
  };

  const handleSave = async () => {
    if (!selectedProduct) return;

    // Check if we have at least one action
    if (!qty && !newPrice) {
      Alert.alert('Atenção', 'Informe a quantidade ou um novo preço.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        codigo_barras: scannedCode,
        id: parseInt(String(selectedProduct.ID_ESTOQUE), 10), // Force int
      };

      if (qty) {
        payload.quantidade = parseInt(qty, 10);
      }

      if (newPrice) {
        // Replace comma with dot just in case user uses comma decimal
        payload.preco = parseFloat(newPrice.replace(',', '.'));
      }

      await api.saveCount(payload);

      Alert.alert('Sucesso', 'Item salvo!');
      resetState();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Falha desconhecida';
      Alert.alert('Erro', `Falha ao salvar: ${msg}`);
    }
    setLoading(false);
  };

  const resetState = () => {
    setMode('scan');
    setScanned(false);
    setSelectedProduct(null);
    setScannedCode('');
    setQty('');
    setNewPrice('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  // --- Renders ---

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Permissão de câmera necessária.</Text>
        <Button title="Permitir" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Coleta de Estoque</Text>
        </View>

        {mode === 'scan' ? (
          <View style={styles.content}>
            {/* Search Bar */}
            <View style={styles.searchCard}>
              <Text style={styles.label}>Buscar Produto</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Código ou Descrição"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleManualSearch}
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleManualSearch}>
                  <Text style={styles.searchButtonText}>Buscar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Search Suggestions Overlay */}
            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((item) => (
                  <TouchableOpacity
                    key={item.ID_ESTOQUE}
                    style={styles.suggestionItem}
                    onPress={() => selectSearchResult(item)}
                  >
                    <Text style={styles.suggestionText}>{item.Descricao}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* List Results or Camera */}
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => String(item.ID_ESTOQUE)}
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultItem} onPress={() => selectSearchResult(item)}>
                    <Text style={styles.resultTitle}>{item.Descricao}</Text>
                    <Text style={styles.resultSub}>R$ {item.Preco} | Cód: {item.codigo_barras}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.cameraContainer}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
                <View style={styles.overlay}>
                  <Text style={styles.overlayText}>Aponte a câmera para o código</Text>
                </View>
              </View>
            )}

            {loading && <ActivityIndicator size="large" style={styles.loader} />}
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Item Identificado</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Produto:</Text>
                <Text style={styles.infoValue}>{selectedProduct?.Descricao}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Código:</Text>
                <Text style={styles.infoValue}>{scannedCode}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Preço Atual:</Text>
                <Text style={styles.infoValue}>R$ {selectedProduct?.Preco}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.label}>Quantidade Contada *</Text>
              <TextInput
                style={styles.inputLarge}
                value={qty}
                onChangeText={setQty}
                keyboardType="numeric"
                placeholder="0"
                autoFocus
              />

              <Text style={styles.label}>Novo Preço (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="numeric"
                placeholder="R$ 0,00"
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={resetState}>
                  <Text style={styles.buttonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
                  <Text style={styles.buttonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  content: { flex: 1, padding: 15 },

  // Search
  searchCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 1 // Ensure below suggestions
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 90, // Adjust based on header/search bar height
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    zIndex: 10,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  suggestionText: {
    fontSize: 14,
    color: '#333'
  },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fafafa'
  },
  searchButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 8
  },
  searchButtonText: { color: '#fff', fontWeight: 'bold' },

  // Camera
  cameraContainer: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
    minHeight: 300,
    backgroundColor: '#000'
  },
  overlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 20
  },
  overlayText: { color: '#fff' },

  // List
  list: { flex: 1 },
  resultItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    elevation: 1
  },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  resultSub: { color: '#666' },

  // Form
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    elevation: 3
  },
  cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoLabel: { color: '#666', fontSize: 16 },
  infoValue: { fontSize: 16, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 },

  label: { fontSize: 14, color: '#555', marginBottom: 6, marginTop: 10, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa'
  },
  inputLarge: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    backgroundColor: '#f0f8ff',
    textAlign: 'center',
    fontWeight: 'bold'
  },

  buttonRow: { flexDirection: 'row', gap: 15, marginTop: 30 },
  button: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  cancelButton: { backgroundColor: '#ff3b30' },
  saveButton: { backgroundColor: '#34c759' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  loader: { marginTop: 20 }
});
