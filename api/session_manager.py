from datetime import datetime, timedelta
import sqlite3
from databases import CAMINHO_DB_LOCAL
from license_validator import validar_licenca

# Configurações de timeout
SESSION_UPDATE_TIMEOUT_MINUTES = 5   # Tempo máximo sem atualização (heartbeat)
SESSION_MAX_LIFETIME_MINUTES = 30    # Tempo máximo total de vida da sessão

def get_db_connection():
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    conn.row_factory = sqlite3.Row
    return conn

def limpar_sessoes_expiradas():
    """
    Remove sessões que:
    1. Não foram atualizadas há mais de 5 minutos (sem heartbeat)
    2. Ou ultrapassaram o tempo máximo de vida (30 minutos)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        # Buscar sessões que serão removidas para log
        cursor.execute("""
            SELECT SESSION_ID, nome_user, atualizado, validade 
            FROM sessao 
            WHERE atualizado < ? OR validade < ?
        """, (
            (datetime.now() - timedelta(minutes=SESSION_UPDATE_TIMEOUT_MINUTES)).isoformat(),
            now
        ))
        sessoes_expiradas = cursor.fetchall()
        
        # Remover sessões expiradas
        cursor.execute("""
            DELETE FROM sessao 
            WHERE atualizado < ? OR validade < ?
        """, (
            (datetime.now() - timedelta(minutes=SESSION_UPDATE_TIMEOUT_MINUTES)).isoformat(),
            now
        ))
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        if deleted > 0:
            print(f"[SESSION] Limpou {deleted} sessões expiradas:")
            for s in sessoes_expiradas:
                print(f"  - {s['SESSION_ID']} ({s['nome_user']}) - Última atualização: {s['atualizado']}")
        
        return deleted
    except Exception as e:
        print(f"Erro ao limpar sessões: {e}")
        return 0

def validar_e_registrar_sessao(session_id, ip, user_agent, username=None):
    """
    Verifica se a sessão é válida ou se pode criar uma nova.
    
    Lógica:
    - Se sessão existe e foi atualizada há menos de 5 min: RENOVA (atualiza timestamp)
    - Se sessão existe mas não foi atualizada há mais de 5 min: REMOVE e tenta criar nova
    - Se não existe sessão: CRIA (se houver vaga)
    
    Retorna (True, mensagem) se permitido, (False, mensagem) se bloqueado.
    """
    # 1. Validar licença primeiro
    licenca = validar_licenca()
    if not licenca.get('valido', False):
        return False, licenca.get('mensagem', 'Licença inválida')
    
    # 2. Obter limite de conexões do Supabase
    max_conexoes = licenca.get('numero_acessos', 1)
    
    # Validar que max_conexoes é um número válido
    try:
        max_conexoes = int(max_conexoes)
        if max_conexoes < 1:
            max_conexoes = 1
    except (ValueError, TypeError):
        print(f"[SESSION] Valor inválido de numero_acessos: {max_conexoes}, usando 1")
        max_conexoes = 1
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now()
        now_iso = now.isoformat()

        # 3. Limpar sessões expiradas primeiro
        update_limit = (now - timedelta(minutes=SESSION_UPDATE_TIMEOUT_MINUTES)).isoformat()
        cursor.execute("""
            DELETE FROM sessao 
            WHERE atualizado < ? OR validade < ?
        """, (update_limit, now_iso))
        deleted = cursor.rowcount
        if deleted > 0:
            print(f"[SESSION] Auto-limpeza: removeu {deleted} sessões expiradas")
        conn.commit()

        # 4. Verificar se a sessão já existe e está ativa
        cursor.execute("""
            SELECT id, nome_user, data_hora, atualizado, validade 
            FROM sessao 
            WHERE SESSION_ID = ?
        """, (session_id,))
        existing_session = cursor.fetchone()

        if existing_session:
            # Sessão existe -> Verificar se ainda está dentro do prazo de atualização
            ultima_atualizacao = datetime.fromisoformat(existing_session['atualizado'])
            tempo_sem_atualizacao = (now - ultima_atualizacao).total_seconds() / 60
            
            if tempo_sem_atualizacao < SESSION_UPDATE_TIMEOUT_MINUTES:
                # Sessão ativa -> Atualizar timestamp de atualização
                cursor.execute("""
                    UPDATE sessao 
                    SET atualizado = ?, end_ip = ?, user_agent = ?, nome_user = COALESCE(?, nome_user)
                    WHERE SESSION_ID = ?
                """, (now_iso, ip, user_agent, username, session_id))
                conn.commit()
                conn.close()
                print(f"[SESSION] Sessão renovada: {session_id} (última atualização há {tempo_sem_atualizacao:.1f} min)")
                return True, f"Sessão ativa (atualizada há {tempo_sem_atualizacao:.1f} min)"
            else:
                # Sessão expirada por falta de atualização -> Remover
                cursor.execute("DELETE FROM sessao WHERE SESSION_ID = ?", (session_id,))
                conn.commit()
                print(f"[SESSION] Sessão expirada removida: {session_id} (sem atualização há {tempo_sem_atualizacao:.1f} min)")
                # Continua para tentar criar nova sessão

        # 5. Sessão nova ou foi removida -> Verificar limite de conexões ativas
        cursor.execute("SELECT COUNT(*) FROM sessao")
        active_count = cursor.fetchone()[0]

        if active_count >= max_conexoes:
            conn.close()
            print(f"[SESSION] Limite excedido: {active_count}/{max_conexoes} para session_id={session_id}")
            return False, f"Limite de conexões simultâneas atingido ({active_count}/{max_conexoes}). Aguarde ou encerre outra sessão."
        
        # 6. Criar nova sessão
        validade = (now + timedelta(minutes=SESSION_MAX_LIFETIME_MINUTES)).isoformat()
        try:
            cursor.execute("""
                INSERT INTO sessao (SESSION_ID, end_ip, user_agent, nome_user, data_hora, atualizado, validade)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (session_id, ip, user_agent, username or 'Desconhecido', now_iso, now_iso, validade))
            conn.commit()
            conn.close()
            print(f"[SESSION] Nova sessão criada: {session_id} ({active_count + 1}/{max_conexoes}) - Validade: {SESSION_MAX_LIFETIME_MINUTES}min")
            return True, f"Sessão criada ({active_count + 1}/{max_conexoes})"
        except sqlite3.IntegrityError as e:
            # Sessão duplicada (race condition)
            conn.close()
            print(f"[SESSION] Sessão duplicada detectada: {session_id}")
            return True, "Sessão já existe"

    except Exception as e:
        print(f"Erro no gerenciador de sessões: {e}")
        import traceback
        traceback.print_exc()
        return False, f"Erro interno de sessão: {str(e)}"

