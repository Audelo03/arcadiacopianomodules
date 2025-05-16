const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { spawn } = require('child_process'); // Para ejecutar Python
const WebSocket = require('ws');          // Para comunicación en tiempo real

dotenv.config();
const app = express();

// Configuración de CORS, Morgan, etc.
app.use(cors({ origin: "http://localhost:3000" }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Configuración WebSocket ---
const wss = new WebSocket.Server({ port: 8080 }); // Puerto para WebSocket
console.log('Servidor WebSocket escuchando en el puerto 8080');

wss.on('connection', ws => {
  console.log('Cliente conectado al WebSocket');
  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
  });
});

function broadcastGpsData(data) {
   wss.clients.forEach(client => {
     if (client.readyState === WebSocket.OPEN) {
       client.send(JSON.stringify({ type: 'gps_update', payload: data }));
     }
   });
}
// --- Fin Configuración WebSocket ---


// --- Lógica para iniciar y manejar el script de Python ---
let pythonProcess = null;

function startGpsReader() {
    if (pythonProcess) {
        console.log('El lector GPS ya está corriendo.');
        return;
    }
    console.log('Iniciando lector GPS (gps_reader.py)...');
    // Asegúrate que la ruta a python y al script sean correctas
    pythonProcess = spawn('python', ['-u', 'gps_reader.py']); // -u para salida sin buffer

    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`Salida Python (stdout): ${output}`);
        // Busca líneas con nuestro prefijo
        if (output.startsWith('GPS_DATA:')) {
             const gpsString = output.substring('GPS_DATA:'.length);
             const parts = gpsString.split(',');
             if (parts.length >= 2) {
                try {
                    const gpsData = {
                        lat: parseFloat(parts[0]),
                        lng: parseFloat(parts[1]),
                        humidity: parts.length > 2 ? parseFloat(parts[2]) : null,
                        temperature: parts.length > 3 ? parseFloat(parts[3]) : null,
                        timestamp: Date.now()
                    };
                    // Envía los datos a todos los clientes WebSocket conectados
                    broadcastGpsData(gpsData);
                } catch (e) {
                     console.error("Error al parsear datos GPS de Python:", e);
                }
             }
        } else if (!output.toLowerCase().includes('conectado a') && !output.toLowerCase().includes('puerto serial cerrado') && !output.toLowerCase().includes('arduino encontrado')) {
             // Imprime otra salida que no sea la conexión inicial o cierre
             console.log(`Mensaje Python: ${output}`);
            
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error Python (stderr): ${data.toString().trim()}`);
        // Podrías notificar al frontend sobre errores aquí también si es necesario
    });

    pythonProcess.on('close', (code) => {
        console.log(`Proceso Python gps_reader.py terminado con código ${code}`);
        pythonProcess = null; // Resetear para poder reiniciarlo
         // Intentar reiniciar después de un tiempo si se cierra inesperadamente
         
    });

     pythonProcess.on('error', (err) => {
        console.error('Error al iniciar el proceso Python:', err);
         pythonProcess = null;
     });
}

// --- Endpoint API para iniciar la conexión (llamado desde React) ---
app.get('/api/connect-gps', (req, res) => {
  if (!pythonProcess) {
    startGpsReader();
    res.status(200).json({ success: true, message: 'Intentando conectar al GPS externo...' });
  } else {
    res.status(200).json({ success: true, message: 'El lector GPS ya está activo.' });
  }
});

app.get('/api/disconnect-gps', (req, res) => {
  if (pythonProcess) {
    console.log('Deteniendo lector GPS...');
    pythonProcess.kill('SIGTERM'); // Envía señal para terminar
    // Podrías necesitar SIGKILL si SIGTERM no funciona: pythonProcess.kill('SIGKILL');
    pythonProcess = null;
    res.status(200).json({ success: true, message: 'Lector GPS detenido.' });
  } else {
    res.status(200).json({ success: true, message: 'El lector GPS no estaba activo.' });
  }
});
// --- Fin Lógica Python ---


// Ruta raíz y listener
app.get("/", (req, res) => {
    return res.status(200).send("<h1>Backend Arcadia Explorer</h1>");
});

const puerto = process.env.PUERTO || 3001; // Cambiado a 3001 si React usa 3000
app.listen(puerto, () => {
    console.log(`Servidor HTTP corriendo en el puerto ${puerto}`);
    // Opcionalmente, iniciar el lector GPS automáticamente al arrancar el servidor
    // startGpsReader();
});