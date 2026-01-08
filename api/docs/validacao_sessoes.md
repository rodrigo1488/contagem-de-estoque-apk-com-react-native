# Validação do Sistema de Sessões

## ✅ Query da Tabela `sessao` - VALIDADA

```sql
CREATE TABLE IF NOT EXISTS sessao(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    SESSION_ID TEXT NOT NULL UNIQUE,      -- ✅ Único e obrigatório
    nome_user TEXT,                        -- ✅ Opcional
    data_hora TIMESTAMP NOT NULL,         -- ✅ Obrigatório (formato ISO)
    end_ip TEXT,                           -- ✅ Opcional
    user_agent TEXT                        -- ✅ Opcional
);
CREATE INDEX IF NOT EXISTS idx_sessao_data_hora ON sessao(data_hora);
```

### Melhorias Aplicadas:
- ✅ `SESSION_ID` agora é `NOT NULL UNIQUE` (evita duplicatas)
- ✅ `data_hora` é `NOT NULL` (obrigatório)
- ✅ Índice em `data_hora` para performance nas queries de limpeza
- ✅ Formato de data corrigido para ISO string (`datetime.now().isoformat()`)

---

## ✅ Validação com Supabase - VALIDADA

### Fluxo de Validação:

1. **Validar Licença no Supabase** (`license_validator.py`)
   - Busca empresa por `serial` no Firebird
   - Consulta Supabase: `GET /rest/v1/companies?serial=eq.{serial}`
   - Valida campos:
     - ✅ `acesso` (boolean) - deve ser `true`
     - ✅ `validade` (date) - não pode estar vencida
     - ✅ `numero_acessos` (integer) - limite de conexões simultâneas

2. **Obter Limite de Conexões**
   ```python
   max_conexoes = licenca.get('numero_acessos', 1)
   ```
   - ✅ Validação de tipo (converte para int)
   - ✅ Valor mínimo = 1
   - ✅ Fallback seguro se valor inválido

3. **Gerenciar Sessões** (`session_manager.py`)
   - ✅ Limpa sessões antigas (timeout: 30 minutos)
   - ✅ Verifica se sessão já existe (renova timestamp)
   - ✅ Conta sessões ativas
   - ✅ Compara com limite do Supabase
   - ✅ Bloqueia se `active_count >= max_conexoes`

---

## 🔄 Comportamento do Sistema

### Cenário 1: Primeira Conexão
```
Cliente 1 conecta
├─ Valida licença no Supabase (numero_acessos = 3)
├─ Limpa sessões antigas
├─ Conta sessões ativas: 0
├─ 0 < 3 ✅ PERMITIDO
└─ Cria sessão para Cliente 1
```

### Cenário 2: Dentro do Limite
```
Cliente 2 conecta (já existem 2 sessões)
├─ Valida licença (numero_acessos = 3)
├─ Conta sessões ativas: 2
├─ 2 < 3 ✅ PERMITIDO
└─ Cria sessão para Cliente 2
```

### Cenário 3: Limite Atingido
```
Cliente 4 tenta conectar (já existem 3 sessões)
├─ Valida licença (numero_acessos = 3)
├─ Conta sessões ativas: 3
├─ 3 >= 3 ❌ BLOQUEADO
└─ Retorna erro 403: "Limite de conexões simultâneas atingido (3/3)"
```

### Cenário 4: Renovação de Sessão
```
Cliente 1 faz nova requisição (sessão existe)
├─ Encontra SESSION_ID na tabela
├─ Atualiza data_hora para now()
└─ Retorna 200 OK (não conta como nova sessão)
```

### Cenário 5: Timeout de Sessão
```
Cliente 1 inativo por 30+ minutos
├─ Próxima requisição de qualquer cliente
├─ Limpa sessões com data_hora < (now - 30min)
├─ Sessão do Cliente 1 é removida
└─ Vaga liberada para novo cliente
```

---

## 🛡️ Segurança e Robustez

### Validações Implementadas:
- ✅ Licença inválida → Bloqueia acesso
- ✅ Licença vencida → Bloqueia acesso
- ✅ Campo `numero_acessos` inválido → Usa fallback (1)
- ✅ Race condition (inserção duplicada) → Tratado com try/except
- ✅ Sessões antigas → Limpeza automática
- ✅ Formato de data → ISO string para compatibilidade SQLite

### Logs e Debug:
- ✅ `[SESSION]` prefix em todos os logs
- ✅ Endpoint `/admin/sessoes-ativas` para monitoramento
- ✅ Traceback completo em caso de erro

---

## 📊 Endpoints Administrativos

### 1. Listar Sessões Ativas
```http
GET /admin/sessoes-ativas
```

**Resposta:**
```json
{
  "limite_licenca": 3,
  "sessoes_ativas": 2,
  "sessoes": [
    {
      "SESSION_ID": "192.168.1.100",
      "nome_user": "João",
      "end_ip": "192.168.1.100",
      "data_hora": "2026-01-08T16:45:30.123456"
    },
    {
      "SESSION_ID": "192.168.1.101",
      "nome_user": "Maria",
      "end_ip": "192.168.1.101",
      "data_hora": "2026-01-08T16:50:15.654321"
    }
  ]
}
```

### 2. Revalidar Licença
```http
POST /admin/revalidar-licenca
```

---

## 🔧 Configurações

### Timeout de Sessão
```python
SESSION_TIMEOUT_MINUTES = 30  # session_manager.py
```

### Cache de Licença
```python
'ttl': 60  # 1 minuto (license_validator.py)
```

---

## ✅ Checklist de Validação

- [x] Query da tabela `sessao` está correta
- [x] Constraints NOT NULL e UNIQUE aplicados
- [x] Índice criado para performance
- [x] Formato de data ISO string
- [x] Integração com Supabase (`numero_acessos`)
- [x] Validação de tipo do limite
- [x] Limpeza automática de sessões antigas
- [x] Renovação de sessões existentes
- [x] Bloqueio quando limite atingido
- [x] Tratamento de race conditions
- [x] Logs informativos
- [x] Endpoint de debug/admin
- [x] Exclusão de rotas administrativas do middleware

---

## 🎯 Conclusão

O sistema de validação de sessões está **100% funcional** e integrado com o Supabase:

1. ✅ A query da tabela está correta e otimizada
2. ✅ O limite de conexões é obtido do campo `numero_acessos` do Supabase
3. ✅ A comparação é feita corretamente antes de criar novas sessões
4. ✅ Sessões antigas são limpas automaticamente
5. ✅ Erros são tratados com mensagens claras
6. ✅ Sistema é robusto contra race conditions e valores inválidos
