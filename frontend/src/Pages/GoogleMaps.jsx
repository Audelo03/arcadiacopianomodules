import { useEffect, useState, useRef } from "react";
import styles from "../Estilos/GoogleMaps.module.css";
import Sidebar from "../Components/Sidebar";
import { IoReloadCircle } from "react-icons/io5";
import { MdGpsFixed, MdGpsOff } from "react-icons/md";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase-config";

// Carga el script de Google Maps solo si aún no está cargado
const loadGoogleMapsScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=AIzaSyC0c5g5slnWygHkivX_GRNxynCExzdUfew";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Error al cargar Google Maps"));
    document.head.appendChild(script);
  });

// Obtiene la ubicación actual del usuario
const getCurrentLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error("Geolocalización no soportada"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => reject(new Error("No se pudo obtener la ubicación")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

export default function GoogleMaps() {
  // Estados principales
  const [location, setLocation] = useState(null);
  const [externalGpsLocation, setExternalGpsLocation] = useState(null);
  const [error, setError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [usingExternalGps, setUsingExternalGps] = useState(false);
  const [lugares, setLugares] = useState([]);

  // Referencias para mapa y marcadores
  const mapRef = useRef(null);
  const activeMarkerRef = useRef(null);
  const markersRef = useRef([]);

  const kmlUrl =
    "https://drive.google.com/uc?export=download&id=1x9QAfgazqKBYU0kmCOCXU6Od1oo_HhLU";

  // Solicita ubicación y actualiza estado
  const requestLocation = async () => {
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (err) {
      setError(err.message);
    }
  };

  // Agrega marcador de GPS (interno o externo)
  const updateMarker = (lat, lng, isExternal = usingExternalGps) => {
    if (!mapRef.current || !window.google?.maps) return;

    activeMarkerRef.current?.setMap(null); // elimina marcador anterior

    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapRef.current,
      title: isExternal ? "GPS Externo" : "Mi ubicación actual",
      icon: {
        url: isExternal ? "/icons/gps_externo.png" : "/icons/gps_interno.png",
        scaledSize: new window.google.maps.Size(32, 32),
      },
    });

    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="color: #000;">
          <h3>${marker.title}</h3><br/>
          Lat: ${lat.toFixed(6)}<br/>
          Lng: ${lng.toFixed(6)}
        </div>`,
    });

    marker.addListener("click", () => infoWindow.open(mapRef.current, marker));
    activeMarkerRef.current = marker;
  };

  // Alterna entre GPS interno y externo
  const toggleGpsSource = () => {
    const useExternal = !usingExternalGps;
    setUsingExternalGps(useExternal);

    const current = useExternal ? externalGpsLocation : location;
    if (current) {
      updateMarker(current.lat, current.lng, useExternal);
      mapRef.current?.panTo(current);
    }
  };

  // Carga Google Maps y solicita ubicación al montar el componente
  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        setMapLoaded(true);
        await requestLocation();
      } catch (err) {
        setError(err.message);
      }
    };
    if (!window.google?.maps) initMap();
    else setMapLoaded(true);
  }, []);

  // Consulta lugares de Firebase por tipo
  const fetchLugaresPorTipo = async (tipo) => {
    try {
      const querySnapshot = await getDocs(collection(db, "lugares"));
      const data = querySnapshot.docs
        .map((doc) => doc.data())
        .filter((l) => l.tipo === tipo);
      setLugares(data);
    } catch (err) {
      console.error("Error al obtener lugares:", err);
    }
  };

  // Actualiza el mapa y los marcadores cuando cambian datos clave
  useEffect(() => {
    if (!mapLoaded || !window.google?.maps) return;
    const current = usingExternalGps ? externalGpsLocation : location;
    if (!current) return;

    // Crea el mapa si no existe aún
    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(
        document.getElementById("map"),
        {
          center: current,
          zoom: 15,
          mapTypeId: "roadmap",
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          gestureHandling: "greedy",
          disableDoubleClickZoom: true,
        }
      );

      // Agrega capa KML
      new window.google.maps.KmlLayer({
        url: kmlUrl,
        map: mapRef.current,
        preserveViewport: true,
      });
    }

    mapRef.current.panTo(current);
    updateMarker(current.lat, current.lng);

    // Elimina marcadores anteriores
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Agrega nuevos marcadores de lugares
    lugares.forEach((lugar) => {
      const iconosPorTipo = {
        Museos: "/icons/museo.png",
        "Monumentos Históricos": "/icons/monumento.png",
        Naturaleza: "/icons/naturaleza.png",
        Gastronomía: "/icons/gastronomia.png",
        "Dependencias de Gobierno": "/icons/gobierno.png",
        Hospedaje: "/icons/hospedaje.png",
      };

      const { lat, lng } = lugar.ubicacion || {};
      if (!lat || !lng) return;

      //marcador con imagen
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapRef.current,
        title: lugar.nombre,
        icon: {
          url: iconosPorTipo[lugar.tipo] || undefined,
          scaledSize: new window.google.maps.Size(32, 32),
        },
      });

      // Crea carrusel de imágenes
      const id = `carrusel-${Math.random().toString(36).substr(2, 9)}`;
      const imagenes = lugar.imagenes;

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color: #000; width: 220px; font-family: sans-serif;">
            <h3>${lugar.nombre}</h3><br/>
            <div id="${id}" style="text-align: center;">
              <div style="width: 100%; height: 150px; overflow: hidden; border-radius: 8px;">
                <img src="${
                  imagenes[0]
                }" id="${id}-img" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="margin-top: 5px;">
                <button id="${id}-prev">⬅️</button>
                <button id="${id}-next">➡️</button>
              </div>
            </div>
            <p style="margin-top: 10px;">${lugar.descripcion}</p>
            <strong>Tipo:</strong> ${lugar.tipo}<br/>
            <strong>Costo:</strong> ${lugar.costo_entrada || "Gratis"}<br/>
            <strong>Horario:</strong> ${lugar.horario || "No especificado"}
          </div>`,
      });

      infoWindow.addListener("domready", () => {
        let index = 0;
        const imgEl = document.getElementById(`${id}-img`);
        const prev = document.getElementById(`${id}-prev`);
        const next = document.getElementById(`${id}-next`);

        prev.onclick = () => {
          index = (index - 1 + imagenes.length) % imagenes.length;
          imgEl.src = imagenes[index];
        };

        next.onclick = () => {
          index = (index + 1) % imagenes.length;
          imgEl.src = imagenes[index];
        };
      });

      marker.addListener("click", () =>
        infoWindow.open(mapRef.current, marker)
      );

      markersRef.current.push(marker);
    });
  }, [location, externalGpsLocation, mapLoaded, usingExternalGps, lugares]);

  // Interfaz del componente
  return (
    <div className={styles.mapRoot}>
      <Sidebar />

      {/* Botones de control (GPS y actualizar ubicación) */}
      <div className={`${styles.mapHeader} ${styles.transparentHeader}`}>
        {location && (
          <button
            onClick={requestLocation}
            className={styles.mapButton}
            title="Actualizar ubicación"
          >
            <IoReloadCircle className={styles.reload} size={40} />
          </button>
        )}
        <button
          onClick={toggleGpsSource}
          className={`${styles.mapButton} ${styles.gpsToggle}`}
          title="Cambiar fuente GPS"
        >
          {usingExternalGps ? <MdGpsFixed size={30} /> : <MdGpsOff size={30} />}
        </button>
      </div>

      {/* Contenedor del mapa */}
      <div className={styles.mapContainer}>
        <div id="map" className={styles.mapElement}></div>
      </div>

      {/* Botones de categoría */}
      <div className={styles.footerButtons}>
        {[
          { tipo: "Museos", emoji: "🏛️" },
          { tipo: "Monumentos Históricos", emoji: "🗿" },
          { tipo: "Naturaleza", emoji: "🌿" },
          { tipo: "Gastronomía", emoji: "🍽️" },
          { tipo: "Dependencias de Gobierno", emoji: "🏢" },
          { tipo: "Hospedaje", emoji: "🏨" },
        ].map(({ tipo, emoji }) => (
          <button
            key={tipo}
            onClick={() => fetchLugaresPorTipo(tipo)}
            className={styles.categoryButton}
          >
            <span>{emoji}</span> {tipo}
          </button>
        ))}
      </div>
    </div>
  );
}
