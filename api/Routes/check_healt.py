from flask import Blueprint, request, jsonify

CheckHealth_bp  = Blueprint('CheckHealth_bp', __name__)

@CheckHealth_bp.route('/check_health', methods=['GET'])
def check_health():
    return jsonify({'status': 'OK'}), 200