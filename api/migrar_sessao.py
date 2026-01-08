import sqlite3
import os
from datetime import datetime, timedelta

# Caminho do banco
CAMINHO_DB = "C:/contagem_estoque/contagem_estoque.db"

def migrar_tabela_sessao():
    """
    Migra a tabela sessao adicionando as colunas atualizado e validade
    """
    if not os.path.exists(CAMINHO_DB):
        print("Banco de dados não existe. Será criado na primeira execução.")
        return
    
    try:
        conn = sqlite3.connect(CAMINHO_DB)
        cursor = conn.cursor()
        
        # Verificar se a tabela sessao existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessao'")
        if not cursor.fetchone():
            print("Tabela sessao não existe. Será criada na primeira execução.")
            conn.close()
            return
        
        # Verificar se as colunas já existem
        cursor.execute("PRAGMA table_info(sessao)")
        colunas = [col[1] for col in cursor.fetchall()]
        
        if 'atualizado' in colunas and 'validade' in colunas:
            print("✅ Colunas 'atualizado' e 'validade' já existem. Nenhuma migração necessária.")
            conn.close()
            return
        
        print("🔄 Iniciando migração da tabela sessao...")
        
        # SQLite não suporta ADD COLUMN com NOT NULL diretamente
        # Precisamos recriar a tabela
        
        # 1. Criar tabela temporária com nova estrutura
        cursor.execute("""
            CREATE TABLE sessao_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                SESSION_ID TEXT NOT NULL UNIQUE,
                socket_id TEXT,
                nome_user TEXT,
                data_hora TIMESTAMP NOT NULL,
                atualizado TIMESTAMP NOT NULL,
                validade TIMESTAMP NOT NULL,
                end_ip TEXT,
                user_agent TEXT
            )
        """)
        
        # 2. Copiar dados existentes (se houver)
        now = datetime.now().isoformat()
        validade = (datetime.now() + timedelta(minutes=30)).isoformat()
        
        cursor.execute("""
            INSERT INTO sessao_new (SESSION_ID, socket_id, nome_user, data_hora, atualizado, validade, end_ip, user_agent)
            SELECT SESSION_ID, NULL, nome_user, data_hora, ?, ?, end_ip, user_agent
            FROM sessao
        """, (now, validade))
        
        registros_migrados = cursor.rowcount
        
        # 3. Remover tabela antiga
        cursor.execute("DROP TABLE sessao")
        
        # 4. Renomear tabela nova
        cursor.execute("ALTER TABLE sessao_new RENAME TO sessao")
        
        # 5. Criar índices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessao_data_hora ON sessao(data_hora)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessao_atualizado ON sessao(atualizado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessao_validade ON sessao(validade)")
        
        conn.commit()
        conn.close()
        
        print(f"✅ Migração concluída com sucesso!")
        print(f"   - {registros_migrados} sessões migradas")
        print(f"   - Colunas 'atualizado' e 'validade' adicionadas")
        print(f"   - Coluna 'socket_id' adicionada para suporte WebSocket")
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("=" * 60)
    print("MIGRAÇÃO DA TABELA SESSAO")
    print("=" * 60)
    migrar_tabela_sessao()
    print("=" * 60)
