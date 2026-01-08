from datetime import datetime, timedelta
import sqlite3
from databases import CAMINHO_DB_LOCAL
from license_validator import validar_licenca

# Configurações
SESSION_MAX_LIFETIME_MINUTES = 30    # Tempo máximo total de vida da sessão
HEARTBEAT_INTERVAL_SECONDS = 30      # Cliente deve enviar heartbeat a cada 30s

def get_db_connection():
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    conn.row_factory = sqlite3.Row
    return conn

def criar_sessao_websocket(session_id, socket_id, ip, user_agent, username=None):
    """
    Cria uma nova sessão quando o cliente conecta via WebSocket
    """
    # 1. Validar licença
    licenca = validar_licenca()
    if not licenca.get('valido', False):
        return False, licenca.get('mensagem', 'Licença inválida')
    
    # 2. Obter limite de conexões
    max_conexoes = licenca.get('numero_acessos', 1)
    try:
        max_conexoes = int(max_conexoes)
        if max_conexoes < 1:
            max_conexoes = 1
    except (ValueError, TypeError):
        max_conexoes = 1
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now()
        now_iso = now.isoformat()
        validade = (now + timedelta(minutes=SESSION_MAX_LIFETIME_MINUTES)).isoformat()

        # 3. Verificar se já existe sessão para este session_id
        cursor.execute("SELECT id FROM sessao WHERE SESSION_ID = ?", (session_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Atualizar socket_id e timestamps
            cursor.execute("""
                UPDATE sessao 
                SET socket_id = ?, atualizado = ?, validade = ?, end_ip = ?, user_agent = ?
                WHERE SESSION_ID = ?
            """, (socket_id, now_iso, validade, ip, user_agent, session_id))
            conn.commit()
            conn.close()
            print(f"[WEBSOCKET] Sessão atualizada: {session_id} -> socket {socket_id}")
            return True, "Sessão reconectada"

        # 4. Verificar limite
        cursor.execute("SELECT COUNT(*) FROM sessao")
        active_count = cursor.fetchone()[0]

        if active_count >= max_conexoes:
            conn.close()
            print(f"[WEBSOCKET] Limite excedido: {active_count}/{max_conexoes}")
            return False, f"Limite de conexões simultâneas atingido ({active_count}/{max_conexoes})"
        
        # 5. Criar nova sessão
        cursor.execute("""
            INSERT INTO sessao (SESSION_ID, socket_id, end_ip, user_agent, nome_user, data_hora, atualizado, validade)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, socket_id, ip, user_agent, username or 'Desconhecido', now_iso, now_iso, validade))
        conn.commit()
        conn.close()
        
        print(f"[WEBSOCKET] Nova sessão criada: {session_id} -> socket {socket_id} ({active_count + 1}/{max_conexoes})")
        return True, f"Sessão criada ({active_count + 1}/{max_conexoes})"
        
    except Exception as e:
        print(f"Erro ao criar sessão WebSocket: {e}")
        import traceback
        traceback.print_exc()
        return False, f"Erro interno: {str(e)}"

def atualizar_heartbeat_websocket(socket_id):
    """
    Atualiza o timestamp de uma sessão quando recebe heartbeat
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()
        
        cursor.execute("""
            UPDATE sessao 
            SET atualizado = ?
            WHERE socket_id = ?
        """, (now_iso, socket_id))
        
        updated = cursor.rowcount
        conn.commit()
        conn.close()
        
        if updated > 0:
            print(f"[WEBSOCKET] Heartbeat recebido: socket {socket_id}")
            return True
        else:
            print(f"[WEBSOCKET] Sessão não encontrada para socket {socket_id}")
            return False
            
    except Exception as e:
        print(f"Erro ao atualizar heartbeat: {e}")
        return False

def remover_sessao_websocket(socket_id):
    """
    Remove uma sessão quando o cliente desconecta
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Buscar informações antes de remover
        cursor.execute("SELECT SESSION_ID, nome_user FROM sessao WHERE socket_id = ?", (socket_id,))
        sessao = cursor.fetchone()
        
        cursor.execute("DELETE FROM sessao WHERE socket_id = ?", (socket_id,))
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        if deleted > 0 and sessao:
            print(f"[WEBSOCKET] Sessão removida: {sessao['SESSION_ID']} ({sessao['nome_user']}) - socket {socket_id}")
            return True
        return False
        
    except Exception as e:
        print(f"Erro ao remover sessão: {e}")
        return False

def limpar_sessoes_expiradas_websocket():
    """
    Remove sessões que ultrapassaram o tempo de validade
    (Executado periodicamente pelo servidor)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()
        
        # Buscar sessões expiradas
        cursor.execute("""
            SELECT SESSION_ID, nome_user, socket_id, validade 
            FROM sessao 
            WHERE validade < ?
        """, (now_iso,))
        expiradas = cursor.fetchall()
        
        # Remover
        cursor.execute("DELETE FROM sessao WHERE validade < ?", (now_iso,))
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        if deleted > 0:
            print(f"[WEBSOCKET] Limpeza automática: {deleted} sessões expiradas")
            for s in expiradas:
                print(f"  - {s['SESSION_ID']} ({s['nome_user']}) - socket {s['socket_id']}")
        
        return [dict(s) for s in expiradas]  # Retorna lista para desconectar sockets
        
    except Exception as e:
        print(f"Erro ao limpar sessões: {e}")
        return []

def obter_sessoes_ativas_websocket():
    """Retorna lista de sessões ativas"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now()
        
        cursor.execute("""
            SELECT SESSION_ID, socket_id, nome_user, end_ip, data_hora, atualizado, validade
            FROM sessao 
            WHERE validade >= ?
            ORDER BY atualizado DESC
        """, (now.isoformat(),))
        sessoes = cursor.fetchall()
        conn.close()
        
        # Adicionar informações calculadas
        resultado = []
        for s in sessoes:
            sessao_dict = dict(s)
            
            ultima_atualizacao = datetime.fromisoformat(s['atualizado'])
            tempo_inativo = (now - ultima_atualizacao).total_seconds()
            sessao_dict['segundos_sem_heartbeat'] = round(tempo_inativo, 1)
            
            validade = datetime.fromisoformat(s['validade'])
            tempo_restante = (validade - now).total_seconds() / 60
            sessao_dict['minutos_ate_expirar'] = round(tempo_restante, 1)
            
            resultado.append(sessao_dict)
        
        return resultado
    except Exception as e:
        print(f"Erro ao obter sessões ativas: {e}")
        return []
