from flask import Flask, request, jsonify, render_template, Blueprint
import fdb
import sqlite3
import os
import datetime
from databases import conectar_firebird
from databases import CAMINHO_DB_LOCAL
from Routes.route_buscar_produto import buscar_produto

Buscar_descricao_bp = Blueprint('Buscar_descricao_bp', __name__)


# Obter a descrição do produto a partir do Firebird
def buscar_descricao_firebird(ID_ESTOQUE):
    try:
        conn = conectar_firebird()
        cur = conn.cursor()
        query = """
            SELECT e.DESCRICAO , e.PRC_VENDA , p.QTD_ATUAL,e.ID_ESTOQUE
            FROM TB_EST_PRODUTO p
            JOIN TB_EST_IDENTIFICADOR i ON p.ID_IDENTIFICADOR = i.ID_IDENTIFICADOR
            JOIN TB_ESTOQUE e ON i.ID_ESTOQUE = e.ID_ESTOQUE
            WHERE e.ID_ESTOQUE = ?
        """
        cur.execute(query, (ID_ESTOQUE,))
        produto = cur.fetchone()
        conn.close()

        # Retornar um dicionário com descrição e quantidade
        if produto:
            return {"descricao": produto[0],
                    "preco": produto[1],
                    "quantidade_sist": produto[2],
                    "ID_ESTOQUE": produto[3]
                    }
        else:
            return None
    except Exception as e:
        print(f"Erro ao buscar descrição no Firebird: {e}")
        return None

# Buscar ID_ESTOQUE pelo código de barras
def buscar_id_estoque_por_codigo_barras(codigo_barras):
    try:
        conn = conectar_firebird()
        cur = conn.cursor()
        query = """
            SELECT e.ID_ESTOQUE
            FROM TB_EST_PRODUTO p
            JOIN TB_EST_IDENTIFICADOR i ON p.ID_IDENTIFICADOR = i.ID_IDENTIFICADOR
            JOIN TB_ESTOQUE e ON i.ID_ESTOQUE = e.ID_ESTOQUE
            WHERE p.COD_BARRA = ?
        """
        cur.execute(query, (codigo_barras,))
        resultado = cur.fetchone()
        conn.close()

        if resultado:
            return resultado[0]
        else:
            return None
    except Exception as e:
        print(f"Erro ao buscar ID_ESTOQUE no Firebird: {e}")
        return None
