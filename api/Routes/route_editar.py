from flask import Blueprint, request, jsonify
import sqlite3
from databases import CAMINHO_DB_LOCAL
from license_validator import requer_licenca

# Criando o Blueprint
Route_editar_bp = Blueprint('Route_editar_bp', __name__)

# Rota para editar um item coletado
@Route_editar_bp.route("/editar/<int:item_id>", methods=["PUT"])
@requer_licenca
def editar_item(item_id):
    dados = request.json
    nova_quantidade = dados.get("quantidade")

    if nova_quantidade is None or int(nova_quantidade) < 0:
        return jsonify({"erro": "Quantidade inválida."}), 400

    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cursor = conn.cursor()
    cursor.execute("UPDATE contagem_estoque SET quantidade = ? WHERE id = ?", (nova_quantidade, item_id))
    conn.commit()
    conn.close()

    return jsonify({"mensagem": "Quantidade atualizada!"})
