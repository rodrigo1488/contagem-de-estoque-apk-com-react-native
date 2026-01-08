from flask import Blueprint, request, jsonify
import sqlite3
import datetime
import fdb
from Routes.buscar_descricao import buscar_descricao_firebird
from Routes.route_buscar_produto import buscar_produto
from databases import CAMINHO_DB_LOCAL
from databases import conectar_firebird
from license_validator import requer_licenca

Route_salvar_bp = Blueprint('Route_salvar_bp', __name__)

@Route_salvar_bp.route('/salvar', methods=['POST'])
@Route_salvar_bp.route('/salvar/<nome_usuario>', methods=['POST'])
@requer_licenca
def salvar_estoque(nome_usuario=None):
    try:
        data = request.get_json()
        if not data or "codigo_barras" not in data:
            return jsonify({"message": "Dados inválidos: código de barras obrigatório"}), 400

        codigo_barras = str(data["codigo_barras"]).strip()
        
        # Quantidade is optional now
        quantidade_val = data.get("quantidade")
        quantidade = float(quantidade_val) if quantidade_val and str(quantidade_val).strip() else None
        
        nome_usuario = nome_usuario.strip() if nome_usuario else "Desconhecido"
        
        ID_ESTOQUE = data.get("ID_ESTOQUE", None)
        
        # Se ID_ESTOQUE não vier no payload, tenta buscar pelo código de barras
        if not ID_ESTOQUE:
            from Routes.buscar_descricao import buscar_id_estoque_por_codigo_barras
            ID_ESTOQUE = buscar_id_estoque_por_codigo_barras(codigo_barras)
            
        print(f"ID_ESTOQUE: {ID_ESTOQUE}")

        # Buscar a descrição e quantidade no Firebird (para obter dados atuais)
        produto = buscar_descricao_firebird(ID_ESTOQUE)

        if not produto:
            return jsonify({"message": "Produto não encontrado no Firebird"}), 404
        
        descricao = produto["descricao"]
        quantidade_sist = float(produto["quantidade_sist"])
        
        # Lógica do Preço: Se não enviado ou vazio, mantém o atual do banco
        preco_input = data.get("preco", "")
        if preco_input and str(preco_input).strip():
             preco = float(preco_input)
        else:
             preco = produto["preco"]
        
        # 1. Atualizar Preço no Firebird (Sempre, ou se mudou)
        try:
             conn_fb = conectar_firebird()
             if conn_fb:
                 cur_fb = conn_fb.cursor()
                 # Nota: Atualizando TB_ESTOQUE (onde fica o preço)
                 query_update_price = "UPDATE TB_ESTOQUE SET PRC_VENDA = ? WHERE ID_ESTOQUE = ?"
                 cur_fb.execute(query_update_price, (preco, ID_ESTOQUE))
                 conn_fb.commit()
                 conn_fb.close()
        except Exception as e_fb:
             print(f"Erro ao atualizar preço no Firebird: {e_fb}")
             # Não retornamos erro 500 aqui para não impedir o salvamento local da contagem, mas idealmente deveria ser atômico regarding business logic.
             # Mas assumindo que a contagem é prioridade.
        
        # 2. Salvar no banco SQLite (Apenas se quantidade foi informada)
        if quantidade is not None:
            conn = sqlite3.connect(CAMINHO_DB_LOCAL)
            cur = conn.cursor()
            try:
                cur.execute("""
                    INSERT INTO contagem_estoque (descricao, codigo_barras, quantidade, qnt_sist, nome_user,preco, data_hora)
                    VALUES (?, ?, ?, ?, ?, ?,?)
                    ON CONFLICT(codigo_barras) DO UPDATE
                    SET quantidade = quantidade + excluded.quantidade,
                        qnt_sist = excluded.qnt_sist,
                        nome_user = excluded.nome_user,
                        preco = excluded.preco,
                        data_hora = excluded.data_hora
                """, (descricao, codigo_barras, quantidade, quantidade_sist, nome_usuario, preco, datetime.datetime.now().strftime("%d-%m-%Y %H:%M")))
                conn.commit()
                message = "Salvo com sucesso"
            except sqlite3.Error as e:
                return jsonify({"message": "Erro ao salvar no banco", "error": str(e)}), 500
            finally:
                conn.close()
        else:
            message = "Preço atualizado (Contagem não salva pois quantidade vazia)"

        return jsonify({"message": message}), 200

    except Exception as e:
        print(f"Erro no servidor: {e}")
        return jsonify({"message": "Erro no servidor", "error": str(e)}), 500
