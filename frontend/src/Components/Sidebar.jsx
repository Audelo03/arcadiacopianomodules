import React, { useState, useEffect } from 'react';
import { FaBars, FaTh } from "react-icons/fa";
import { BiLogIn } from "react-icons/bi";
import { IoPeopleOutline } from "react-icons/io5";
import { NavLink } from 'react-router-dom';
import '../Estilos/Sidebar.css';
import logo from '../Images/logo.jpeg';
import logoPng from '../Images/logopng.png';
import { MdOutlineDeveloperBoard } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

const Sidebar = ({ nose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMenuIndex, setExpandedMenuIndex] = useState(null);
  const [showGpsMessage, setShowGpsMessage] = useState(false);
  const [gpsMessageText, setGpsMessageText] = useState('');
  const [gpsConnected, setGpsConnected] = useState(false);
  const [connectingGps, setConnectingGps] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(null);

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

  // Efecto para limpiar el timeout al desmontar el componente
  useEffect(() => {
    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
    };
  }, [connectionTimeout]);

  const handleExternalGpsClick = () => {
    // Si ya está conectado, desconectar
    if (gpsConnected) {
      disconnectGps();
      return;
    }

    // Si ya está en proceso de conexión, no hacer nada
    if (connectingGps) {
      return;
    }

    console.log("Conectando a GPS Externo...");
    setConnectingGps(true);
    setGpsMessageText("Conectando... Asegúrate que los datos GPS (longitud, latitud, [humedad], [temperatura]) estén separados por comas.");
    setShowGpsMessage(true);

    // Configurar un tiempo de espera de 10 segundos
    const timeoutId = setTimeout(() => {
      if (connectingGps) {
        console.error("Tiempo de espera agotado al conectar con GPS");
        setGpsMessageText("Error: Tiempo de espera agotado. Verifica que el dispositivo GPS esté disponible.");
        setConnectingGps(false);
        
        // Mantener el mensaje de error visible por 7 segundos
        setTimeout(() => {
          setShowGpsMessage(false);
        }, 7000);
      }
    }, 10000);
    
    setConnectionTimeout(timeoutId);

    // Llamar al endpoint del backend para iniciar la conexión
    fetch('http://localhost:3001/api/connect-gps')
      .then(response => {
        const statusOk = response.ok; // Guardar el estado de la respuesta
        return response.json().then(data => {
          return { data, statusOk };
        });
      })
      .then(({ data, statusOk }) => {
        // Limpiar el timeout ya que obtuvimos respuesta
        clearTimeout(timeoutId);
        
        console.log("Respuesta del servidor:", data);
        
        // Considerar exitosa la respuesta si el status es 200 o si data.success es true
        if (statusOk || data.success) {
          setGpsMessageText(data.message || "GPS conectado correctamente");
          setGpsConnected(true);
          
          // Disparar un evento personalizado para notificar al componente GoogleMaps
          const gpsConnectedEvent = new Event('gps-connected');
          window.dispatchEvent(gpsConnectedEvent);
          
          // Mantener el mensaje visible por 5 segundos
          setTimeout(() => {
            setShowGpsMessage(false);
          }, 5000);
        } else {
          throw new Error(data.message || "Error al conectar con GPS");
        }
      })
      .catch(error => {
        // Limpiar el timeout ya que obtuvimos respuesta (aunque sea error)
        clearTimeout(timeoutId);
        
        console.error("Error al conectar con GPS:", error);
        setGpsMessageText("Error al conectar con GPS. Verifica que el backend esté activo y el dispositivo GPS esté conectado.");
        
        // En caso de error, mantener el mensaje visible por más tiempo
        setTimeout(() => {
          setShowGpsMessage(false);
        }, 7000);
      })
      .finally(() => {
        setConnectingGps(false);
      });
  };

  const disconnectGps = () => {
    console.log("Desconectando GPS Externo...");
    setGpsMessageText("Desconectando GPS...");
    setShowGpsMessage(true);

    fetch('http://localhost:3001/api/disconnect-gps')
      .then(response => response.json())
      .then(data => {
        console.log("Respuesta del servidor:", data);
        setGpsMessageText(data.message || "GPS desconectado correctamente");
        setGpsConnected(false);
        
        // Disparar un evento personalizado para notificar al componente GoogleMaps
        const gpsDisconnectedEvent = new Event('gps-disconnected');
        window.dispatchEvent(gpsDisconnectedEvent);
        
        setTimeout(() => {
          setShowGpsMessage(false);
        }, 5000);
      })
      .catch(error => {
        console.error("Error al desconectar GPS:", error);
        setGpsMessageText("Error al desconectar GPS.");
        setGpsConnected(false); // Asegurarnos de que el estado quede como desconectado incluso si hay error
        
        // Disparar el evento de desconexión incluso si hay error en la API
        const gpsDisconnectedEvent = new Event('gps-disconnected');
        window.dispatchEvent(gpsDisconnectedEvent);
        
        setTimeout(() => {
          setShowGpsMessage(false);
        }, 7000);
      });
  };

  // Determinar el texto del botón de GPS basado en el estado actual
  const getGpsButtonText = () => {
    if (connectingGps) return 'Conectando GPS...';
    if (gpsConnected) return 'Desconectar GPS Externo';
    return 'Agregar GPS Externo';
  };

  // Determinar el ícono para el botón de GPS
  const getGpsButtonIcon = () => {
    if (connectingGps) return <AiOutlineLoading3Quarters className="rotating-icon" />;
    return <MdOutlineDeveloperBoard />;
  };

  const menuItems = [
    {
      name: 'Cuenta',
      path: '/login',
      icon: <IoPeopleOutline />,
      submenu: [
        { icon: <BiLogIn />, name: 'Iniciar Sesión', path: '/login' }
      ]
    },
    {
      name: getGpsButtonText(),
      path: '#',
      icon: getGpsButtonIcon(),
      action: handleExternalGpsClick,
      className: connectingGps ? 'connecting' : (gpsConnected ? 'connected' : '')
    }
  ];

  const renderMenuItem = (item, index) => {
    const isExpanded = expandedMenuIndex === index;
    const linkClass = `link ${item.submenu && isExpanded ? 'expanded' : ''} ${item.className || ''}`;

    if (item.action) {
      // Es un botón de acción
      return (
        <div key={index} className={linkClass} onClick={item.action} style={{cursor: connectingGps ? 'wait' : 'pointer'}}>
          <div className="icon">{item.icon}</div>
          <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
        </div>
      );
    } else if (item.submenu) {
      // Es un menú con submenú
      return (
        <div key={index}>
          <div className={linkClass} onClick={() => toggleSubMenu(index)} style={{cursor: 'pointer'}}>
            <div className="icon">{item.icon}</div>
            <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
          </div>
          <div className={`submenu_container ${isExpanded ? 'open' : ''}`}>
            {isExpanded && item.submenu.map((subitem, subindex) => (
              <NavLink to={subitem.path} key={subindex} className="link sublink" activeclassname="active">
                <div className="icon">{subitem.icon}</div>
                <div className="submenu_text">{subitem.name}</div>
              </NavLink>
            ))}
          </div>
        </div>
      );
    } else {
      // Es un enlace simple
      return (
        <NavLink to={item.path} key={index} className={linkClass} activeclassname="active">
          <div className="icon">{item.icon}</div>
          <div style={{ display: isOpen ? "block" : "none" }} className="link_text">{item.name}</div>
        </NavLink>
      );
    }
  };

  return (
    <div className="contenedor">
      <div className={`sidebar ${isOpen ? "open" : ""}`} style={{ width: isOpen ? "var(--sidebar-width)" : "60px" }}>
        <div className="top">
          <h1 style={{ display: isOpen ? "flex" : "none" }} className="logo">
            <img src={logoPng} alt="Logo" className="logoPng" />
            <span style={{ marginLeft: '10px' }}></span>
          </h1>
          <div className="bars" onClick={toggle}>
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
      <main>{nose}</main>
      <div className="mobile-menu-toggle" onClick={toggle}>
        <img alt="logopng" src={logoPng} className='logoPng'/>
      </div>
    </div>
  );
};

export default Sidebar;