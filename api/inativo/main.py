from flask import Flask, request, jsonify, render_template
import fdb
import sqlite3
import os
import datetime

app = Flask(__name__)

# Configuração do Firebird
DATABASE_CONFIG = {
    "host": "localhost",  # Ou IP do servidor Firebird
    "database": "C:\Program Files (x86)\CompuFour\Clipp\Base\CLIPP.FDB",
    "user": "SYSDBA",
    "password": "masterkey",
    "charset": "UTF8"
}

# Caminho do arquivo de contagem
CAMINHO_ARQUIVO = "c: contagem_estoque.txt"
CAMINHO_DB_LOCAL = "contagem_estoque.db"


# Criar banco e tabela, se não existirem
def inicializar_banco():
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cur = conn.cursor()
    cur.execute("""
            CREATE TABLE IF NOT EXISTS contagem_estoque (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT,
            codigo_barras TEXT UNIQUE,
            quantidade INTEGER,
            qnt_sist INTERGER,
            nome_user TEXT,
            data_hora timestamp
                
        
        )
    """)
    conn.commit()
    conn.close()

# Conectar ao banco Firebird
def conectar_firebird():
    try:
        conn = fdb.connect(
            host=DATABASE_CONFIG["host"],
            database=DATABASE_CONFIG["database"],
            user=DATABASE_CONFIG["user"],
            password=DATABASE_CONFIG["password"],
            charset=DATABASE_CONFIG["charset"]
        )
        
        return conn
    except Exception as e:
        
        return None

# Página HTML para o scanner
@app.route("/")
def index():
    return render_template("index.html")
    
app.route("/check-healt")
def check_healt():
    return jsonify({"status": "OK"})

# Obter a descrição do produto a partir do Firebird
def buscar_descricao_firebird(codigo_barras):
    try:
        conn = conectar_firebird()
        cur = conn.cursor()
        query = """
            SELECT e.DESCRICAO, p.QTD_ATUAL 
            FROM TB_EST_PRODUTO p
            JOIN TB_EST_IDENTIFICADOR i ON p.ID_IDENTIFICADOR = i.ID_IDENTIFICADOR
            JOIN TB_ESTOQUE e ON i.ID_ESTOQUE = e.ID_ESTOQUE
            WHERE p.COD_BARRA = ?
        """
        cur.execute(query, (codigo_barras,))
        produto = cur.fetchone()
        conn.close()

        # Retornar um dicionário com descrição e quantidade
        if produto:
            return {"descricao": produto[0], "quantidade_sist": produto[1]}
        else:
            return None
    except Exception as e:
        print(f"Erro ao buscar descrição no Firebird: {e}")
        return None


# Rota para buscar produto no Firebird
@app.route("/produto/<codigo_barras>", methods=["GET"])
def buscar_produto(codigo_barras):
    try:
        codigo_barras = codigo_barras.strip()
        conn = conectar_firebird()
        cur = conn.cursor()
        
        query = """
            SELECT e.DESCRICAO, p.QTD_ATUAL
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
                "Quantidade": produto[1]
            })
        else:
            return jsonify({"erro": "Produto não encontrado"}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


agora = datetime.datetime.now()
# Rota para salvar a contagem de estoque no SQLite@app.route('/salvar', methods=['POST'])
@app.route('/salvar', methods=['POST'])
@app.route('/salvar/<nome_usuario>', methods=['POST'])
def salvar_estoque(nome_usuario=None):
    try:
        data = request.get_json()
        if not data or "codigo_barras" not in data or "quantidade" not in data:
            return jsonify({"message": "Dados inválidos"}), 400

        codigo_barras = data["codigo_barras"].strip()
        quantidade = float(data["quantidade"])
        nome_usuario = nome_usuario.strip() if nome_usuario else "Desconhecido"

        # Buscar a descrição e quantidade no Firebird
        produto = buscar_descricao_firebird(codigo_barras)
        
        if not produto:
            return jsonify({"message": "Produto não encontrado no Firebird"}), 404

        descricao = produto["descricao"]
        quantidade_sist = float(produto["quantidade_sist"])

        # Salvar no banco SQLite
        conn = sqlite3.connect(CAMINHO_DB_LOCAL)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO contagem_estoque (descricao, codigo_barras, quantidade, qnt_sist, nome_user, data_hora)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(codigo_barras) DO UPDATE 
            SET quantidade = quantidade + excluded.quantidade,
                qnt_sist = excluded.qnt_sist,
                nome_user = excluded.nome_user
        """, (descricao, codigo_barras, quantidade, quantidade_sist, nome_usuario, agora.strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
        conn.close()

        return jsonify({
            "message": "Estoque salvo",
            "codigo_barras": codigo_barras,
            "descricao": descricao,
            "quantidade": quantidade,
            "quantidade_sist": quantidade_sist,
            "usuario": nome_usuario
        })
    except Exception as e:
        print(f"Erro no servidor: {e}")
        return jsonify({"message": "Erro no servidor", "error": str(e)}), 500

# Inicializar banco ao iniciar o app
inicializar_banco()




# Rota para listar os itens coletados com descrição
@app.route("/listar-contagem", methods=["GET"])
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

@app.route("/listar-contagem/<string:item_descricao>", methods=["GET"])
def listar_item(item_descricao):
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cursor = conn.cursor()
    
    # Consulta com LIKE e conversão para minúsculas
    cursor.execute(
        "SELECT id, descricao, codigo_barras, quantidade, qnt_sist, nome_user, data_hora FROM contagem_estoque WHERE LOWER(descricao) LIKE LOWER(?)",
        (f"%{item_descricao}%",)  # Adiciona % para busca parcial
    )
    
    item = cursor.fetchone()
    conn.close()
    
    if item:
        return jsonify({
            "id": item[0],
            "descricao": item[1],
            "codigo_barras": item[2],
            "quantidade": item[3],
            "qnt_sist": item[4],
            "nome_user": item[5],
            "data_hora": item[6]
        })
    else:
        return jsonify({"erro": "Item não encontrado"}), 404





# Rota para editar um item coletado
@app.route("/editar/<int:item_id>", methods=["PUT"])
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

# Rota para excluir um item coletado
@app.route("/excluir/<int:item_id>", methods=["DELETE"])
def excluir_item(item_id):
    conn = sqlite3.connect(CAMINHO_DB_LOCAL)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM contagem_estoque WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

    return jsonify({"mensagem": "Item excluído com sucesso!"})


# Rota para gerar o arquivo TXT a partir do SQLite
@app.route("/gerar-txt", methods=["GET"])
def gerar_txt():
    try:
        conn = sqlite3.connect(CAMINHO_DB_LOCAL)
        cur = conn.cursor()
        cur.execute("SELECT codigo_barras, quantidade FROM contagem_estoque")
        produtos = cur.fetchall()
        conn.close()

        if not produtos:
            return jsonify({"message": "Nenhum produto encontrado para exportação"}), 404

        with open(CAMINHO_ARQUIVO, "w", encoding="utf-8") as file:
            for codigo_barras, quantidade in produtos:
                file.write(f"{codigo_barras}|{quantidade}\n")

        return jsonify({"message": "Arquivo TXT gerado com sucesso", "arquivo": CAMINHO_ARQUIVO})
    except Exception as e:
        return jsonify({"message": "Erro ao gerar o arquivo TXT", "error": str(e)}), 500

if __name__ == "__main__":
    # Para que o app seja acessível por outros dispositivos na rede
    app.run(debug=True, host='0.0.0.0', port=5000)