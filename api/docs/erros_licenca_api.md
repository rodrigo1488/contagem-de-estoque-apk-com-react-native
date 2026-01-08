# Respostas de Erro de Licença - API

Este documento descreve **exclusivamente** as respostas de erro relacionadas à validação de licença.

## Status HTTP: 403 (Forbidden)

Todas as rotas protegidas retornam **HTTP 403** quando há problema com a licença.

## Estrutura da Resposta de Erro

```json
{
  "erro": "Mensagem descritiva do erro",
  "acesso_negado": true
}
```

## Cenários de Erro

### 1. Licença Suspensa (acesso = false)

**Quando ocorre:** Campo `acesso` está definido como `false` no Supabase

**Resposta:**
```json
{
  "erro": "Licença suspensa. Renove sua licença.",
  "acesso_negado": true
}
```

**Status HTTP:** `403`

---

### 2. Licença Vencida (validade expirada)

**Quando ocorre:** Data atual é posterior à data no campo `validade`

**Resposta:**
```json
{
  "erro": "Licença vencida em 31/12/2025. Renove sua licença.",
  "acesso_negado": true
}
```

**Status HTTP:** `403`

**Nota:** A data é formatada como DD/MM/YYYY

---

### 3. Serial Não Encontrado

**Quando ocorre:** Serial do Firebird não existe na tabela `companies` do Supabase

**Resposta:**
```json
{
  "erro": "Serial não encontrado. Entre em contato com o suporte.",
  "acesso_negado": true
}
```

**Status HTTP:** `403`

---

### 4. Erro ao Obter Serial do Firebird

**Quando ocorre:** Não foi possível ler o serial da tabela `RDB$SUP`

**Resposta:**
```json
{
  "erro": "Não foi possível obter o serial do sistema",
  "acesso_negado": true
}
```

**Status HTTP:** `403`

---

### 5. Número de Acessos Excedido (FUTURO)

**Quando ocorre:** Número de conexões simultâneas excede `numero_acessos`

**Resposta (quando implementado):**
```json
{
  "erro": "Número máximo de acessos simultâneos excedido (5/5). Aguarde ou adquira mais licenças.",
  "acesso_negado": true,
  "limite_acessos": 5,
  "acessos_atuais": 5
}
```

**Status HTTP:** `403`

**⚠️ IMPORTANTE:** Este cenário ainda **NÃO está implementado**. O campo `numero_acessos` existe no banco mas não é validado atualmente.

---

## Rotas Afetadas

Todas estas rotas podem retornar os erros acima:

- `GET /produto/<codigo_barras>`
- `GET /estoque/<descricao>`
- `POST /salvar`
- `POST /salvar/<nome_usuario>`
- `PUT /editar/<item_id>`
- `DELETE /excluir/<item_id>`
- `POST /finalizar-contagem`
- `GET /download-historico/<filename>`

## Como Tratar no Expo/React Native

### Exemplo de Tratamento

```javascript
const handleApiResponse = async (response) => {
  if (response.status === 403) {
    const data = await response.json();
    
    if (data.acesso_negado) {
      // Identificar tipo de erro pela mensagem
      let titulo = '⚠️ LICENÇA INVÁLIDA';
      let mensagem = data.erro;
      
      // Customizar título baseado no tipo de erro
      if (data.erro.includes('vencida')) {
        titulo = '⏰ LICENÇA VENCIDA';
      } else if (data.erro.includes('suspensa')) {
        titulo = '🚫 LICENÇA SUSPENSA';
      } else if (data.erro.includes('Serial não encontrado')) {
        titulo = '❓ SERIAL NÃO CADASTRADO';
      } else if (data.erro.includes('acessos')) {
        titulo = '👥 LIMITE DE ACESSOS EXCEDIDO';
      }
      
      Alert.alert(
        titulo,
        mensagem,
        [
          {
            text: 'Entrar em Contato',
            onPress: () => {
              // Abrir WhatsApp, email, etc
              Linking.openURL('https://wa.me/5511999999999');
            }
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
      
      throw new Error(data.erro);
    }
  }
  
  return response;
};
```

### Exemplo de Uso em Requisição

```javascript
const buscarProduto = async (codigo) => {
  try {
    const response = await fetch(`${API_URL}/produto/${codigo}`);
    
    // Verificar erro de licença
    await handleApiResponse(response);
    
    // Se chegou aqui, licença está OK
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    // Erro já foi mostrado no Alert
    return { success: false, error: error.message };
  }
};
```

## Fluxo de Validação

```
┌─────────────────────┐
│  Requisição à API   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Buscar Serial no FB │
└──────────┬──────────┘
           │
           ├─── Serial não encontrado? ──► 403: "Não foi possível obter serial"
           │
           ▼
┌─────────────────────┐
│ Consultar Supabase  │
└──────────┬──────────┘
           │
           ├─── Empresa não existe? ──────► 403: "Serial não encontrado"
           │
           ├─── acesso = false? ──────────► 403: "Licença suspensa"
           │
           ├─── validade < hoje? ─────────► 403: "Licença vencida em DD/MM/YYYY"
           │
           ├─── [FUTURO] acessos > limite? ► 403: "Limite de acessos excedido"
           │
           ▼
┌─────────────────────┐
│   Licença Válida    │
│   Processar Request │
└─────────────────────┘
```

## Tabela Resumo

| Condição | Campo Supabase | Mensagem de Erro | Implementado |
|----------|----------------|------------------|--------------|
| Licença suspensa | `acesso = false` | "Licença suspensa. Renove sua licença." | ✅ Sim |
| Licença vencida | `validade < hoje` | "Licença vencida em DD/MM/YYYY. Renove sua licença." | ✅ Sim |
| Serial não cadastrado | Serial não existe | "Serial não encontrado. Entre em contato com o suporte." | ✅ Sim |
| Erro ao ler serial | Firebird inacessível | "Não foi possível obter o serial do sistema" | ✅ Sim |
| Limite de acessos | `numero_acessos` | "Número máximo de acessos simultâneos excedido" | ❌ Não (futuro) |

## Cache e Atualização

- **TTL do Cache:** 60 segundos
- **Revalidação:** Automática a cada 1 minuto
- **Forçar Revalidação:** `POST /admin/revalidar-licenca`

Após alterar dados no Supabase:
- Aguardar até 60 segundos para atualização automática, **OU**
- Chamar endpoint de revalidação para atualização imediata

## Exemplo de Tela de Erro no App

```javascript
// ErrorScreen.js
import React from 'react';
import { View, Text, Button, Linking } from 'react-native';

export default function LicenseErrorScreen({ route }) {
  const { errorMessage } = route.params;
  
  const handleContact = () => {
    Linking.openURL('https://wa.me/5511999999999?text=Preciso renovar minha licença');
  };
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 48, marginBottom: 20 }}>⚠️</Text>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
        Licença Inválida
      </Text>
      <Text style={{ textAlign: 'center', marginBottom: 30 }}>
        {errorMessage}
      </Text>
      <Button 
        title="Renovar Licença" 
        onPress={handleContact}
      />
    </View>
  );
}
```
