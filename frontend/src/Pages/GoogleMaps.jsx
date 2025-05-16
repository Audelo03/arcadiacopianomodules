import { useEffect, useState, useRef, useCallback } from "react";
import styles from "../Estilos/GoogleMaps.module.css";
import Sidebar from "../Components/Sidebar";
import { IoReloadCircle } from "react-icons/io5";
import {
  MdGpsFixed,
  MdGpsOff,
  MdMuseum,
  MdPark,
  MdFastfood,
  MdHotel,
} from "react-icons/md";
import { FaLandmark, FaBuilding, FaMapMarkerAlt } from "react-icons/fa";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase-config";

// Carga el script de Google Maps solo si aún no está cargado
const loadGoogleMapsScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=AIzaSyC0c5g5slnWygHkivX_GRNxynCExzdUfew"; // Reemplaza con tu API Key si es necesario
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

const poiTypes = [
  { tipo: "Museos", Icono: MdMuseum, emoji: "🏛️" },
  { tipo: "Monumentos Históricos", Icono: FaLandmark, emoji: "🗿" },
  { tipo: "Naturaleza", Icono: MdPark, emoji: "🌿" },
  { tipo: "Gastronomía", Icono: MdFastfood, emoji: "🍽️" },
  { tipo: "Dependencias de Gobierno", Icono: FaBuilding, emoji: "🏢" },
  { tipo: "Hospedaje", Icono: MdHotel, emoji: "🏨" },
];

