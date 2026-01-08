# Guia de Integração - Aplicativo Expo com API de Contagem

Este documento descreve como integrar o aplicativo Expo com a API de contagem de estoque, incluindo tratamento de erros de licença.

## 1. Configuração Base


``=

## 2. Tratamento de Erros de Licença

### Função Global de Tratamento
```javascript
// utils/apiHandler.js
import { Alert } from 'react-native';

export const handleApiResponse = async (response) => {
  // Verificar erro de licença (403)
  if (response.status === 403) {
    const data = await response.json();
    
    if (data.acesso_negado) {
      // Mostrar alerta de licença inválida
      Alert.alert(
        '⚠️ LICENÇA INVÁLIDA',
        data.erro,
        [
          {
            text: 'OK',
            onPress: () => {
              // Opcional: Redirecionar para tela de contato/suporte
              // navigation.navigate('Suporte');
            }
          }
        ],
        { cancelable: false }
      );
      
      throw new Error(data.erro);
    }
  }
  
  // Verificar outros erros HTTP
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.erro || 'Erro na requisição');
  }
  
  return response;
};
```

## 3. Exemplos de Uso por Endpoint

### 3.1 Busca por Código de Barras

```javascript
// services/productService.js
import { API_CONFIG } from '../config';
import { handleApiResponse } from '../utils/apiHandler';

export const buscarPorCodigoBarras = async (codigoBarras) => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/produto/${codigoBarras}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: API_CONFIG.TIMEOUT
      }
    );
    
    await handleApiResponse(response);
    const data = await response.json();
    
    return {
      success: true,
      produto: {
        descricao: data.Descricao,
        preco: parseFloat(data.Preco),
        quantidade: data.Quantidade,
        idEstoque: data.ID_ESTOQUE
      }
    };
    
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

**Resposta de Sucesso (200):**
```json
{
  "Descricao": "COCA COLA 2L",
  "Preco": 8.50,
  "Quantidade": 100,
  "ID_ESTOQUE": 12345
}
```

**Resposta de Erro - Licença Inválida (403):**
```json
{
  "erro": "Licença vencida em 31/12/2025. Renove sua licença.",
  "acesso_negado": true
}
```

### 3.2 Busca por Descrição (com Paginação)

```javascript
export const buscarPorDescricao = async (termo, page = 1, perPage = 10) => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/estoque/${encodeURIComponent(termo)}?page=${page}&per_page=${perPage}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    await handleApiResponse(response);
    const data = await response.json();
    
    return {
      success: true,
      produtos: data.produtos.map(p => ({
        descricao: p.Descricao,
        preco: parseFloat(p.Preco),
        quantidade: p.Quantidade,
        idEstoque: p.ID_ESTOQUE,
        codigoBarras: p.codigo_barras
      })),
      paginacao: {
        page: data.page,
        perPage: data.per_page,
        total: data.total,
        totalPaginas: Math.ceil(data.total / data.per_page)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

**Resposta de Sucesso (200):**
```json
{
  "page": 1,
  "per_page": 10,
  "total": 25,
  "produtos": [
    {
      "Descricao": "COCA COLA 2L",
      "Preco": 8.50,
      "Quantidade": 100,
      "ID_ESTOQUE": 12345,
      "codigo_barras": "7894900011517"
    }
  ]
}
```

### 3.3 Salvar Item Contado

```javascript
export const salvarItem = async (itemData, nomeUsuario = null) => {
  try {
    const url = nomeUsuario 
      ? `${API_CONFIG.BASE_URL}/salvar/${nomeUsuario}`
      : `${API_CONFIG.BASE_URL}/salvar`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        codigo_barras: itemData.codigoBarras,
        quantidade: itemData.quantidade,
        preco: itemData.preco,
        descricao: itemData.descricao,
        qnt_sist: itemData.quantidadeSistema,
        ID_ESTOQUE: itemData.idEstoque
      })
    });
    
    await handleApiResponse(response);
    const data = await response.json();
    
    return {
      success: true,
      mensagem: data.mensagem
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

### 3.4 Editar Item

```javascript
export const editarItem = async (itemId, novaQuantidade) => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/editar/${itemId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantidade: novaQuantidade
        })
      }
    );
    
    await handleApiResponse(response);
    const data = await response.json();
    
    return {
      success: true,
      mensagem: data.mensagem
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

### 3.5 Excluir Item

```javascript
export const excluirItem = async (itemId) => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/excluir/${itemId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    await handleApiResponse(response);
    const data = await response.json();
    
    return {
      success: true,
      mensagem: data.mensagem
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

### 3.6 Finalizar Contagem

```javascript
export const finalizarContagem = async () => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/finalizar-contagem`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    await handleApiResponse(response);
    const data = await response.json();
    
    return {
      success: true,
      mensagem: data.message,
      idContagem: data.id_contagem,
      divergencias: data.divergencias,
      downloadUrl: data.download_url
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

### 3.7 Dashboard Stats

```javascript
export const getDashboardStats = async () => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/dashboard-stats`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    await handleApiResponse(response);
    const data = await response.json();
    
    return {
      success: true,
      stats: {
        totalItens: data.total_itens_coletados,
        valorDivergencia: parseFloat(data.valor_divergencia),
        totalDivergencias: data.total_divergencias,
        contagensFinalizadas: data.contagens_finalizadas,
        itensRecentes: data.itens_recentes
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

## 4. Componente de Exemplo (React Native)

```javascript
// screens/BuscarProdutoScreen.js
import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert } from 'react-native';
import { buscarPorCodigoBarras } from '../services/productService';

