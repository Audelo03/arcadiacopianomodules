import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import styles from "../Estilos/inicioSesion.module.css";
import logo from "../Images/logo.jpeg";
import logoGoogle from "../Images/g-logo.png";
import { db } from "./firebase-config"; // Asumiendo que has configurado firebase-config.js
import ConfirmationDialog from "../Components//ConfirmationDialog"; // Importa el componente ConfirmationDialog

const auth = getAuth();
const provider = new GoogleAuthProvider();

export default function InicioSesion() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const navigate = useNavigate();

  // Maneja el cambio de input
  const handleInputChange = useCallback((e) => {
    const { id, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [id]: value,
    }));
  }, []);

  // Maneja el inicio de sesión con correo y contraseña
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const { email, password } = formData;

      signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;
          const userRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(userRef);

          if (!docSnap.exists()) {
            await setDoc(userRef, {
              email: user.email,
              firstName: user.displayName ? user.displayName.split(" ")[0] : "",
              lastName: user.displayName ? user.displayName.split(" ")[1] : "",
              gender: "no especificado",
              createdAt: new Date(),
            });
          }
          navigate("/mapa");
        })
        .catch((error) => {
          console.error("Error al iniciar sesión:", error.code, error.message);
          alert("Error al iniciar sesión: " + error.message);
        });
    },
    [formData, navigate]
  );

  // Maneja el inicio de sesión con Google
  const handleGoogleSignIn = useCallback(() => {
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const user = result.user;
        const userRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
          await setDoc(userRef, {
            email: user.email,
            firstName: user.displayName ? user.displayName.split(" ")[0] : "",
            lastName: user.displayName ? user.displayName.split(" ")[1] : "",
            gender: "no especificado",
            createdAt: new Date(),
          });
        }

        alert(`Bienvenido, ${user.displayName || user.email}!`);
        navigate("/mapa");
      })
      .catch((error) => {
        console.error(
          "Error al iniciar sesión con Google:",
          error.code,
          error.message
        );
        alert("Error al iniciar sesión con Google: " + error.message);
      });
  }, [navigate]);

  // Maneja la visibilidad de la contraseña
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prevState) => !prevState);
  }, []);

  // Maneja continuar sin iniciar sesión
  const handleContinueWithoutLogin = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  const handleConfirmContinue = useCallback(() => {
    setShowConfirmation(false);
    navigate("/mapa");
  }, [navigate]);

  const handleCancelContinue = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  return (
    <div className={styles["login-container"]}>
      <div className={styles["login-wrapper"]}>
        <div className={styles["login-image-panel"]}>
          <img
            src={logo}
            alt="Imagen de login"
            className={styles["login-image"]}
            loading="lazy"
          />
        </div>

        <div className={styles["login-form-panel"]}>
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales para acceder.</p>

          <form onSubmit={handleSubmit}>
            <div className={styles["form-group"]}>
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                placeholder="ej. juan.perez@gmail.com"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className={styles["form-group"]}>
              <label htmlFor="password">Contraseña</label>
              <div className={styles["password-input"]}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Ingresa tu contraseña"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className={styles["toggle-password"]}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <button type="submit" className={styles["login-button"]}>
              Iniciar sesión
            </button>

            <div className={styles["login-link"]}>
              <p>
                ¿No tienes cuenta? <a href="/signup">Regístrate</a>
              </p>
            </div>
          </form>

          <button
            type="button"
            className={styles["google-button"]}
            onClick={handleGoogleSignIn}
          >
            <img
              src={logoGoogle}
              alt="Google"
              className={styles["google-icon"]}
            />
            Continuar con Google
          </button>

          <button
            onClick={handleContinueWithoutLogin}
            className={styles["continue-button"]}
          >
            Continuar sin iniciar sesión
          </button>

          {/* Renderiza el ConfirmationDialog */}
          <ConfirmationDialog
            isOpen={showConfirmation} // Controla la visibilidad con el estado showConfirmation
            message="¿Estás seguro de que deseas continuar sin iniciar sesión? Perderás el acceso a funciones personalizadas." // Mensaje a mostrar
            onConfirm={handleConfirmContinue} // Función a ejecutar si se confirma
            onCancel={handleCancelContinue} // Función a ejecutar si se cancela
          />
        </div>
      </div>
    </div>
  );
}
