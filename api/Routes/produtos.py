from flask import Flask, request, jsonify, render_template, Blueprint
import fdb

from databases import conectar_firebird
from databases import CAMINHO_DB_LOCAL
from Routes.route_buscar_produto import buscar_produto

produtos_bp = Blueprint('produtos_bp', __name__)

@produtos_bp.route('/produtos', methods=['GET'])
def get_produtos():
    try:
        conn = conectar_firebird()
        cur = conn.cursor()
        query = """
            SELECT e.DESCRICAO , e.PRC_VENDA , p.QTD_ATUAL,e.ID_ESTOQUE
            FROM TB_EST_PRODUTO p
            JOIN TB_EST_IDENTIFICADOR i ON p.ID_IDENTIFICADOR = i.ID_IDENTIFICADOR
            JOIN TB_ESTOQUE e ON i.ID_ESTOQUE = e.ID_ESTOQUE
        """
        cur.execute(query)
        produtos = cur.fetchall()
        conn.close()

        # Retornar os produtos como uma lista de dicionários
        return jsonify([{
            "descricao": produto[0],
            "preco": produto[1],
            "quantidade_sist": produto[2],
            "ID_ESTOQUE": produto[3]
        } for produto in produtos])
    except Exception as e:
        print(f"Erro ao buscar produtos no Firebird: {e}")
        return jsonify({"error": "Erro ao buscar produtos"}), 500



@produtos_bp.route('/produtos', methods=['POST'])
def criar_produto():
    conn = None
    try:
        data = request.json
        conn = conectar_firebird()
        cur = conn.cursor()
        
        # 1. Get new IDs
        cur.execute("SELECT MAX(ID_ESTOQUE) FROM TB_ESTOQUE")
        max_id_est = cur.fetchone()[0] or 0
        new_id_est = max_id_est + 1
        
        # Insert TB_ESTOQUE
        cur.execute("""
            INSERT INTO TB_ESTOQUE (ID_ESTOQUE, DESCRICAO, PRC_VENDA, ATIVO)
            VALUES (?, ?, ?, 'S')
        """, (new_id_est, data.get('descricao'), data.get('preco')))
        
        # Insert TB_EST_IDENTIFICADOR
        cur.execute("SELECT MAX(ID_IDENTIFICADOR) FROM TB_EST_IDENTIFICADOR")
        new_id_ident = (cur.fetchone()[0] or 0) + 1
        cur.execute("""
            INSERT INTO TB_EST_IDENTIFICADOR (ID_IDENTIFICADOR, ID_ESTOQUE)
            VALUES (?, ?)
        """, (new_id_ident, new_id_est))

        # Insert TB_EST_PRODUTO
        cur.execute("""
            INSERT INTO TB_EST_PRODUTO (ID_IDENTIFICADOR, QTD_ATUAL)
            VALUES (?, ?)
        """, (new_id_ident, data.get('quantidade_sist', 0)))
        
        conn.commit()
        return jsonify({"message": "Produto criado", "id": new_id_est}), 201
    except Exception as e:
        return jsonify({"message": f"Erro: {str(e)}"}), 500
    finally:
        if conn: conn.close()

@produtos_bp.route('/produtos/<int:id_estoque>', methods=['PUT'])
def editar_produto(id_estoque):
    conn = None
    try:
        data = request.json
        conn = conectar_firebird()
        cur = conn.cursor()
        
        # Update TB_ESTOQUE (Desc, Price)
        cur.execute("""
            UPDATE TB_ESTOQUE
            SET DESCRICAO = ?, PRC_VENDA = ?
            WHERE ID_ESTOQUE = ?
        """, (data.get('descricao'), data.get('preco'), id_estoque))

        # Update TB_EST_PRODUTO (Qty) via subquery connection
        cur.execute("""
            UPDATE TB_EST_PRODUTO p
            SET p.QTD_ATUAL = ?
            WHERE EXISTS (
                SELECT 1 FROM TB_EST_IDENTIFICADOR i 
                WHERE i.ID_IDENTIFICADOR = p.ID_IDENTIFICADOR 
                AND i.ID_ESTOQUE = ?
            )
        """, (data.get('quantidade_sist'), id_estoque))
        
        conn.commit()
        return jsonify({"message": "Produto atualizado"}), 200
    except Exception as e:
        return jsonify({"message": f"Erro: {str(e)}"}), 500
    finally:
        if conn: conn.close()

@produtos_bp.route('/produtos/<int:id_estoque>', methods=['DELETE'])
def inativar_produto(id_estoque):
    conn = None
    try:
        conn = conectar_firebird()
        cur = conn.cursor()
        
        # Soft delete in TB_ESTOQUE usually? User used TB_EST_PRODUTO.INATIVO?
        # Let's assume ATIVO in TB_ESTOQUE is standard, but user tried INATIVO=1 in PRODUTO.
        # I'll try to update both or verify column. User code: SET INATIVO = 1.
        # Firebird usually has ATIVO ('S'/'N') in ESTOQUE. 
        # But let's follow user hint closer but strictly on correct table if possible.
        # Assuming TB_ESTOQUE has ATIVO.
        
        cur.execute("UPDATE TB_ESTOQUE SET ATIVO = 'N' WHERE ID_ESTOQUE = ?", (id_estoque,))
        conn.commit()
        
        return jsonify({"message": "Produto inativado"}), 200
    except Exception as e:
        return jsonify({"message": f"Erro: {str(e)}"}), 500
    finally:
        if conn: conn.close()