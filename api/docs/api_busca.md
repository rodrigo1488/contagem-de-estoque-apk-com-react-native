# Documentação da API de Busca de Produtos

Esta documentação descreve os endpoints de busca de produtos no sistema.

## 1. Busca por Código de Barras

**Rota:** `/produto/<codigo_barras>`
**Método:** `GET`
**Descrição:** Busca um produto específico pelo código de barras.

### Parâmetros
- `codigo_barras` (path): Código de barras do produto

### Resposta de Sucesso (200)
```json
{
  "Descricao": "COCA COLA 2L",
  "Preco": 8.50,
  "Quantidade": 100,
  "ID_ESTOQUE": 12345
}
```

### Resposta de Erro (404)
```json
{
  "erro": "Produto não encontrado"
}
```

---

## 2. Busca por Descrição (com Paginação)

**Rota:** `/estoque/<descricao>`
**Método:** `GET`
**Descrição:** Busca produtos pela descrição com suporte a paginação.

### Parâmetros
- `descricao` (path): Termo de busca (case-insensitive)
- `page` (query, opcional): Número da página (padrão: 1)
- `per_page` (query, opcional): Itens por página (padrão: 10)

### Exemplo de Requisição
```
GET /estoque/coca?page=1&per_page=10
```

### Resposta de Sucesso (200)
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
    },
    {
      "Descricao": "COCA COLA ZERO 2L",
      "Preco": 8.50,
      "Quantidade": 50,
      "ID_ESTOQUE": 12346,
      "codigo_barras": "7894900011524"
    }
  ]
}
```

### Resposta de Erro (500)
```json
{
  "erro": "Mensagem de erro"
}
```

---

## 3. Comportamento do Frontend

### Busca Automática (Live Search)
- Ativa após 3 caracteres digitados
- Debounce de 400ms
- Ignora strings numéricas longas (códigos de barras)
- Mostra dropdown com até 10 resultados

### Busca Manual (Botão)
- Detecta automaticamente se é código de barras (apenas números) ou descrição (contém letras)
- Se for código de barras: busca direta via `/produto/<codigo>`
- Se for descrição: busca via `/estoque/<descricao>`
- Se houver apenas 1 resultado: abre modal diretamente
- Se houver múltiplos resultados: mostra modal de seleção

### Filtros Aplicados
- Apenas produtos com `STATUS = 'A'` (ativos)
- Ordenação alfabética por descrição
- Busca case-insensitive usando `LOWER()`
