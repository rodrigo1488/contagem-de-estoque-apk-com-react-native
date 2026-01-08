from databases import conectar_firebird
import sys

# Attempt connection
print("Attempting to connect to Firebird...")
try:
    conn = conectar_firebird()
    if conn:
        print("Success: Connected to Firebird!")
        conn.close()
    else:
        print("Failure: conectar_firebird() returned None (likely swallowed an exception)")
except Exception as e:
    print(f"Unexpected exception calling function: {e}")
