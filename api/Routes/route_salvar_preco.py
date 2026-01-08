from flask import Blueprint, request, jsonify
from databases import conectar_firebird  # Importando do databases.py
from databases import CAMINHO_DB_LOCAL


Route_salvar_preco_bp = Blueprint('Route_salvar_preco_bp', __name__)

# Rota para buscar produto no Firebird
@Route_salvar_preco_bp.route("/salvar_preco", methods=["POST"])
def salvar_preco():
    try:
        data = request.get_json()
        if not data or "codigo_barras" not in data or "preco" not in data:
            return jsonify({"message": "Dados inválidos"}), 400

        codigo_barras = data["codigo_barras"].strip()
        preco = float(data["preco"])

        conn = conectar_firebird()  # Chama a função do databases.py
        cur = conn.cursor()

        query = "UPDATE TB_EST_PRODUTO SET PRC_VENDA = ? WHERE COD_BARRA = ?"
        cur.execute(query, (preco, codigo_barras))

        conn.commit()
        conn.close()

        return jsonify({"message": "Preço salvo com sucesso"}), 200

    except Exception as e:
        return jsonify({"message": str(e)}), 500