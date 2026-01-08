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
from databases import Database_bp
from databases import inicializar_banco
from databases import conectar_firebird
from databases import DATABASE_CONFIG
from license_validator import validar_licenca

app = Flask(__name__)

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

app.register_blueprint(CheckHealth_bp)
app.register_blueprint(Route_buscar_produto_bp)
app.register_blueprint(Route_excluir_bp)
app.register_blueprint(Route_listar_contagem_bp)
app.register_blueprint(Buscar_descricao_bp)
app.register_blueprint(Route_editar_bp)
app.register_blueprint(Route_salvar_bp)
app.register_blueprint(Database_bp)

from Routes.route_dashboard import Route_dashboard_bp
app.register_blueprint(Route_dashboard_bp)

from Routes.route_contagem import Route_contagem_bp
app.register_blueprint(Route_contagem_bp)

inicializar_banco()

def run_flask():
    app.run(debug=True, host='0.0.0.0', port=5000)

##def run_flask():
    ##serve(app,debug=False, host='0.0.0.0', port=5000, use_reloader=False)

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