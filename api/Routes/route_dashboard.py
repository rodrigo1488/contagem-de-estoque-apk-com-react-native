from flask import Blueprint, jsonify
import sqlite3
from databases import CAMINHO_DB_LOCAL, conectar_firebird

Route_dashboard_bp = Blueprint('Route_dashboard_bp', __name__)

@Route_dashboard_bp.route('/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    stats = {
        "total_itens_coletados": 0,
        "valor_total_coletado": 0.0,
        "itens_recentes": []
    }
    
    try:
        # Coletar estatísticas do SQLite (Itens contados)
        conn_lite = sqlite3.connect(CAMINHO_DB_LOCAL)
        cur_lite = conn_lite.cursor()
        
        # Total de itens contados (Count distinct items / rows)
        cur_lite.execute("SELECT COUNT(*) FROM contagem_estoque")
        total_qtd = cur_lite.fetchone()[0]
        stats["total_itens_coletados"] = total_qtd if total_qtd else 0
        
        # Valor de Divergência (Sum of (Counted - System) * Price)
        # If result is positive: Surplus items (Gain)
        # If result is negative: Missing items (Loss)
        cur_lite.execute("SELECT SUM((quantidade - qnt_sist) * preco) FROM contagem_estoque")
        div_val = cur_lite.fetchone()[0]
        stats["valor_divergencia"] = div_val if div_val else 0.0

        # Divergências (Itens onde quantidade != qnt_sist)
        cur_lite.execute("SELECT COUNT(*) FROM contagem_estoque WHERE quantidade != qnt_sist")
        div_count = cur_lite.fetchone()[0]
        stats["total_divergencias"] = div_count if div_count else 0
        
        # Histórico de Contagens Finalizadas (quantidade)
        cur_lite.execute("SELECT COUNT(*) FROM historico_contagens")
        hist_count = cur_lite.fetchone()[0]
        stats["contagens_finalizadas"] = hist_count if hist_count else 0
        
        # Últimos 5 itens coletados
        cur_lite.execute("SELECT descricao, quantidade, data_hora FROM contagem_estoque ORDER BY id DESC LIMIT 5")
        recentes = cur_lite.fetchall()
        for item in recentes:
            stats["itens_recentes"].append({
                "descricao": item[0],
                "quantidade": item[1],
                "data_hora": item[2]
            })
            
        conn_lite.close()
        
        return jsonify(stats)
        
    except Exception as e:
        print(f"Erro ao buscar stats do dashboard: {e}")
        return jsonify({"erro": str(e)}), 500
