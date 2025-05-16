// frontend/src/Components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { FaBars, FaRoute, FaSignOutAlt, FaListUl, FaTrashAlt } from "react-icons/fa"; // Añadido FaSignOutAlt, FaRoute, FaListUl, FaTrashAlt
import { BiLogIn } from "react-icons/bi";
import { IoPeopleOutline } from "react-icons/io5";
import { NavLink, useNavigate } from 'react-router-dom'; // Añadido useNavigate
import '../Estilos/Sidebar.css';
import logoPng from '../Images/logopng.png';
import { MdOutlineDeveloperBoard } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

// Importaciones de Firebase para autenticación
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from '../Pages/firebase-config'; // Importa tu instancia de auth

// Asumiendo que db también se usa para rutas, lo importamos
import { db } from '../Pages/firebase-config';
import { collection, getDocs } from "firebase/firestore";

// Props añadidas: onShowRoutes, onClearRoutes, onToggleRouteSelectionMode
const Sidebar = ({ onShowRoutes, onClearRoutes, isShowingRoutes, onToggleRouteList }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMenuIndex, setExpandedMenuIndex] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // Estado para el usuario actual
  const navigate = useNavigate(); // Hook para navegación

  // Estados para GPS (existentes)
  const [showGpsMessage, setShowGpsMessage] = useState(false);
  const [gpsMessageText, setGpsMessageText] = useState('');
  const [gpsConnected, setGpsConnected] = useState(false);
  const [connectingGps, setConnectingGps] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(null);

  // ... (otros estados)
