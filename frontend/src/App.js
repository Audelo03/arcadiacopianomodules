import React, { useState, useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./App.css";
import './Estilos/global.css';
import GoogleMaps from "./Pages/GoogleMaps";
import Registro from "./Pages/registro";
import InicioSesion from "./Pages/inicioSesion";
import SplashScreen from "./Components/SplashScreen";
import './Estilos/SplashScreen.module.css'; // Asegúrate de importar el archivo CSS correcto

// Duraciones (en milisegundos)
const SPLASH_DISPLAY_TIME = 2000; // Incrementamos el tiempo de visualización del splash
const FADE_OUT_DURATION = 1500;   // Aumentamos para coincidir con la transición CSS (2.5s)

const App = () => {
  const [isFadingOut, setIsFadingOut] = useState(false); // Estado para iniciar el fade-out
  const [showSplash, setShowSplash] = useState(true);    // Estado para mantener/quitar el splash del DOM

  useEffect(() => {
    // 1. Iniciar el fade-out después del tiempo de visualización
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true); // Aplica la clase splashContainerHidden
    }, SPLASH_DISPLAY_TIME);

    // 2. Quitar el splash del DOM DESPUÉS de que termine completamente la animación de fade-out
    const removeSplashTimer = setTimeout(() => {
      setShowSplash(false); // Quita el componente SplashScreen
    }, SPLASH_DISPLAY_TIME + FADE_OUT_DURATION);

    // Limpieza de todos los temporizadores
    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(removeSplashTimer);
    };
  }, []); // Ejecutar solo una vez

  return (
    <div className="Todo">
      {/* Renderiza el SplashScreen solo si showSplash es true */}
      {showSplash && (
        <div className={`splashContainer ${isFadingOut ? 'splashContainerHidden' : ''}`}>
          <SplashScreen />
        </div>
      )}

      {/* Renderiza el resto de la app siempre, pero inicialmente oculto por el splash */}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<InicioSesion />} />
          <Route path="/login" element={<InicioSesion />} />
          <Route path="/signup" element={<Registro />} />
          <Route path="/mapa" element={<GoogleMaps />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;