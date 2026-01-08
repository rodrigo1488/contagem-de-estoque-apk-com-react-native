import requests
from datetime import datetime
from functools import wraps
from flask import jsonify
from databases import conectar_firebird

SUPABASE_URL = "https://sufuxjueqwzlxkuocvig.supabase.co"
SUPABASE_API_KEY = "sb_publishable_gsjUcPrOrO6aWA-WRPnJcA_mN8vinyH"

# Cache para evitar múltiplas requisições
_license_cache = {
    'data': None,
    'timestamp': None,
    'ttl': 60  # 1 minuto (reduzido de 5 para atualização mais rápida)
}

def obter_serial_firebird():
    """Obtém o serial do Firebird"""
    try:
        con = conectar_firebird()
        if con is None:
            return None
        cur = con.cursor()
        cur.execute("SELECT NSE_CLIPP FROM RDB$SUP")
        row = cur.fetchone()
        con.close()
        return row[0].strip() if row else None
    except Exception as e:
        print(f"Erro ao obter serial do Firebird: {e}")
        return None

def validar_licenca():
    """
    Valida a licença no Supabase
    Retorna: dict com status da validação
    {
        'valido': bool,
        'mensagem': str,
        'acesso': bool,
        'numero_acessos': int,
        'validade': str
    }
    """
    # Verificar cache
    now = datetime.now()
    if _license_cache['data'] and _license_cache['timestamp']:
        elapsed = (now - _license_cache['timestamp']).total_seconds()
        if elapsed < _license_cache['ttl']:
            return _license_cache['data']
    
    try:
        serial = obter_serial_firebird()
        if not serial:
            resultado = {
                'valido': False,
                'mensagem': 'Não foi possível obter o serial do sistema',
                'acesso': False
            }
            return resultado
        
        # Buscar empresa no Supabase
        url = f"{SUPABASE_URL}/rest/v1/companies?serial=eq.{serial}&select=*"
        headers = {
            "apikey": SUPABASE_API_KEY,
            "Authorization": f"Bearer {SUPABASE_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code != 200:
            resultado = {
                'valido': False,
                'mensagem': 'Erro ao validar licença',
                'acesso': False
            }
            return resultado
        
        data = response.json()
        
        if not data or len(data) == 0:
            resultado = {
                'valido': False,
                'mensagem': 'Serial não encontrado. Entre em contato com o suporte.',
                'acesso': False
            }
            return resultado
        
        empresa = data[0]
        
        # Validar campo acesso
        if not empresa.get('acesso', False):
            resultado = {
                'valido': False,
                'mensagem': 'Licença suspensa. Renove sua licença.',
                'acesso': False
            }
            _license_cache['data'] = resultado
            _license_cache['timestamp'] = now
            return resultado
        
        # Validar validade (data de vencimento)
        validade_str = empresa.get('validade')
        if validade_str:
            try:
                validade = datetime.strptime(validade_str, "%Y-%m-%d").date()
                hoje = datetime.now().date()
                
                if hoje > validade:
                    resultado = {
                        'valido': False,
                        'mensagem': f'Licença vencida em {validade.strftime("%d/%m/%Y")}. Renove sua licença.',
                        'acesso': False
                    }
                    _license_cache['data'] = resultado
                    _license_cache['timestamp'] = now
                    return resultado
            except ValueError:
                print(f"Erro ao parsear data de validade: {validade_str}")
        
        # Licença válida
        resultado = {
            'valido': True,
            'mensagem': 'Licença válida',
            'acesso': True,
            'numero_acessos': empresa.get('numero_acessos', 1),
            'validade': validade_str
        }
        
        _license_cache['data'] = resultado
        _license_cache['timestamp'] = now
        return resultado
        
    except requests.Timeout:
        return {
            'valido': False,
            'mensagem': 'Timeout ao validar licença',
            'acesso': False
        }
    except Exception as e:
        print(f"Erro ao validar licença: {e}")
        return {
            'valido': False,
            'mensagem': f'Erro interno: {str(e)}',
            'acesso': False
        }

def requer_licenca(f):
    """
    Decorator para proteger rotas que requerem licença válida
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        validacao = validar_licenca()
        
        if not validacao['valido']:
            return jsonify({
                "erro": validacao['mensagem'],
                "acesso_negado": True
            }), 403
        
        return f(*args, **kwargs)
    
    return decorated_function

def limpar_cache_licenca():
    """Limpa o cache de licença (útil para forçar revalidação)"""
    _license_cache['data'] = None
    _license_cache['timestamp'] = None