export default function GoogleMaps() {
  const [location, setLocation] = useState(null);
  const [externalGpsLocation, setExternalGpsLocation] = useState(null);
  const [error, setError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [usingExternalGps, setUsingExternalGps] = useState(false);
  const [lugares, setLugares] = useState([]);

  const mapRef = useRef(null);
  const activeMarkerRef = useRef(null);
  const markersRef = useRef([]);

  const [isPoiMenuOpen, setIsPoiMenuOpen] = useState(false);
  const [selectedPoiType, setSelectedPoiType] = useState(null);

  const kmlUrl =
    "https://drive.google.com/uc?export=download&id=1x9QAfgazqKBYU0kmCOCXU6Od1oo_HhLU";

  const requestLocation = useCallback(async () => {
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const updateMarker = useCallback(
    (lat, lng, isExternal = usingExternalGps) => {
      if (!mapRef.current || !window.google?.maps) return;

      activeMarkerRef.current?.setMap(null);

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapRef.current,
        title: isExternal ? "GPS Externo" : "Mi ubicación actual",
        icon: {
          url: isExternal
            ? "/icons/gps_externo.png"
            : "/icons/gps_interno.png",
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

      marker.addListener("click", () =>
        infoWindow.open(mapRef.current, marker)
      );
      activeMarkerRef.current = marker;
    },
    [usingExternalGps]
  );

  const toggleGpsSource = useCallback(() => {
    const useExternal = !usingExternalGps;
    setUsingExternalGps(useExternal);

    const current = useExternal ? externalGpsLocation : location;
    if (current) {
      updateMarker(current.lat, current.lng, useExternal);
      mapRef.current?.panTo(current);
    }
  }, [
    usingExternalGps,
    externalGpsLocation,
    location,
    updateMarker,
  ]);

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
    else {
      setMapLoaded(true);
      if (!location) { // Solo pide la ubicación si aún no la tiene
        requestLocation();
      }
    }
  }, [requestLocation, location]);

  const fetchLugaresPorTipo = useCallback(async (tipo) => {
    try {
      const querySnapshot = await getDocs(collection(db, "lugares"));
      const data = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((l) => l.tipo === tipo);
      setLugares(data);
    } catch (err) {
      console.error("Error al obtener lugares:", err);
      setError("Error al cargar lugares de interés.");
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !window.google?.maps) return;
    const current = usingExternalGps ? externalGpsLocation : location;
    if (!current) return;

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

      new window.google.maps.KmlLayer({
        url: kmlUrl,
        map: mapRef.current,
        preserveViewport: true,
      });
    }

    if (mapRef.current.getCenter().lat() !== current.lat || mapRef.current.getCenter().lng() !== current.lng) {
      mapRef.current.panTo(current);
    }
    updateMarker(current.lat, current.lng);

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    lugares.forEach((lugar) => {
      const poiDefinition = poiTypes.find(pt => pt.tipo === lugar.tipo);
      const iconUrl = poiDefinition?.Icono ? null : (poiDefinition?.emoji ? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20">${poiDefinition.emoji}</text></svg>`)}` : '/icons/default_poi.png');


      const { lat, lng } = lugar.ubicacion || {};
      if (typeof lat !== 'number' || typeof lng !== 'number') return;


      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapRef.current,
        title: lugar.nombre,
        icon: iconUrl ? {
          url: iconUrl,
          scaledSize: new window.google.maps.Size(32, 32),
        } : undefined, // Si no hay emoji, usa el icono por defecto de Google Maps o el que definas para Icono
      });


      const id = `carrusel-${lugar.id || Math.random().toString(36).substr(2, 9)}`;
      const imagenes = lugar.imagenes && lugar.imagenes.length > 0 ? lugar.imagenes : ['/icons/placeholder.png'];


      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color: #000; width: 220px; font-family: sans-serif;">
            <h3>${lugar.nombre}</h3><br/>
            <div id="${id}" style="text-align: center;">
              <div style="width: 100%; height: 150px; overflow: hidden; border-radius: 8px; background-color: #f0f0f0;">
                <img src="${
                  imagenes[0]
                }" id="${id}-img" style="width: 100%; height: 100%; object-fit: cover;" alt="${lugar.nombre}" />
              </div>
              ${imagenes.length > 1 ? `
              <div style="margin-top: 5px;">
                <button id="${id}-prev" style="margin-right: 5px;">⬅️</button>
                <button id="${id}-next">➡️</button>
              </div>` : ''}
            </div>
            <p style="margin-top: 10px; font-size: 0.9em;">${lugar.descripcion || "No hay descripción disponible."}</p>
            <strong>Tipo:</strong> ${lugar.tipo}<br/>
            <strong>Costo:</strong> ${lugar.costo_entrada || "Gratis"}<br/>
            <strong>Horario:</strong> ${lugar.horario || "No especificado"}
          </div>`,
      });

      infoWindow.addListener("domready", () => {
        if (imagenes.length > 1) {
          let index = 0;
          const imgEl = document.getElementById(`${id}-img`);
          const prev = document.getElementById(`${id}-prev`);
          const next = document.getElementById(`${id}-next`);

          if (imgEl && prev && next) {
            prev.onclick = () => {
              index = (index - 1 + imagenes.length) % imagenes.length;
              imgEl.src = imagenes[index];
            };
            next.onclick = () => {
              index = (index + 1) % imagenes.length;
              imgEl.src = imagenes[index];
            };
          }
        }
      });

      marker.addListener("click", () =>
        infoWindow.open(mapRef.current, marker)
      );
      markersRef.current.push(marker);
    });
  }, [
    location,
    externalGpsLocation,
    mapLoaded,
    usingExternalGps,
    lugares,
    kmlUrl,
    updateMarker
  ]);


  const togglePoiMenu = useCallback(() => {
    setIsPoiMenuOpen(prev => !prev);
  }, []);

  const handlePoiTypeSelect = useCallback((poi) => {
    setSelectedPoiType(poi);
    fetchLugaresPorTipo(poi.tipo);
    setIsPoiMenuOpen(false); // Cierra el menú después de seleccionar
  }, [fetchLugaresPorTipo]);


  return (
    <div className={styles.mapRoot}>
     <Sidebar />
      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={`${styles.mapHeader} ${styles.transparentHeader}`}>
        {location && (
          <button
            onClick={requestLocation}
            className={styles.mapButton}
            title="Actualizar ubicación"
          >
            <IoReloadCircle size={24} />
          </button>
        )}
        <button
          onClick={toggleGpsSource}
          className={`${styles.mapButton} ${styles.gpsToggle}`}
          title="Cambiar fuente GPS"
        >
          {usingExternalGps ? <MdGpsFixed size={24} /> : <MdGpsOff size={24} />}
        </button>
      </div>

      <div className={styles.mapContainer}>
        {!mapLoaded && (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            Cargando mapa...
          </div>
        )}
        <div id="map" className={styles.mapElement} style={{ visibility: mapLoaded ? 'visible' : 'hidden' }}></div>
      </div>


       {/* Menú Desplegable de POI */}
      <div className={styles.poiFabContainer}>
        {isPoiMenuOpen && (
          <div className={styles.poiMenu}>
            {poiTypes.map((poi, index) => (
              <button
                key={poi.tipo}
                onClick={() => handlePoiTypeSelect(poi)}
                className={styles.poiMenuItem}
                title={poi.tipo}
                // Aquí aplicamos el retraso escalonado para la animación
                style={{ animationDelay: `${index * 0.08}s` }} 
              >
                <poi.Icono size={22} />
                <span className={styles.poiMenuItemText}>{poi.tipo}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={togglePoiMenu}
          className={styles.poiFab}
          title={selectedPoiType ? `Mostrando: ${selectedPoiType.tipo}` : "Seleccionar tipo de lugar"}
          aria-expanded={isPoiMenuOpen}
          aria-haspopup="true"
        >
          {selectedPoiType ? <selectedPoiType.Icono size={28} /> : <FaMapMarkerAlt size={28} />}
        </button>
      </div>
    </div>
  );
}