def obter_sessoes_ativas():
    """Retorna lista de sessões ativas para debug/admin"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now()
        update_limit = (now - timedelta(minutes=SESSION_UPDATE_TIMEOUT_MINUTES)).isoformat()
        
        cursor.execute("""
            SELECT SESSION_ID, nome_user, end_ip, data_hora, atualizado, validade
            FROM sessao 
            WHERE atualizado >= ? AND validade >= ?
            ORDER BY atualizado DESC
        """, (update_limit, now.isoformat()))
        sessoes = cursor.fetchall()
        conn.close()
        
        # Adicionar informações calculadas
        resultado = []
        for s in sessoes:
            sessao_dict = dict(s)
            ultima_atualizacao = datetime.fromisoformat(s['atualizado'])
            tempo_inativo = (now - ultima_atualizacao).total_seconds() / 60
            sessao_dict['minutos_sem_atualizacao'] = round(tempo_inativo, 1)
            
            validade = datetime.fromisoformat(s['validade'])
            tempo_restante = (validade - now).total_seconds() / 60
            sessao_dict['minutos_ate_expirar'] = round(tempo_restante, 1)
            
            resultado.append(sessao_dict)
        
        return resultado
    except Exception as e:
        print(f"Erro ao obter sessões ativas: {e}")
        return []
