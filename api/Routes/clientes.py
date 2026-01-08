from flask import Flask, request, jsonify, render_template, Blueprint
import fdb
from databases import conectar_firebird
from databases import CAMINHO_DB_LOCAL

clientes_bp = Blueprint('clientes_bp', __name__)

@clientes_bp.route('/clientes', methods=['GET'])
def get_clientes():
    conn = None
    try:
        conn = conectar_firebird()
        cur = conn.cursor()
        query = """
            SELECT ID_CLIENTE, NOME, END_CEP, END_NUMERO, END_BAIRRO, CONTATO, DDD_CELUL, FONE_CELUL 
            FROM TB_CLIENTE
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        clientes_lista = []
        for row in rows:
            clientes_lista.append({
                "ID_CLIENTE": row[0],
                "NOME": row[1],
                "END_CEP": row[2],
                "END_NUMERO": row[3],
                "END_BAIRRO": row[4],
                "CONTATO": row[5],
                "DDD_CELUL": row[6],
                "FONE_CELUL": row[7]
            })
            
        return jsonify(clientes_lista), 200

    except Exception as e:
        print(f"Erro ao buscar clientes: {e}")
        return jsonify({"message": f"Erro interno: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()

@clientes_bp.route('/clientes', methods=['POST'])
def criar_cliente():
    conn = None
    try:
        data = request.json
        conn = conectar_firebird()
        cur = conn.cursor()
        
        # Gerar novo ID (exemplo simples, ideal usar generator)
        cur.execute("SELECT MAX(ID_CLIENTE) FROM TB_CLIENTE")
        row = cur.fetchone()
        max_id = row[0] if row and row[0] else 0
        novo_id = max_id + 1
        
        query = """
            INSERT INTO TB_CLIENTE (ID_CLIENTE, NOME, CONTATO, DDD_CELUL, FONE_CELUL, END_BAIRRO)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        cur.execute(query, (novo_id, data.get('NOME'), data.get('CONTATO'), data.get('DDD_CELUL'), data.get('FONE_CELUL'), data.get('END_BAIRRO')))
        conn.commit()
        
        return jsonify({"message": "Cliente criado com sucesso", "id": novo_id}), 201
    except Exception as e:
        return jsonify({"message": f"Erro ao criar: {str(e)}"}), 500
    finally:
        if conn: conn.close()

@clientes_bp.route('/clientes/<int:id_cliente>', methods=['PUT'])
def atualizar_cliente(id_cliente):
    conn = None
    try:
        data = request.json
        conn = conectar_firebird()
        cur = conn.cursor()
        
        query = """
            UPDATE TB_CLIENTE
            SET NOME = ?, CONTATO = ?, DDD_CELUL = ?, FONE_CELUL = ?, END_BAIRRO = ?
            WHERE ID_CLIENTE = ?
        """
        cur.execute(query, (data.get('NOME'), data.get('CONTATO'), data.get('DDD_CELUL'), data.get('FONE_CELUL'), data.get('END_BAIRRO'), id_cliente))
        conn.commit()
        
        return jsonify({"message": "Cliente atualizado"}), 200
    except Exception as e:
        return jsonify({"message": f"Erro ao atualizar: {str(e)}"}), 500
    finally:
        if conn: conn.close()

@clientes_bp.route('/clientes/<int:id_cliente>', methods=['DELETE'])
def excluir_cliente(id_cliente):
    conn = None
    try:
        conn = conectar_firebird()
        cur = conn.cursor()
        cur.execute("DELETE FROM TB_CLIENTE WHERE ID_CLIENTE = ?", (id_cliente,))
        conn.commit()
        return jsonify({"message": "Cliente excluído"}), 200
    except Exception as e:
        return jsonify({"message": f"Erro ao excluir: {str(e)}"}), 500
    finally:
        if conn: conn.close()
