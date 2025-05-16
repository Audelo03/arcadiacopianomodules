# Backend/gps_reader.py
import serial
import time
import requests
import os
import ctypes # Importar ctypes
from dotenv import load_dotenv

load_dotenv()

# --- Carga de la biblioteca C para tokenizar ---
lib_gps_tokenizer = None
MAX_TOKEN_LEN_PY = 32 # Debe coincidir con MAX_TOKEN_LEN en C

try:
    lib_name_tokenizer = None
    if os.name == 'nt': # Windows
        lib_name_tokenizer = './gps_tokenizer.dll'
    elif os.name == 'posix':
        if os.uname().sysname == 'Darwin': # macOS
            lib_name_tokenizer = './libgps_tokenizer.dylib'
        else: # Linux
            lib_name_tokenizer = './libgps_tokenizer.so'
    
    if lib_name_tokenizer:
        lib_gps_tokenizer = ctypes.CDLL(lib_name_tokenizer)

        # Prototipo de:
        # int tokenize_and_extract_gps_fields_asm(
        #     const char *input_str, char delim,
        #     char *out_lat, char *out_lon, char *out_hum, char *out_temp,
        #     int max_len
        # );
        lib_gps_tokenizer.tokenize_and_extract_gps_fields_asm.argtypes = [
            ctypes.c_char_p, ctypes.c_char,
            ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,
            ctypes.c_int
        ]
        lib_gps_tokenizer.tokenize_and_extract_gps_fields_asm.restype = ctypes.c_int
        print(f"Biblioteca C para tokenizar GPS '{lib_name_tokenizer}' cargada exitosamente.")
    else:
        print("Sistema operativo no soportado para la carga automática de la biblioteca C de tokenización.")

except OSError as e:
    print(f"Error al cargar la biblioteca C 'gps_tokenizer': {e}")
    print("Se utilizará la implementación en Python puro para el parseo completo.")
    lib_gps_tokenizer = None
# --- Fin de la carga de la biblioteca C ---


DJANGO_API_URL = os.getenv('DJANGO_API_URL', "http://localhost:8000/api/gps_data/")
SERIAL_PORT = os.getenv('SERIAL_PORT', '/dev/ttyUSB0')
BAUD_RATE = int(os.getenv('BAUD_RATE', 9600))

def parse_gps_data_python_fallback(data_to_parse):
    """Implementación de parseo puramente en Python."""
    parts = data_to_parse.split(',')
    if len(parts) >= 2: # lat, lng son obligatorios
        lat = float(parts[0])
        lon = float(parts[1])
        # Asegurarse de que los campos opcionales no estén vacíos antes de convertir
        humidity_str = parts[2] if len(parts) > 2 else None
        temp_str = parts[3] if len(parts) > 3 else None

        humidity = float(humidity_str) if humidity_str and humidity_str.strip() else None
        temp = float(temp_str) if temp_str and temp_str.strip() else None
        
        data = {"lat": lat, "lng": lon}
        if humidity is not None:
            data["humidity"] = humidity
        if temp is not None:
            data["temperature"] = temp
        return data
    return None

def parse_gps_data(line):
    try:
        data_part_to_process = None
        if "GPS_DATA:" in line:
            data_part_to_process = line.split("GPS_DATA:", 1)[1].strip()
        else:
            # Si no tiene el prefijo, asumimos que toda la línea son datos,
            # o es un formato que no esperamos. Por simplicidad, intentamos procesarla.
            data_part_to_process = line.strip()

        if not data_part_to_process: # Si la cadena de datos está vacía
            return None

        if lib_gps_tokenizer:
            # Preparar buffers para la función C
            # Deben ser creados para cada llamada si la función C los modifica internamente y no los limpia completamente
            # o si hay riesgo de que datos previos permanezcan.
            out_lat_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            out_lon_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            out_hum_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            out_temp_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            
            input_bytes = data_part_to_process.encode('utf-8')
            delimiter_byte = b','[0] # ctypes.c_char espera un entero/byte

            num_fields = lib_gps_tokenizer.tokenize_and_extract_gps_fields_asm(
                input_bytes, ctypes.c_char(delimiter_byte),
                out_lat_b, out_lon_b, out_hum_b, out_temp_b,
                MAX_TOKEN_LEN_PY
            )

            if num_fields >= 2: # Necesitamos al menos latitud y longitud
                try:
                    lat = float(out_lat_b.value.decode('utf-8'))
                    lon = float(out_lon_b.value.decode('utf-8'))
                    
                    humidity = None
                    if num_fields > 2 and out_hum_b.value:
                        humidity = float(out_hum_b.value.decode('utf-8'))
                    
                    temp = None
                    if num_fields > 3 and out_temp_b.value:
                        temp = float(out_temp_b.value.decode('utf-8'))

                    data = {"lat": lat, "lng": lon}
                    if humidity is not None: data["humidity"] = humidity
                    if temp is not None: data["temperature"] = temp
                    return data
                except ValueError as ve:
                    print(f"Error al convertir tokens de C a float: {ve}. Tokens: lat='{out_lat_b.value.decode()}', lon='{out_lon_b.value.decode()}', hum='{out_hum_b.value.decode()}', temp='{out_temp_b.value.decode()}'")
                    return None # Falló la conversión, C pudo haber devuelto algo no numérico
                except Exception as e_conv:
                    print(f"Excepción inesperada durante conversión de tokens C: {e_conv}")
                    return None
            elif num_fields == -1:
                print("Error de puntero nulo en la función C de tokenización.")
                return parse_gps_data_python_fallback(data_part_to_process) # Fallback
            else:
                # No se encontraron suficientes campos con la función C, intentar con Python puro
                # print(f"Función C no encontró suficientes campos ({num_fields}), intentando fallback Python.")
                return parse_gps_data_python_fallback(data_part_to_process)
        else:
            # Fallback a la lógica original de Python si la biblioteca C no está cargada
            return parse_gps_data_python_fallback(data_part_to_process)
            
    except Exception as e:
        print(f"Error general en parse_gps_data ('{line}'): {e}")
    return None

