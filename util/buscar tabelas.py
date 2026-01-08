import fdb

input_value = input("Digite a informação que deseja procurar: ")

# Função para conectar ao banco Firebird
def connect_to_database():
    try:
        conn = fdb.connect(
            dsn='localhost:C:/Program Files (x86)/CompuFour/Clipp/Base/CLIPP.FDB',  # Caminho correto
            user='SYSDBA',
            password='masterkey',
            charset='UTF8'
        )
        print("Conexão bem-sucedida!")
        return conn
    except fdb.DatabaseError as e:
        print(f"Erro de conexão: {e}")
        return None

# Função para verificar todas as tabelas do banco
def get_all_tables(cursor):
    try:
        cursor.execute("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0")
        return [row[0] for row in cursor.fetchall()]
    except Exception as e:
        print(f"Erro ao obter as tabelas: {e}")
        return []

# Função para verificar todas as colunas de uma tabela
def get_columns_for_table(cursor, table_name):
    try:
        cursor.execute(f"""
        SELECT RDB$FIELD_NAME
        FROM RDB$RELATION_FIELDS
        WHERE RDB$RELATION_NAME = '{table_name.upper()}'
        """)
        return [row[0] for row in cursor.fetchall()]
    except Exception as e:
        print(f"Erro ao obter as colunas para a tabela {table_name}: {e}")
        return []

# Função para verificar se a informação está presente em uma tabela e coluna específica
def search_in_table(cursor, table_name, column_name, search_value):
    try:
        cursor.execute(f"SELECT {column_name} FROM {table_name} WHERE {column_name} LIKE '%{search_value}%'")
        results = cursor.fetchall()
        return results
    except Exception as e:
        print(f"Erro ao procurar por '{search_value}' na coluna {column_name} da tabela {table_name}: {e}")
        return []

# Função para percorrer todas as tabelas e colunas em busca de uma informação
def search_in_all_tables(search_value):
    # Conectar ao banco de dados
    conn = fdb.connect(dsn='localhost:C:/Program Files (x86)/CompuFour/Clipp/Base/CLIPP.FDB', user='SYSDBA', password='masterkey', charset='UTF8')
    cursor = conn.cursor()

    # Obter todas as tabelas
    tables = get_all_tables(cursor)

    # Procurar pela informação em todas as tabelas e suas colunas
    for table in tables:
        columns = get_columns_for_table(cursor, table)
        for column in columns:
            results = search_in_table(cursor, table, column, search_value)
            if results:
                print(f"Encontrado '{search_value}' na tabela {table}, coluna {column}:")
                for row in results:
                    print(row)

    # Fechar a conexão
    cursor.close()
    conn.close()

# Chamar a função de busca
search_value = input_value  # Substitua pela informação que você está procurando
search_in_all_tables(search_value)
