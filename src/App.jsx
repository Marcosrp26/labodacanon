import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bus,
  CalendarDays,
  Camera,
  CheckCircle2,
  Heart,
  MapPin,
  Send,
  Sparkles,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";

const initialForm = {
  nombre: "",
  asiste: "si",
  bus: "no",
  alergias: "",
  aceptaPrivacidad: false,
};

export default function App() {
  const [page, setPage] = useState("home");
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const { error } = await supabase.from("invitados").insert({
      nombre: form.nombre.trim(),
      asiste: form.asiste === "si",
      bus: form.bus,
      alergias: form.alergias.trim(),
      acepta_privacidad: true,
    });

    if (error) {
      console.error("Error guardando respuesta:", error);
      setStatus("error");
      setMessage(
        "No hemos podido guardar tu respuesta. Revisa la conexión e inténtalo de nuevo."
      );
      return;
    }

    setStatus("success");
    setMessage("Tu respuesta se ha guardado correctamente.");
  };

  if (page === "photos") {
    return (
      <main className="wedding-page">
        <section className="coming-soon-section">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="coming-soon-card"
          >
            <span className="icon-bubble">
              <Camera aria-hidden="true" />
            </span>
            <p className="eyebrow">Galería</p>
            <h1>Fotos de la boda</h1>
            <p>
              Muy pronto prepararemos aquí un rincón para revivir los recuerdos
              más bonitos del día. De momento, la sección queda reservada.
            </p>
            <button className="secondary-button" onClick={() => setPage("home")}>
              Volver a la invitación
            </button>
          </motion.div>
        </section>
      </main>
    );
  }

  return (
    <main className="wedding-page">
      <section className="hero-section">
        <div className="glow glow-rose" />
        <div className="glow glow-gold" />

        <div className="hero-grid">
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="intro-card"
          >
            <div className="pill">
              <Heart aria-hidden="true" />
              Nos encantaría compartir este día contigo
            </div>

            <p className="eyebrow">Nos casamos</p>
            <h1 className="couple-names">Sara & Enol</h1>
            <p className="welcome-text">
              Estamos preparando un día muy especial y queremos celebrarlo con
              las personas que más queremos. Confírmanos tu asistencia y
              ayúdanos a cuidar cada detalle.
            </p>

            <div className="event-details" aria-label="Detalles de la boda">
              <article>
                <CalendarDays aria-hidden="true" />
                <span>Fecha</span>
                <strong>Sábado, 12 de diciembre</strong>
              </article>
              <a
                className="event-detail-link"
                href="https://maps.app.goo.gl/tPpQBQbfoTQG6GW79"
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir ubicación de Llagar El Trole en Google Maps"
              >
                <MapPin aria-hidden="true" />
                <span>Lugar</span>
                <strong>Llagar El Trole</strong>
              </a>
            </div>

            <button className="photos-link" onClick={() => setPage("photos")}>
              <Camera aria-hidden="true" />
              Fotos de la boda
              <span>Próximamente</span>
            </button>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            className="rsvp-card"
            aria-labelledby="rsvp-title"
          >
            {status === "success" ? (
              <div className="success-state">
                <span className="success-icon">
                  <CheckCircle2 aria-hidden="true" />
                </span>
                <p className="eyebrow">Confirmación recibida</p>
                <h2 id="rsvp-title">Gracias, {form.nombre || "invitado/a"}</h2>
                <p>{message} Nos hace muchísima ilusión contar contigo.</p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setForm(initialForm);
                    setStatus("idle");
                    setMessage("");
                  }}
                >
                  Enviar otra respuesta
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rsvp-form">
                <div className="form-heading">
                  <Sparkles aria-hidden="true" />
                  <div>
                    <p className="eyebrow">Confirmación</p>
                    <h2 id="rsvp-title">¿Vienes a la boda?</h2>
                    <p>
                      Rellena este pequeño formulario para ayudarnos con la
                      organización.
                    </p>
                  </div>
                </div>

                <label className="field">
                  <span>Nombre completo</span>
                  <input
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Ej.: Ana García Pérez"
                    required
                  />
                </label>

                <fieldset className="attendance-group">
                  <legend>¿Asistirás?</legend>
                  <label className={form.asiste === "si" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="asiste"
                      value="si"
                      checked={form.asiste === "si"}
                      onChange={handleChange}
                    />
                    Sí, asistiré
                  </label>
                  <label className={form.asiste === "no" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="asiste"
                      value="no"
                      checked={form.asiste === "no"}
                      onChange={handleChange}
                    />
                    No podré asistir
                  </label>
                </fieldset>

                <fieldset className="bus-group">
                  <legend>
                    <Bus aria-hidden="true" />
                    ¿Necesitas bus?
                  </legend>

                  <label className={form.bus === "no" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="bus"
                      value="no"
                      checked={form.bus === "no"}
                      onChange={handleChange}
                    />
                    No necesito bus
                  </label>

                  <label className={form.bus === "ida" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="bus"
                      value="ida"
                      checked={form.bus === "ida"}
                      onChange={handleChange}
                    />
                    Solo para la ida
                  </label>

                  <label className={form.bus === "vuelta" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="bus"
                      value="vuelta"
                      checked={form.bus === "vuelta"}
                      onChange={handleChange}
                    />
                    Solo para la vuelta
                  </label>

                  <label className={form.bus === "ida_vuelta" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="bus"
                      value="ida_vuelta"
                      checked={form.bus === "ida_vuelta"}
                      onChange={handleChange}
                    />
                    Para la ida y la vuelta
                  </label>
                </fieldset>

                <label className="field">
                  <span>Alergias, intolerancias o dietas especiales</span>
                  <textarea
                    name="alergias"
                    value={form.alergias}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Ej.: Dieta vegetariana, alergia a los frutos secos, intolerancia a la lactosa..."
                  />
                </label>

                <label className="privacy-field">
                  <input
                    type="checkbox"
                    name="aceptaPrivacidad"
                    checked={form.aceptaPrivacidad}
                    onChange={handleChange}
                    required
                  />
                  <span>
                    Acepto que estos datos se usen únicamente para gestionar la
                    asistencia, el transporte y las necesidades alimentarias de
                    la boda.
                  </span>
                </label>

                {status === "error" && (
                  <p className="error-message" role="alert">
                    {message}
                  </p>
                )}

                <button className="submit-button" type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Guardando..." : "Enviar confirmación"}
                  <Send aria-hidden="true" />
                </button>
              </form>
            )}
          </motion.section>
        </div>
      </section>
    </main>
  );
}
