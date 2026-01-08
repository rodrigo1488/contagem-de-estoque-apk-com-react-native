from flask import Flask, request, jsonify, render_template, Blueprint
import fdb
import sqlite3
import os
import datetime
from databases import CAMINHO_DB_LOCAL
from license_validator import requer_licenca


Route_excluir_bp = Blueprint('Route_excluir_bp', __name__)

# Rota para excluir um item coletado
@Route_excluir_bp.route("/excluir/<int:item_id>", methods=["DELETE"])
@requer_licenca
def excluir_item(item_id):
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM contagem_estoque WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

    return jsonify({"mensagem": "Item excluído com sucesso!"})