export default function BuscarProdutoScreen() {
  const [codigoBarras, setCodigoBarras] = useState('');
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBuscar = async () => {
    if (!codigoBarras.trim()) {
      Alert.alert('Atenção', 'Digite um código de barras');
      return;
    }

    setLoading(true);
    const resultado = await buscarPorCodigoBarras(codigoBarras);
    setLoading(false);

    if (resultado.success) {
      setProduto(resultado.produto);
    } else {
      // Erro já foi tratado pelo handleApiResponse
      // Apenas limpar o produto se houver
      setProduto(null);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="Código de Barras"
        value={codigoBarras}
        onChangeText={setCodigoBarras}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <Button 
        title={loading ? "Buscando..." : "Buscar"} 
        onPress={handleBuscar}
        disabled={loading}
      />

      {produto && (
        <View style={{ marginTop: 20 }}>
          <Text>Descrição: {produto.descricao}</Text>
          <Text>Preço: R$ {produto.preco.toFixed(2)}</Text>
          <Text>Quantidade: {produto.quantidade}</Text>
        </View>
      )}
    </View>
  );
}
```

## 5. Tratamento de Erros Específicos

### Tabela de Status HTTP

| Status | Significado | Ação Recomendada |
|--------|-------------|------------------|
| 200 | Sucesso | Processar dados normalmente |
| 400 | Requisição inválida | Validar dados enviados |
| 403 | Licença inválida | Mostrar alerta e bloquear funcionalidade |
| 404 | Não encontrado | Informar usuário que item não existe |
| 500 | Erro no servidor | Tentar novamente ou contatar suporte |

### Exemplo de Tratamento Completo

```javascript
const handleRequest = async (requestFunction) => {
  try {
    const result = await requestFunction();
    
    if (result.success) {
      return result;
    } else {
      // Erro já tratado, apenas propagar
      throw new Error(result.error);
    }
  } catch (error) {
    // Log para debug
    console.error('Erro na requisição:', error);
    
    // Não mostrar alert aqui se já foi mostrado no handleApiResponse
    // Apenas retornar erro
    return {
      success: false,
      error: error.message
    };
  }
};
```

## 6. Boas Práticas

1. **Sempre use `handleApiResponse`** antes de processar a resposta
2. **Não mostre alertas duplicados** - o erro de licença já é tratado globalmente
3. **Use try/catch** em todas as chamadas de API
4. **Valide dados** antes de enviar para a API
5. **Implemente retry logic** para erros de rede temporários
6. **Cache dados** quando apropriado para melhor UX offline
7. **Mostre loading states** durante requisições

## 7. Revalidação de Licença (Opcional)

Se quiser implementar um botão de "Verificar Licença" no app:

```javascript
export const revalidarLicenca = async () => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/admin/revalidar-licenca`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    const data = await response.json();
    
    return {
      success: true,
      status: data.status
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

## 8. Resumo de Endpoints Protegidos

Todos estes endpoints retornam **403** se a licença estiver inválida:

- `GET /produto/<codigo_barras>`
- `GET /estoque/<descricao>`
- `POST /salvar`
- `PUT /editar/<item_id>`
- `DELETE /excluir/<item_id>`
- `POST /finalizar-contagem`
- `GET /download-historico/<filename>`

**Endpoints NÃO protegidos:**
- `GET /` (página inicial)
- `GET /dashboard-stats`
- `GET /listar-historico`
- `GET /listar-contagem`
