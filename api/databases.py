from flask import Flask, request, jsonify, render_template, Blueprint
import fdb
import sqlite3
import os
import datetime

Database_bp = Blueprint('Database_bp', __name__)


# Configuração do Firebird
DATABASE_CONFIG = {
    "host": "192.168.2.33",  # Ou IP do servidor Firebird
    "database": r"C:\Program Files (x86)\CompuFour\Clipp\Base\CLIPP.FDB",
    "user": "SYSDBA",
    "password": "masterkey",
    "charset": "UTF8"
}

# Caminho do arquivo de contagem
datetime.datetime.now().strftime("%d-%m-%Y %H:%M")

diretorio = "C:/contagem_estoque"
if not os.path.exists(diretorio):
    os.makedirs(diretorio)

CAMINHO_ARQUIVO = os.path.join(diretorio, f"contagem_estoque_{datetime.datetime.now().strftime("%d-%m-%Y %H:%M")}.txt")

# Caminho do banco local - DEVE SER EM DIRETÓRIO LOCAL GRAVÁVEL
CAMINHO_DB_LOCAL = os.path.join(diretorio, "contagem_estoque.db")


# Criar banco e tabela, se não existirem
def inicializar_banco():
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cur = conn.cursor()
    
    # Verificar se a tabela sessao existe e precisa de migração
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessao'")
    tabela_existe = cur.fetchone()
    
    if tabela_existe:
        # Verificar estrutura da tabela
        cur.execute("PRAGMA table_info(sessao)")
        colunas = [col[1] for col in cur.fetchall()]
        
        # Se não tem as novas colunas, fazer migração
        if 'atualizado' not in colunas or 'validade' not in colunas:
            print("[MIGRAÇÃO] Atualizando estrutura da tabela sessao...")
            try:
                from datetime import datetime, timedelta
                
                # Criar tabela temporária com nova estrutura
                cur.execute("""
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
                
                # Copiar dados existentes (se houver)
                now = datetime.now().isoformat()
                validade = (datetime.now() + timedelta(minutes=30)).isoformat()
                
                cur.execute("""
                    INSERT INTO sessao_new (SESSION_ID, socket_id, nome_user, data_hora, atualizado, validade, end_ip, user_agent)
                    SELECT SESSION_ID, NULL, nome_user, COALESCE(data_hora, ?), ?, ?, COALESCE(end_ip, ''), COALESCE(user_agent, '')
                    FROM sessao
                """, (now, now, validade))
                
                # Remover tabela antiga e renomear
                cur.execute("DROP TABLE sessao")
                cur.execute("ALTER TABLE sessao_new RENAME TO sessao")
                
                # Criar índices
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sessao_data_hora ON sessao(data_hora)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sessao_atualizado ON sessao(atualizado)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sessao_validade ON sessao(validade)")
                
                conn.commit()
                print("[MIGRAÇÃO] ✅ Tabela sessao atualizada com sucesso!")
            except Exception as e:
                print(f"[MIGRAÇÃO] ❌ Erro na migração: {e}")
                # Em caso de erro, recriar do zero
                cur.execute("DROP TABLE IF EXISTS sessao")
                conn.commit()
    
    # Criar todas as tabelas (se não existirem)
    cur.executescript("""
            CREATE TABLE IF NOT EXISTS contagem_estoque (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT,
            codigo_barras TEXT UNIQUE,
            quantidade INTEGER,
            preco REAL,
            qnt_sist INTERGER,
            nome_user TEXT,
            data_hora timestamp
        );

        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT
        );

        CREATE TABLE IF NOT EXISTS historico_contagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_finalizacao TIMESTAMP,
            total_itens INTEGER,
            valor_total REAL,
            total_divergencias INTEGER
        );

        CREATE TABLE IF NOT EXISTS historico_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_contagem INTEGER,
            codigo_barras TEXT,
            descricao TEXT,
            quantidade INTEGER,
            qnt_sist INTEGER,
            preco REAL,
            FOREIGN KEY(id_contagem) REFERENCES historico_contagens(id)
        );
        CREATE TABLE IF NOT EXISTS sessao(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            SESSION_ID TEXT NOT NULL UNIQUE,
            socket_id TEXT,
            nome_user TEXT,
            data_hora TIMESTAMP NOT NULL,
            atualizado TIMESTAMP NOT NULL,
            validade TIMESTAMP NOT NULL,
            end_ip TEXT,
            user_agent TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sessao_data_hora ON sessao(data_hora);
        CREATE INDEX IF NOT EXISTS idx_sessao_atualizado ON sessao(atualizado);
        CREATE INDEX IF NOT EXISTS idx_sessao_validade ON sessao(validade);
    """)
    conn.commit()
    conn.close()

# Conectar ao banco Firebird
def conectar_firebird():
    try:
        conn = fdb.connect(
            host=DATABASE_CONFIG["host"],
            database=DATABASE_CONFIG["database"],
            user=DATABASE_CONFIG["user"],
            password=DATABASE_CONFIG["password"],
            charset=DATABASE_CONFIG["charset"]
        )
        
        return conn
    except Exception as e:
        print(f"Erro ao conectar ao Firebird: {e}")
        return None
