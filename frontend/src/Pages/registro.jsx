// src/Pages/registro.jsx
import React, { useState, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom"; // 👉 Importa useNavigate y Link
import styles from "../Estilos/registro.module.css";
import logo from "../Images/logo.jpeg";
import logoGoogle from "../Images/g-logo.png";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { app, db } from "./firebase-config";

const auth = getAuth(app);

// 🧩 InputField: campo reutilizable para inputs normales
const InputField = memo(
  ({ label, id, name, type, placeholder, value, onChange, required }) => (
    <div className={styles["input-group"]}>
      <label htmlFor={id}>{label}</label>
      <input
        type={type}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  )
);
InputField.displayNa = "InputField";

// 🔐 PasswordField: input de contraseña con botón para mostrar/ocultar
const PasswordField = memo(
  ({
    label,
    id,
    name,
    placeholder,
    value,
    onChange,
    required,
    showPassword,
    onTogglePassword,
  }) => (
    <div className={styles["form-group"]}>
      <label htmlFor={id}>{label}</label>
      <div className={styles["password-input"]}>
        <input
          type={showPassword ? "text" : "password"}
          id={id}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className={styles["toggle-password"]}
        >
          {showPassword ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  )
);
PasswordField.displayName = "PasswordField";

// ⚧ RadioGroup: grupo de botones para elegir el género
const RadioGroup = memo(
  ({ label, name, options, selectedValue, onChange, required }) => (
    <div className={styles["form-group"]}>
      <label>{label}</label>
      <div className={styles["radio-group"]}>
        {options.map((option) => (
          <label
            key={option}
            className={`${styles["radio-option"]} ${
              selectedValue === option.toLowerCase()
                ? styles["radio-option--checked"]
                : ""
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.toLowerCase()}
              checked={selectedValue === option.toLowerCase()}
              onChange={onChange}
              required={required}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  )
);
RadioGroup.displayName = "RadioGroup";

export default function Registro() {
  const navigate = useNavigate(); // 🧭 Hook para redireccionar a otra página

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    password: "",
  });
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // 📤 Se ejecuta al enviar el formulario
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const { email, password, firstName, lastName, gender } = formData;

      // 🔐 Crea usuario con Firebase Auth
      createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;

          // 🗃 Guarda datos extra del usuario en Firestore
          await setDoc(doc(db, "usuarios", user.uid), {
            firstName,
            lastName,
            gender,
            email,
            createdAt: new Date(),
          });

          // 🚀 Redirige al login una vez registrado
          navigate("/inicioSesion");
        })
        .catch((error) => {
          console.error("Error al registrar:", error.code, error.message);
          alert("Error al registrarse: " + error.message);
        });
    },
    [formData, navigate]
  );

  return (
    <div className={styles["signup-container"]}>
      <div className={styles["signup-wrapper"]}>
        <div className={styles["signup-image-panel"]}>
          <img
            src={logo}
            alt="Registro"
            className={styles["signup-image"]}
            loading="lazy"
          />
        </div>

        <div className={styles["signup-form-panel"]}>
          <h2>Crear Cuenta</h2>
          <p>Ingresa tus datos personales para crear tu cuenta.</p>

          <form onSubmit={handleSubmit}>
            <div className={styles["name-inputs"]}>
              <InputField
                label="Nombre"
                id="firstName"
                name="firstName"
                type="text"
                placeholder="ej. Juan"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
              <InputField
                label="Apellido"
                id="lastName"
                name="lastName"
                type="text"
                placeholder="ej. Pérez"
                value={formData.lastName}
                onChange={handleInputChange}
                required
              />
            </div>

            <RadioGroup
              label="Género"
              name="gender"
              options={["Masculino", "Femenino"]}
              selectedValue={formData.gender}
              onChange={handleInputChange}
              required
            />

            <InputField
              label="Correo Electrónico"
              id="email"
              name="email"
              type="email"
              placeholder="ej. juan.perez@gmail.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />

            <PasswordField
              label="Contraseña"
              id="password"
              name="password"
              placeholder="Ingresa tu contraseña"
              value={formData.password}
              onChange={handleInputChange}
              required
              showPassword={showPassword}
              onTogglePassword={togglePasswordVisibility}
            />

            <button type="submit" className={styles["submit-button"]}>
              Registrarse
            </button>

            <div className={styles["divider"]}>
              <div className={styles["divider-line"]}></div>
              <span>o regístrate con Google.</span>
              <div className={styles["divider-line"]}></div>
            </div>

            <button type="button" className={styles["google-button"]}>
              <img
                src={logoGoogle}
                alt="Google"
                className={styles["google-icon"]}
                loading="lazy"
              />
              Continuar con Google
            </button>

            <div className={styles["login-link"]}>
              <p>
                ¿Ya tienes una cuenta?{" "}
                <Link to="/inicioSesion">Inicia sesión</Link>
              </p>{" "}
              {/* ✅ Enlace sin recargar */}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
