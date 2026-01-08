import sys
import threading
import requests
from flask import Flask, render_template, request, jsonify
import pystray
from pystray import MenuItem as item, Icon
from PIL import Image
from waitress import serve

from Routes.route_buscar_produto import Route_buscar_produto_bp
from Routes.route_salvar import Route_salvar_bp
from Routes.route_excluir import Route_excluir_bp
from Routes.route_editar import Route_editar_bp
from Routes.route_listar_contagem import Route_listar_contagem_bp
from Routes.buscar_descricao import Buscar_descricao_bp
from Routes.check_healt import CheckHealth_bp
from Routes.clientes import clientes_bp
from Routes.produtos import produtos_bp
from databases import Database_bp
from databases import inicializar_banco
from databases import conectar_firebird
from databases import DATABASE_CONFIG
from license_validator import validar_licenca

from session_manager import validar_e_registrar_sessao
import logging

app = Flask(__name__)

# Configurar logging para ver erros de sessão
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EXCLUDED_ROUTES = ['/static', '/check_health', '/licenca/status', '/licenca/validar', '/admin/revalidar-licenca', '/admin/sessoes-ativas']

@app.before_request
def verificar_sessao():
    # Pular verificações para rotas estáticas ou de saúde/licença
    if request.path.startswith('/static') or request.path in EXCLUDED_ROUTES:
        return

    # Tentar obter ID único da sessão (Header customizado ou IP)
    session_id = request.headers.get('X-Session-ID') or request.remote_addr
    user_agent = request.headers.get('User-Agent')
    
    # Tentar extrair nome de usuário se disponível (ex: de um token ou header, aqui simplificado)
    # Alguns endpoints já passam username na URL, mas aqui é global.
    username = request.headers.get('X-User-Name') 

    permitido, msg = validar_e_registrar_sessao(session_id, request.remote_addr, user_agent, username)

    if not permitido:
        logger.warning(f"Acesso bloqueado para {session_id}: {msg}")
        return jsonify({
            "erro": msg,
            "acesso_negado": True,
            "tipo": "limite_conexoes"
        }), 403

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/admin/revalidar-licenca", methods=["POST"])
def revalidar_licenca():
    """Endpoint administrativo para forçar revalidação da licença"""
    from license_validator import limpar_cache_licenca, validar_licenca
    limpar_cache_licenca()
    resultado = validar_licenca()
    return jsonify({
        "mensagem": "Cache limpo e licença revalidada",
        "status": resultado
    }), 200

@app.route("/admin/sessoes-ativas", methods=["GET"])
def listar_sessoes_ativas():
    """Endpoint administrativo para visualizar sessões ativas"""
    from session_manager import obter_sessoes_ativas
    from license_validator import validar_licenca
    
    licenca = validar_licenca()
    sessoes = obter_sessoes_ativas()
    
    return jsonify({
        "limite_licenca": licenca.get('numero_acessos', 1),
        "sessoes_ativas": len(sessoes),
        "sessoes": sessoes
    }), 200

app.register_blueprint(CheckHealth_bp)
app.register_blueprint(Route_buscar_produto_bp)
app.register_blueprint(Route_excluir_bp)
app.register_blueprint(Route_listar_contagem_bp)
app.register_blueprint(Buscar_descricao_bp)
app.register_blueprint(Route_editar_bp)
app.register_blueprint(Route_salvar_bp)
app.register_blueprint(Database_bp)
app.register_blueprint(clientes_bp)
app.register_blueprint(produtos_bp)

from Routes.route_dashboard import Route_dashboard_bp
app.register_blueprint(Route_dashboard_bp)

from Routes.route_contagem import Route_contagem_bp
app.register_blueprint(Route_contagem_bp)

from Routes.route_licenca import Route_licenca_bp
app.register_blueprint(Route_licenca_bp)

inicializar_banco()

def run_flask():
    # Desativar reloader para evitar duplicar threads de agendamento se houver
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)

def load_icon():
    return Image.open("icon.ico")  # Certifique-se de ter um arquivo 'icon.ico' no diretório

def on_exit(icon, item):
    icon.stop()
    sys.exit()

def run_tray():
    icon = Icon("ServidorFlask", load_icon(), title="Servidor Flask", menu=(
        item('Reiniciar', lambda _: run_flask()),
        item('Sair', on_exit)
    ))    
    icon.run()

# if __name__ == "__main__":
#     flask_thread = threading.Thread(target=run_flask, daemon=True)
#     flask_thread.start()
#     run_tray()

if __name__ == "__main__":
    run_flask()
