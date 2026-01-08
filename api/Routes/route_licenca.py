from flask import Blueprint, jsonify
from license_validator import validar_licenca, obter_serial_firebird

Route_licenca_bp = Blueprint('Route_licenca_bp', __name__)

@Route_licenca_bp.route('/info-licenca', methods=['GET'])
def info_licenca():
    """
    Retorna informações da licença para exibição (somente leitura)
    """
    try:
        # Obter serial
        serial = obter_serial_firebird()
        
        if not serial:
            return jsonify({
                "erro": "Não foi possível obter o serial do sistema",
                "serial": None,
                "status": "erro"
            }), 500
        
        # Validar licença
        validacao = validar_licenca()
        
        # Preparar resposta
        info = {
            "serial": serial,
            "status": "valida" if validacao.get('valido') else "invalida",
            "mensagem": validacao.get('mensagem', ''),
            "acesso": validacao.get('acesso', False),
            "validade": validacao.get('validade', None),
            "numero_acessos": validacao.get('numero_acessos', None)
        }
        
        return jsonify(info), 200
        
    except Exception as e:
        return jsonify({
            "erro": str(e),
            "status": "erro"
        }), 500
