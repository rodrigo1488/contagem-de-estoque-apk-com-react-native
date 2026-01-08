# Sistema de Licenciamento

## Visão Geral

O sistema implementa validação de licença usando Supabase como backend. A validação é feita por serial do Firebird e controla acesso às funcionalidades críticas.

## Estrutura da Tabela `companies`

```sql
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  acesso boolean DEFAULT true,
  numero_acessos bigint,
  nome text,
  documento text UNIQUE,
  validade date,
  serial text
);
```

## Campos e Validações

### 1. `acesso` (boolean)
- **Descrição**: Flag principal de controle de acesso
- **Validação**: Se `false`, bloqueia todas as operações protegidas
- **Mensagem de erro**: "Licença suspensa. Renove sua licença."

### 2. `validade` (date)
- **Descrição**: Data de vencimento da licença
- **Validação**: Compara com a data atual. Se vencida, bloqueia acesso
- **Mensagem de erro**: "Licença vencida em DD/MM/YYYY. Renove sua licença."
- **Comportamento**: Automaticamente define `acesso = false` se vencida

### 3. `numero_acessos` (bigint)
- **Descrição**: Número máximo de conexões simultâneas permitidas
- **Status**: Campo preparado para implementação futura
- **Uso futuro**: Controlar quantidade de usuários conectados simultaneamente

### 4. `serial` (text)
- **Descrição**: Serial único do sistema Firebird (NSE_CLIPP)
- **Uso**: Identificação da instalação

## Rotas Protegidas

As seguintes rotas requerem licença válida:

### Busca de Produtos
- `GET /produto/<codigo_barras>` - Busca por código de barras
- `GET /estoque/<descricao>` - Busca por descrição

### Operações de Estoque
- `POST /salvar` - Salvar item contado
- `POST /salvar/<nome_usuario>` - Salvar com usuário
- `PUT /editar/<item_id>` - Editar quantidade
- `DELETE /excluir/<item_id>` - Excluir item

### Finalização e Download
- `POST /finalizar-contagem` - Finalizar inventário
- `GET /download-historico/<filename>` - Download de TXT

## Funcionamento

### Cache de Licença
- **TTL**: 60 segundos (1 minuto)
- **Objetivo**: Balancear performance com atualização rápida
- **Comportamento**: Após validação bem-sucedida, resultado é cacheado por 1 minuto

### Revalidação Manual
Para forçar uma revalidação imediata (útil após alterar dados no Supabase):

```bash
POST /admin/revalidar-licenca
```

Resposta:
```json
{
  "mensagem": "Cache limpo e licença revalidada",
  "status": {
    "valido": true,
    "mensagem": "Licença válida",
    "acesso": true
  }
}
```

### Fluxo de Validação

1. **Obter Serial**: Busca `NSE_CLIPP` na tabela `RDB$SUP` do Firebird
2. **Consultar Supabase**: Busca empresa pelo serial
3. **Validar Acesso**: Verifica campo `acesso`
4. **Validar Validade**: Compara data de vencimento com data atual
5. **Retornar Resultado**: Permite ou bloqueia acesso

### Respostas de Erro

Quando a licença é inválida, retorna HTTP 403:

```json
{
  "erro": "Mensagem específica do erro",
  "acesso_negado": true
}
```

## Exemplos de Uso

### Licença Válida
```json
{
  "acesso": true,
  "validade": "2026-12-31",
  "numero_acessos": 5
}
```
✅ Todas as operações permitidas

### Licença Suspensa
```json
{
  "acesso": false,
  "validade": "2026-12-31"
}
```
❌ Erro: "Licença suspensa. Renove sua licença."

### Licença Vencida
```json
{
  "acesso": true,
  "validade": "2025-12-31"
}
```
❌ Erro: "Licença vencida em 31/12/2025. Renove sua licença."

## Manutenção

### Limpar Cache Manualmente
```python
from license_validator import limpar_cache_licenca
limpar_cache_licenca()
```

### Configuração do Supabase
As credenciais estão em `license_validator.py`:
- URL: `SUPABASE_URL`
- API Key: `SUPABASE_API_KEY`

## Segurança

- ✅ Validação server-side em todas as rotas críticas
- ✅ Cache com TTL para performance
- ✅ Timeout de 5 segundos nas requisições ao Supabase
- ✅ Tratamento de erros robusto
- ⚠️ API Key exposta no código (considerar variáveis de ambiente)
