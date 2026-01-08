from flask import Blueprint, request, jsonify
from databases import conectar_firebird  # Importando do databases.py
from databases import CAMINHO_DB_LOCAL
import datetime
import os
from license_validator import requer_licenca

Route_buscar_produto_bp = Blueprint('Route_buscar_produto_bp', __name__)

# Rota para buscar produto no Firebird
@Route_buscar_produto_bp.route("/produto/<codigo_barras>", methods=["GET"])
@requer_licenca
def buscar_produto(codigo_barras):
    try:
        codigo_barras = codigo_barras.strip()
        conn = conectar_firebird()  # Chama a função do databases.py
        if conn is None:
            return jsonify({"erro": "Falha na conexão com o banco de dados Firebird. Verifique o console do servidor."}), 500
        cur = conn.cursor()
        
        query = """
            SELECT e.DESCRICAO , e.PRC_VENDA , p.QTD_ATUAL,e.ID_ESTOQUE
            FROM TB_EST_PRODUTO p
            JOIN TB_EST_IDENTIFICADOR i ON p.ID_IDENTIFICADOR = i.ID_IDENTIFICADOR
            JOIN TB_ESTOQUE e ON i.ID_ESTOQUE = e.ID_ESTOQUE
            WHERE p.COD_BARRA = ? 
        """
        
        cur.execute(query, (codigo_barras,))
        produto = cur.fetchone()
        
        conn.close()
        
        if produto:
            return jsonify({
                "Descricao": produto[0],
                 "Preco": produto[1],
                "Quantidade": produto[2],
                "ID_ESTOQUE": produto[3]
            })
        else:
            return jsonify({"erro": "Produto não encontrado"}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    

@Route_buscar_produto_bp.route("/estoque/<descricao>", methods=["GET"])
@requer_licenca
def buscar_estoque(descricao):
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)
        offset = (page - 1) * per_page

        descricao = descricao.strip()
        conn = conectar_firebird()
        if conn is None:
            return jsonify({"erro": "Falha na conexão com o Firebird"}), 500
        
        cursor = conn.cursor()

        # 1. Count query
        count_query = """
            SELECT COUNT(*)
            FROM TB_EST_PRODUTO p
            JOIN TB_EST_IDENTIFICADOR i ON p.ID_IDENTIFICADOR = i.ID_IDENTIFICADOR
            JOIN TB_ESTOQUE e ON i.ID_ESTOQUE = e.ID_ESTOQUE
            WHERE LOWER(e.DESCRICAO) LIKE LOWER(?) AND e.STATUS = 'A'
        """
        cursor.execute(count_query, (f"%{descricao}%",))
        total = cursor.fetchone()[0]

        # 2. Paginated query
        query = f"""
            SELECT FIRST {per_page} SKIP {offset} e.DESCRICAO , e.PRC_VENDA , p.QTD_ATUAL, e.ID_ESTOQUE, p.COD_BARRA
            FROM TB_EST_PRODUTO p
            JOIN TB_EST_IDENTIFICADOR i ON p.ID_IDENTIFICADOR = i.ID_IDENTIFICADOR
            JOIN TB_ESTOQUE e ON i.ID_ESTOQUE = e.ID_ESTOQUE
            WHERE LOWER(e.DESCRICAO) LIKE LOWER(?) AND e.STATUS = 'A'
            ORDER BY e.DESCRICAO ASC
        """
        cursor.execute(query, (f"%{descricao}%",))

        produtos = cursor.fetchall()
        conn.close()

        resultado = []
        for item in produtos:
            # item: 0=Desc, 1=Preco, 2=Qtd, 3=IdEstoque, 4=CodBarra
            resultado.append({
                "Descricao": item[0],
                "Preco": item[1],
                "Quantidade": item[2],
                "ID_ESTOQUE": item[3],
                "codigo_barras": item[4]
            })

        return jsonify({
            "page": page,
            "per_page": per_page,
            "total": total,
            "produtos": resultado
        })

    except Exception as e:
        return jsonify({"erro": str(e)}), 500



