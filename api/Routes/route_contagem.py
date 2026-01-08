from flask import Blueprint, jsonify, send_file, request
import sqlite3
import datetime
import os
from databases import CAMINHO_DB_LOCAL
from license_validator import requer_licenca

Route_contagem_bp = Blueprint('Route_contagem_bp', __name__)

@Route_contagem_bp.route('/finalizar-contagem', methods=['POST'])
@requer_licenca
def finalizar_contagem():
    try:
        conn = sqlite3.connect(CAMINHO_DB_LOCAL)
        cur = conn.cursor()

        # 1. Buscar todos os itens da contagem atual
        cur.execute("SELECT descricao, codigo_barras, quantidade, qnt_sist, preco FROM contagem_estoque")
        itens = cur.fetchall()

        if not itens:
            return jsonify({"message": "Não há itens para finalizar."}), 400

        # 1.5 Gerar Arquivo TXT (Backup e Download)
        backup_dir = os.path.join(os.getcwd(), "backups")
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
            
        timestamp_str = datetime.datetime.now().strftime("%d-%m-%Y_%H-%M")
        filename = f"contagem_estoque_{timestamp_str}.txt"
        filepath = os.path.join(backup_dir, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            for item in itens:
                # Format: codigo_barras|quantidade
                # item[1] is barcode, item[2] is qty
                f.write(f"{item[1]}|{item[2]}\n")

        # 2. Calcular Totais
        total_itens = 0
        valor_total = 0.0
        total_divergencias = 0
        
        for item in itens:
            # item: 0=desc, 1=cod, 2=qtd, 3=sist, 4=preco
            quantidade = item[2]
            qnt_sist = item[3]
            preco = item[4] if item[4] else 0.0
            
            total_itens += quantidade
            valor_total += quantidade * preco
            
            if quantidade != qnt_sist:
                total_divergencias += 1

        data_finalizacao = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 3. Inserir no Histórico de Contagens
        cur.execute("""
            INSERT INTO historico_contagens (data_finalizacao, total_itens, valor_total, total_divergencias)
            VALUES (?, ?, ?, ?)
        """, (data_finalizacao, total_itens, valor_total, total_divergencias))
        
        id_contagem = cur.lastrowid

        # 4. Inserir Itens no Histórico
        itens_para_inserir = []
        for item in itens:
            # (id_contagem, codigo, desc, qtd, sist, preco)
            itens_para_inserir.append((id_contagem, item[1], item[0], item[2], item[3], item[4]))

        cur.executemany("""
            INSERT INTO historico_itens (id_contagem, codigo_barras, descricao, quantidade, qnt_sist, preco)
            VALUES (?, ?, ?, ?, ?, ?)
        """, itens_para_inserir)

        # 5. Limpar Contagem Atual
        cur.execute("DELETE FROM contagem_estoque")
        
        conn.commit()
        conn.close()

        return jsonify({
            "message": "Contagem finalizada e arquivo gerado com sucesso!",
            "id_contagem": id_contagem,
            "divergencias": total_divergencias,
            "download_url": f"/download-historico/{filename}"
        }), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@Route_contagem_bp.route('/download-historico/<filename>', methods=['GET'])
@requer_licenca
def download_historico(filename):
    try:
        backup_dir = os.path.join(os.getcwd(), "backups")
        filepath = os.path.join(backup_dir, filename)
        if os.path.exists(filepath):
            return send_file(filepath, as_attachment=True)
        else:
            return jsonify({"erro": "Arquivo não encontrado"}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
@Route_contagem_bp.route('/listar-historico', methods=['GET'])
def listar_historico():
    try:
        conn = sqlite3.connect(CAMINHO_DB_LOCAL)
        cur = conn.cursor()
        cur.execute("SELECT id, data_finalizacao, total_itens, valor_total, total_divergencias FROM historico_contagens ORDER BY id DESC")
        rows = cur.fetchall()
        
        historico = []
        for row in rows:
            # Recreate filename logic to provide download link again if needed
            # Assuming format: "contagem_estoque_DD-MM-YYYY_HH-MM.txt"
            # We need to parse the data_finalizacao which is "YYYY-MM-DD HH:MM:SS" to "DD-MM-YYYY_HH-MM"
            # Or simplified: just return the data used to construct the logic if consistent.
            
            # Let's fix the timestamp format conversion:
            # Stored as: 2026-01-07 22:15:00
            # Needed for file: 07-01-2026_22-15
            
            try:
                dt_obj = datetime.datetime.strptime(row[1], "%Y-%m-%d %H:%M:%S")
                timestamp_str = dt_obj.strftime("%d-%m-%Y_%H-%M")
                filename = f"contagem_estoque_{timestamp_str}.txt"
                download_url = f"/download-historico/{filename}"
            except:
                download_url = None

            historico.append({
                "id": row[0],
                "data_finalizacao": row[1],
                "total_itens": row[2],
                "valor_total": row[3],
                "total_divergencias": row[4],
                "download_url": download_url
            })
            
        conn.close()
        return jsonify(historico), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
