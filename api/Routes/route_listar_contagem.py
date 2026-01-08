from flask import Flask, request, jsonify, render_template, Blueprint
import fdb
import sqlite3
import os
import datetime
from databases import CAMINHO_DB_LOCAL

Route_listar_contagem_bp = Blueprint('Route_listar_contagem_bp', __name__)


# Rota para listar os itens coletados com descrição
@Route_listar_contagem_bp.route("/listar-contagem", methods=["GET"])
def listar_contagem():
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cursor = conn.cursor()
    cursor.execute("SELECT id, descricao, codigo_barras, quantidade, qnt_sist, nome_user, data_hora FROM contagem_estoque ORDER BY data_hora DESC;")
    
    itens = [
        {"id": row[0], "descricao": row[1], "codigo_barras": row[2], "quantidade": row[3], "qnt_sist": row[4], "nome_user": row[5], "data_hora": row[6]}
        for row in cursor.fetchall()
    ]

    conn.close()
    return jsonify(itens)



@Route_listar_contagem_bp.route("/listar-contagem/<string:item_descricao>", methods=["GET"])
def listar_item(item_descricao):
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cursor = conn.cursor()
    
    # Consulta com LIKE para busca parcial (case-insensitive)
    cursor.execute(
        "SELECT id, descricao, codigo_barras, quantidade, qnt_sist, nome_user, data_hora FROM contagem_estoque WHERE LOWER(descricao) LIKE LOWER(?)",
        (f"%{item_descricao}%",)
    )
    
    items = cursor.fetchall()  # Busca todos os itens correspondentes
    conn.close()
    
    if items:
        resultado = []
        for item in items:
            resultado.append({
                "id": item[0],
                "descricao": item[1],
                "codigo_barras": item[2],
                "quantidade": item[3],
                "qnt_sist": item[4],
                "nome_user": item[5],
                "data_hora": item[6]
            })
        return jsonify(resultado)
    else:
        return jsonify({"erro": "Item não encontrado"}), 404

