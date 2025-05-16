
import serial
import serial.tools.list_ports
import time
import sys
import re
import json

# Configuración global
BAUD_RATE = 9600
TIMEOUT = 5  # Segundos para timeout de lectura
arduino_port = None
serial_connection = None

def find_arduino():
   
    print("Buscando dispositivos Arduino...")
    ports = list(serial.tools.list_ports.comports())
    for port in ports:
        print(port.description)
    
    if not ports:
        print("No se encontraron puertos seriales disponibles.")
        return None
    
    # Primero intentamos encontrar un puerto que se identifique como Arduino
    for port in ports:
        if 'arduino' in port.description.lower() or 'ch340' in port.description.lower()  or 'usb' in port.description.lower() :
            print(f"Arduino encontrado en {port.device}")
            return port.device
    
    # Si no encontramos un Arduino específico, usamos el primer puerto disponible
    return None

def connect_to_gps():

    global arduino_port, serial_connection
    
    # Buscar puerto Arduino
    arduino_port = find_arduino()
    if not arduino_port:
        print("No se pudo encontrar un puerto para Arduino.")
        return False
    
    try:
        # Intentar conexión serial
        serial_connection = serial.Serial(arduino_port, BAUD_RATE, timeout=TIMEOUT)
        print(f"Conectado a {arduino_port} a {BAUD_RATE} baudios")
        # Esperar a que se inicialice la conexión
        time.sleep(2)
        return True
    except serial.SerialException as e:
        print(f"Error al conectar con Arduino: {e}")
        return False

def parse_gps_data(line):
    """
    Parsea una línea de datos GPS recibida del Arduino
    Formato esperado: "GPS_DATA: lat,lon,humidity,temp"
    """
    try:
        # Buscar el patrón de datos GPS
        if "GPS_DATA" in line:
            # Extraer solo la parte de datos
            data_part = line.split("GPS_DATA:")[1].strip()
            parts = data_part.split(',')
            
            # Mínimo necesitamos latitud y longitud
            if len(parts) >= 2:
                lat = float(parts[0])
                lon = float(parts[1])
                
                # Datos opcionales
                humidity = float(parts[2]) if len(parts) > 2 else None
                temp = float(parts[3]) if len(parts) > 3 else None
                
                return {
                    "lat": lat,
                    "lng": lon,
                    "humidity": humidity,
                    "temperature": temp
                }
    except Exception as e:
        print(f"Error al parsear datos GPS: {e}")
    
    return None

def read_gps():
    """
    Lee datos del GPS continuamente y los imprime en formato compatible con el backend
    """
    global serial_connection
    
    if not serial_connection:
        if not connect_to_gps():
            print("No se pudo establecer conexión con el GPS.")
            return
    
    print("Comenzando a leer datos GPS...")
    
    try:
        while True:
            try:
                # Leer una línea del puerto serial
                if serial_connection.in_waiting > 0:
                    line = serial_connection.readline().decode('utf-8', errors='replace').strip()
                    
                    # Si la línea contiene datos GPS del formato esperado
                    if "GPS_DATA" in line:
                        print(line)  # Pasar directamente al stdout que lee Node.js
                        sys.stdout.flush()  # Forzar la salida inmediata
                    else:
                        # Mensajes de depuración u otros datos del Arduino
                        print(f"Arduino: {line}")
                        sys.stdout.flush()
            except UnicodeDecodeError:
                # Ignorar errores de decodificación
                pass
            
            # Pequeña pausa para no saturar la CPU
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        print("Lectura GPS interrumpida por el usuario.")
    except Exception as e:
        print(f"Error en la lectura del GPS: {e}")
    finally:
        if serial_connection and serial_connection.is_open:
            serial_connection.close()
            print("Puerto serial cerrado.")

if __name__ == "__main__":
    read_gps()