def send_data_to_django(data):
    try:
        response = requests.post(DJANGO_API_URL, json=data)
        response.raise_for_status()
        print(f"Datos enviados a Django: {data}, Respuesta: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"Error al enviar datos a Django: {e}")

def read_gps(serial_port_config, baud_rate_config):
    print(f"Iniciando lectura del puerto serial {serial_port_config} a {baud_rate_config} baudios...")
    try:
        with serial.Serial(serial_port_config, baud_rate_config, timeout=1) as ser:
            print("Puerto serial abierto exitosamente.")
            while True:
                if ser.in_waiting > 0:
                    try:
                        line = ser.readline().decode('utf-8', errors='ignore').strip()
                        if line:
                            print(f"Línea recibida: '{line}'")
                            gps_data = parse_gps_data(line)
                            if gps_data:
                                print(f"Datos parseados: {gps_data}")
                                send_data_to_django(gps_data)
                            else:
                                print(f"No se pudieron parsear datos válidos de la línea: '{line}'")
                    # ... (resto del manejo de excepciones como estaba) ...
                    except serial.SerialException as se:
                        print(f"Error de comunicación serial: {se}")
                        break 
                    except UnicodeDecodeError as ude:
                        print(f"Error de decodificación Unicode: {ude}. Línea ignorada.")
                    except Exception as e:
                        print(f"Error inesperado durante la lectura/procesamiento: {e}")
                time.sleep(0.1)
    except serial.SerialException as e:
        print(f"No se pudo abrir el puerto serial {serial_port_config}: {e}")
    except Exception as e:
        print(f"Ocurrió un error general al configurar el lector GPS: {e}")

if __name__ == "__main__":
    print("Iniciando script gps_reader.py...")

    test_cases = [
        "GPS_DATA:19.043,-98.194,60.5,25.1",
        "GPS_DATA:19.043,-98.194,60.5",     # Sin temperatura
        "GPS_DATA:19.043,-98.194",          # Solo lat, lon
        "19.043,-98.194,60.5,25.1",         # Sin prefijo
        "GPS_DATA:",                        # Prefijo pero sin datos
        "GPS_DATA:invalido,datos",
        "GPS_DATA:1.2,3.4,,"                # Campo de humedad vacío
    ]

    for test_line in test_cases:
        print(f"\n--- Probando parse_gps_data con: '{test_line}' ---")
        parsed = parse_gps_data(test_line)
        if parsed:
            print(f"Resultado del parseo: {parsed}")
        else:
            print("Resultado del parseo: None")
    
    print("\nSi tienes un dispositivo GPS configurado y el puerto/API son correctos,")
    print("descomenta la línea 'read_gps(...)' abajo para iniciar la lectura en vivo.")
    print(f"Usando SERIAL_PORT: {SERIAL_PORT}, DJANGO_API_URL: {DJANGO_API_URL}")
    # Descomenta la siguiente línea para activar la lectura del GPS real
    # read_gps(SERIAL_PORT, BAUD_RATE) 
    print("\nScript gps_reader.py finalizado (o esperando datos del GPS si read_gps está activo).")