const [showRouteListModal, setShowRouteListModal] = useState(false);
const [allAvailableRoutes, setAllAvailableRoutes] = useState([]); // [{id, nombre, kmlUrl, colorSugerido}]
const [selectedRoutesForMap, setSelectedRoutesForMap] = useState(new Set()); // Set de IDs
const [loadingRoutes, setLoadingRoutes] = useState(false);
  // Efecto para observar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe(); // Limpieza al desmontar
  }, []);

  const toggle = () => {
    if (isOpen) {
      setExpandedMenuIndex(null);
    }
    setIsOpen(!isOpen);
  };

  const toggleSubMenu = (index) => {
    if (!isOpen) {
      setIsOpen(true);
      setExpandedMenuIndex(index);
    } else {
      setExpandedMenuIndex(prevIndex => (prevIndex === index ? null : index));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("Sesión cerrada");
      navigate('/login'); // Redirige al login después de cerrar sesión
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      // Aquí podrías mostrar un mensaje de error al usuario
    }
  };

  // Lógica de GPS (existente - sin cambios relevantes aquí, solo se muestra por completitud)
  useEffect(() => {
    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
    };
  }, [connectionTimeout]);

  const handleExternalGpsClick = () => {
    if (gpsConnected) {
      disconnectGps();
      return;
    }
    if (connectingGps) {
      return;
    }
    setConnectingGps(true);
    setGpsMessageText("Conectando... Asegúrate que los datos GPS (longitud, latitud, [humedad], [temperatura]) estén separados por comas.");
    setShowGpsMessage(true);
    const timeoutId = setTimeout(() => {
      if (connectingGps) {
        setGpsMessageText("Error: Tiempo de espera agotado. Verifica que el dispositivo GPS esté disponible.");
        setConnectingGps(false);
        setTimeout(() => setShowGpsMessage(false), 7000);
      }
    }, 10000);
    setConnectionTimeout(timeoutId);
    fetch('http://localhost:3001/api/connect-gps')
      .then(response => {
        const statusOk = response.ok;
        return response.json().then(data => ({ data, statusOk }));
      })
      .then(({ data, statusOk }) => {
        clearTimeout(timeoutId);
        if (statusOk || data.success) {
          setGpsMessageText(data.message || "GPS conectado correctamente");
          setGpsConnected(true);
          window.dispatchEvent(new Event('gps-connected'));
          setTimeout(() => setShowGpsMessage(false), 5000);
        } else {
          throw new Error(data.message || "Error al conectar con GPS");
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        setGpsMessageText("Error al conectar con GPS. Verifica que el backend esté activo y el dispositivo GPS esté conectado.");
        setTimeout(() => setShowGpsMessage(false), 7000);
      })
      .finally(() => setConnectingGps(false));
  };

  const disconnectGps = () => {
    setGpsMessageText("Desconectando GPS...");
    setShowGpsMessage(true);
    fetch('http://localhost:3001/api/disconnect-gps')
      .then(response => response.json())
      .then(data => {
        setGpsMessageText(data.message || "GPS desconectado correctamente");
        setGpsConnected(false);
        window.dispatchEvent(new Event('gps-disconnected'));
        setTimeout(() => setShowGpsMessage(false), 5000);
      })
      .catch(error => {
        setGpsMessageText("Error al desconectar GPS.");
        setGpsConnected(false);
        window.dispatchEvent(new Event('gps-disconnected'));
        setTimeout(() => setShowGpsMessage(false), 7000);
      });
  };

  const getGpsButtonText = () => {
    if (connectingGps) return 'Conectando GPS...';
    if (gpsConnected) return 'Desconectar GPS Externo';
    return 'Agregar GPS Externo';
  };
  const getGpsButtonIcon = () => {
    if (connectingGps) return <AiOutlineLoading3Quarters className="rotating-icon" />;
    return <MdOutlineDeveloperBoard />;
  };


  // Nuevos ítems de menú
  const menuItems = [
    {
      name: 'Cuenta',
      path: '/login', // O a una página de perfil si existe
      icon: <IoPeopleOutline />,
      // Condicional para mostrar submenú de login solo si no hay usuario
      submenu: !currentUser ? [ 
        { icon: <BiLogIn />, name: 'Iniciar Sesión', path: '/login' }
      ] : null,
      // Ocultar "Cuenta" si no hay submenú (o sea, si hay usuario logueado y no queremos mostrar nada más aquí)
      // O podrías tener otras opciones de cuenta aquí cuando está logueado.
      // Por ahora, si está logueado, esta opción principal no tendrá submenú.
    },
    {
      name: getGpsButtonText(), // Lógica de GPS existente
      path: '#',
      icon: getGpsButtonIcon(),
      action: handleExternalGpsClick,
      className: connectingGps ? 'connecting' : (gpsConnected ? 'connected' : '')
    },
    // Nueva opción para Rutas
    {
      name: isShowingRoutes ? 'Eliminar Rutas Mostradas' : 'Mostrar Rutas',
      icon: isShowingRoutes ? <FaTrashAlt /> : <FaRoute />,
      action: () => {
        if (isShowingRoutes) {
          onClearRoutes(); // Llama a la función de GoogleMaps.jsx
        } else {
          onToggleRouteList(true); // Abre el modal/panel de selección de rutas
        }
      },
    },
  ];

  // Añadir "Cerrar Sesión" solo si hay un usuario logueado
  if (currentUser) {
    menuItems.push({
      name: 'Cerrar Sesión',
      icon: <FaSignOutAlt />,
      action: handleLogout,
      path: '#' // Opcional, ya que 'action' maneja el click
    });
  }

  // ... (renderMenuItem y el return JSX se mantienen, pero renderMenuItem usará los nuevos menuItems)
  // Asegúrate que renderMenuItem maneje bien los items que solo tienen 'action' y no 'path' o 'submenu'

  const renderMenuItem = (item, index) => {
    const isExpanded = expandedMenuIndex === index;
    // Añade item.className a linkClass para el estado 'connecting' o 'connected' del GPS
    const linkClass = `link ${item.submenu && isExpanded ? 'expanded' : ''} ${item.className || ''}`;

    if (item.action) {
      // Es un botón de acción (Logout, GPS, Mostrar/Eliminar Rutas)
      return (
        <div key={item.name + index} className={linkClass} onClick={item.action} 
             style={{cursor: (item.name === getGpsButtonText() && connectingGps) ? 'wait' : 'pointer'}}>
          <div className="icon">{item.icon}</div>
          <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
        </div>
      );
    } else if (item.submenu && item.submenu.length > 0) { // Verifica que submenu exista y no esté vacío
      // Es un menú con submenú
      return (
        <div key={item.name + index}>
          <div className={linkClass} onClick={() => toggleSubMenu(index)} style={{cursor: 'pointer'}}>
            <div className="icon">{item.icon}</div>
            <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
          </div>
          <div className={`submenu_container ${isExpanded ? 'open' : ''}`}>
            {isExpanded && item.submenu.map((subitem, subindex) => (
              <NavLink to={subitem.path} key={subitem.name + subindex} className="link sublink" activeclassname="active">
                <div className="icon">{subitem.icon}</div>
                <div className="submenu_text">{subitem.name}</div>
              </NavLink>
            ))}
          </div>
        </div>
      );
    } else if (item.path) { // Solo renderiza como NavLink si tiene un path y no es una acción/submenú
      // Es un enlace simple
      return (
        <NavLink to={item.path} key={item.name + index} className={linkClass} activeclassname="active">
          <div className="icon">{item.icon}</div>
          <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
        </NavLink>
      );
    }
    return null; // En caso de que un item no tenga path, action ni submenu válido
  };

  return (
    <> 
      <div className={`sidebar ${isOpen ? "open" : ""}`} style={{ width: isOpen ? "var(--sidebar-width)" : "60px" }}>
        <div className="top">
          <h1 style={{ display: isOpen ? "flex" : "none" }} className="logo">
            <img src={logoPng} alt="Logo" className="logoPng" />
          </h1>
          <div className="bars" onClick={toggle} style={{ display: isOpen && window.innerWidth > 768 ? 'flex' : (window.innerWidth <= 768 ? 'none' : 'flex') }}>
            <FaBars />
          </div>
        </div>
        {menuItems.map(renderMenuItem)}

        {showGpsMessage && (
          <div className={`gps-status-message ${connectingGps ? 'connecting' : (gpsConnected ? 'success' : 'error')}`}>
            {gpsMessageText}
          </div>
        )}
      </div>
      <div className="mobile-menu-toggle" onClick={toggle}>
        <img alt="logopng" src={logoPng} className='logoPng'/>
      </div>
    </>
  );
};

export default Sidebar;