import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Bus,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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

const initialPhotoForm = {
  file: null,
  authorName: "",
  caption: "",
};

const acceptedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const acceptedImageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const maxPhotoSize = 5 * 1024 * 1024;
const photosPerPage = 6;
const albumPassword = "pablomotos";

const isAcceptedImage = (file) =>
  acceptedImageTypes.includes(file.type) ||
  acceptedImageExtensions.some((extension) =>
    file.name.toLowerCase().endsWith(extension)
  );

const sanitizeFileName = (fileName) =>
  fileName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");

const compressImageBeforeUpload = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / image.width);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("No se ha podido preparar la imagen."));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#fbfff5";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se ha podido comprimir la imagen."));
            return;
          }

          const compressedName = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
          resolve(new File([blob], compressedName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.8
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          file.type === "image/heic" || file.type === "image/heif"
            ? "No hemos podido convertir esta foto de iPhone. Prueba a compartirla como JPG o cambia la cámara a 'Más compatible'."
            : "No se ha podido leer la imagen seleccionada."
        )
      );
    };

    image.src = objectUrl;
  });

export default function App() {
  const [page, setPage] = useState("home");
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoForm, setPhotoForm] = useState(initialPhotoForm);
  const [photoStatus, setPhotoStatus] = useState("idle");
  const [photoMessage, setPhotoMessage] = useState("");
  const [currentPhotoPage, setCurrentPhotoPage] = useState(1);
  const [albumAccessGranted, setAlbumAccessGranted] = useState(false);
  const [albumPasswordInput, setAlbumPasswordInput] = useState("");
  const [albumAccessError, setAlbumAccessError] = useState("");
  const galleryFileInputRef = useRef(null);
  const cameraFileInputRef = useRef(null);
  const isAttending = form.asiste === "si";
  const totalPhotoPages = Math.max(1, Math.ceil(photos.length / photosPerPage));
  const visiblePhotos = photos.slice(
    (currentPhotoPage - 1) * photosPerPage,
    currentPhotoPage * photosPerPage
  );
  const leftPagePhotos = visiblePhotos.slice(0, 3);
  const rightPagePhotos = visiblePhotos.slice(3, 6);
  const showAlbumPagination = photos.length > photosPerPage;

  const loadPhotos = async () => {
    setPhotoStatus("loading-gallery");
    setPhotoMessage("");

    const { data, error } = await supabase
      .from("fotos_boda")
      .select("id, image_url, file_path, caption, author_name, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando fotos:", error);
      setPhotoStatus("error");
      setPhotoMessage(
        "No hemos podido cargar el álbum. Inténtalo de nuevo en unos segundos."
      );
      return;
    }

    setPhotos(data ?? []);
    setCurrentPhotoPage(1);
    setPhotoStatus("idle");
  };

  useEffect(() => {
    if (page === "photos" && albumAccessGranted) {
      loadPhotos();
    }
  }, [page, albumAccessGranted]);

  const handleAlbumAccess = (event) => {
    event.preventDefault();

    if (albumPasswordInput.trim() !== albumPassword) {
      setAlbumAccessError("Contraseña incorrecta. El álbum permanecerá cerrado hasta el día de la boda.");
      return;
    }

    setAlbumAccessGranted(true);
    setAlbumAccessError("");
    setAlbumPasswordInput("");
  };

  const handlePhotoChange = (event) => {
    const { name, value, files } = event.target;
    setPhotoForm((prev) => ({
      ...prev,
      [name]: files ? files[0] ?? null : value,
    }));
    if (files) {
      setPhotoMessage("");
    }
  };

  const handlePhotoUpload = async (event) => {
    event.preventDefault();
    setPhotoStatus("uploading");
    setPhotoMessage("");

    try {
      const file = photoForm.file;

      if (!file) {
        throw new Error("Selecciona una foto antes de subirla.");
      }

      if (!isAcceptedImage(file)) {
        throw new Error("La foto debe ser JPG, PNG, WebP, HEIC o HEIF.");
      }

      if (file.size > maxPhotoSize) {
        throw new Error("La foto no puede superar los 5 MB.");
      }

      const compressedFile = await compressImageBeforeUpload(file);

      if (compressedFile.size > maxPhotoSize) {
        throw new Error("La foto sigue siendo demasiado grande tras comprimirla.");
      }

      const filePath = `${Date.now()}-${sanitizeFileName(compressedFile.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("wedding-photos")
        .upload(filePath, compressedFile, {
          contentType: compressedFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from("wedding-photos")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("fotos_boda").insert({
        image_url: publicData.publicUrl,
        file_path: filePath,
        caption: photoForm.caption.trim(),
        author_name: photoForm.authorName.trim(),
      });

      if (insertError) {
        throw insertError;
      }

      setPhotoForm(initialPhotoForm);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = "";
      }
      if (cameraFileInputRef.current) {
        cameraFileInputRef.current.value = "";
      }
      await loadPhotos();
      setPhotoStatus("success");
      setPhotoMessage("Recuerdo subido. Gracias por sumar otro momento al álbum.");
    } catch (error) {
      console.error("Error subiendo foto:", error);
      setPhotoStatus("error");
      setPhotoMessage(
        error.message || "No hemos podido subir la foto. Inténtalo de nuevo."
      );
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    if (name === "asiste" && value === "no") {
      setForm((prev) => ({
        ...prev,
        asiste: value,
        bus: "no",
        alergias: "",
        aceptaPrivacidad: false,
      }));
      return;
    }

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
      asiste: isAttending,
      bus: isAttending ? form.bus : "no",
      alergias: isAttending ? form.alergias.trim() : "",
      acepta_privacidad: isAttending,
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
    setMessage(
      isAttending
        ? "Tu respuesta se ha guardado correctamente."
        : "Tu respuesta se ha guardado correctamente. Te echaremos mucho de menos."
    );
  };

  if (page === "photos") {
    if (!albumAccessGranted) {
      return (
        <main className="wedding-page">
          <section className="coming-soon-section">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="coming-soon-card album-lock-card"
            >
              <span className="icon-bubble">
                <Camera aria-hidden="true" />
              </span>
              <p className="eyebrow">Álbum cerrado</p>
              <h1>Fotos de la boda</h1>
              <p>
                Este álbum permanecerá cerrado hasta el día de la boda. Cuando
                llegue el momento, podréis subir y ver todos los recuerdos.
              </p>

              <form className="album-lock-form" onSubmit={handleAlbumAccess}>
                <label className="field">
                  <span>Contraseña de acceso</span>
                  <input
                    type="password"
                    value={albumPasswordInput}
                    onChange={(event) => {
                      setAlbumPasswordInput(event.target.value);
                      setAlbumAccessError("");
                    }}
                    placeholder="Introduce la contraseña"
                  />
                </label>

                {albumAccessError && (
                  <p className="error-message" role="alert">
                    {albumAccessError}
                  </p>
                )}

                <button className="submit-button" type="submit">
                  Entrar al álbum
                </button>
              </form>

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
        <section className="photo-album-section">
          <div className="glow glow-rose" />
          <div className="glow glow-gold" />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="album-shell"
          >
            <header className="album-header">
              <div>
                <span className="album-stamp">
                  <Camera aria-hidden="true" />
                  Álbum de viaje
                </span>
                <p className="eyebrow">Fotos de la boda</p>
                <h1>Sube tu recuerdo de este día</h1>
                <p>
                  Ayúdanos a crear un álbum con los momentos vistos desde
                  vuestros ojos. Cada foto será una parada más en este viaje.
                </p>
              </div>

              <button className="secondary-button" onClick={() => setPage("home")}>
                Volver a la invitación
              </button>
            </header>

            <div className="album-layout">
              <section className="upload-card" aria-labelledby="upload-title">
                <div className="upload-card-heading">
                  <Sparkles aria-hidden="true" />
                  <div>
                    <p className="eyebrow">Nuevo recuerdo</p>
                    <h2 id="upload-title">Añade una foto</h2>
                  </div>
                </div>

                <form className="photo-upload-form" onSubmit={handlePhotoUpload}>
                  <div className="photo-picker" aria-label="Seleccionar foto">
                    <span>Foto</span>
                    <input
                      ref={galleryFileInputRef}
                      className="visually-hidden-file"
                      type="file"
                      name="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      onChange={handlePhotoChange}
                    />
                    <input
                      ref={cameraFileInputRef}
                      className="visually-hidden-file"
                      type="file"
                      name="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                    />
                    <div className="photo-picker-actions">
                      <button
                        className="photo-picker-button"
                        type="button"
                        onClick={() => galleryFileInputRef.current?.click()}
                      >
                        <Camera aria-hidden="true" />
                        Elegir de la galería
                      </button>
                      <button
                        className="photo-picker-button"
                        type="button"
                        onClick={() => cameraFileInputRef.current?.click()}
                      >
                        <Camera aria-hidden="true" />
                        Hacer una foto
                      </button>
                    </div>
                    <p>
                      {photoForm.file
                        ? `Seleccionada: ${photoForm.file.name}`
                        : "Puedes elegir una imagen guardada o abrir la cámara del móvil."}
                    </p>
                  </div>

                  <label className="field">
                    <span>Tu nombre</span>
                    <input
                      name="authorName"
                      value={photoForm.authorName}
                      onChange={handlePhotoChange}
                      placeholder="Ej.: Ana"
                    />
                  </label>

                  <label className="field">
                    <span>Pie de foto</span>
                    <textarea
                      name="caption"
                      value={photoForm.caption}
                      onChange={handlePhotoChange}
                      rows="3"
                      placeholder="Ej.: Primera parada del viaje de Sara y Enol..."
                    />
                  </label>

                  {photoMessage && photoStatus === "error" && (
                    <p className="error-message" role="alert">
                      {photoMessage}
                    </p>
                  )}

                  {photoMessage && photoStatus === "success" && (
                    <p className="photo-success-message">{photoMessage}</p>
                  )}

                  <button
                    className="submit-button"
                    type="submit"
                    disabled={photoStatus === "uploading"}
                  >
                    {photoStatus === "uploading" ? "Subiendo recuerdo..." : "Subir foto"}
                    <Send aria-hidden="true" />
                  </button>

                  <p className="photo-help-text">
                    Formatos admitidos: JPG, PNG, WebP, HEIC o HEIF. Tamaño máximo: 5 MB.
                  </p>
                </form>
              </section>

              <section className="album-board" aria-live="polite">
                <div className="album-board-heading">
                  <div>
                    <p className="eyebrow">Recuerdos compartidos</p>
                    <h2>Pasaporte de momentos</h2>
                  </div>
                  <span>{photos.length} fotos</span>
                </div>

                {photoStatus === "loading-gallery" && (
                  <p className="empty-album-state">Cargando recuerdos...</p>
                )}

                {photoStatus !== "loading-gallery" && photos.length === 0 && (
                  <div className="empty-album-state">
                    <Camera aria-hidden="true" />
                    <p>
                      Aún no hay recuerdos subidos. Sé la primera persona en
                      añadir uno.
                    </p>
                  </div>
                )}

                {visiblePhotos.length > 0 && (
                  <div className="album-book-wrap">
                    {showAlbumPagination && (
                      <button
                        className="album-nav-button album-nav-prev"
                        type="button"
                        disabled={currentPhotoPage === 1}
                        onClick={() =>
                          setCurrentPhotoPage((prev) => Math.max(1, prev - 1))
                        }
                        aria-label="Página anterior"
                      >
                        <ChevronLeft aria-hidden="true" />
                      </button>
                    )}

                    <div className="album-book">
                      {[leftPagePhotos, rightPagePhotos].map((pagePhotos, pageIndex) => (
                        <div className="album-page" key={pageIndex === 0 ? "left" : "right"}>
                          {pagePhotos.map((photo, index) => {
                            const author = photo.author_name?.trim() || "Invitado/a";
                            const caption = photo.caption?.trim();
                            const globalIndex = pageIndex * 3 + index;
                            const altText = caption
                              ? `${caption}. Foto subida por ${author}`
                              : `Foto de la boda subida por ${author}`;

                            return (
                              <article
                                className="polaroid-card"
                                key={photo.id ?? photo.file_path}
                              >
                                <img
                                  className="polaroid-image"
                                  src={photo.image_url}
                                  alt={altText}
                                  loading={globalIndex < 2 ? "eager" : "lazy"}
                                />
                                <div className="polaroid-caption">
                                  <p>{caption || "Un recuerdo sin palabras."}</p>
                                  <span>Por {author}</span>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    {showAlbumPagination && (
                      <button
                        className="album-nav-button album-nav-next"
                        type="button"
                        disabled={currentPhotoPage === totalPhotoPages}
                        onClick={() =>
                          setCurrentPhotoPage((prev) =>
                            Math.min(totalPhotoPages, prev + 1)
                          )
                        }
                        aria-label="Página siguiente"
                      >
                        <ChevronRight aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {showAlbumPagination && (
                  <nav className="album-pagination" aria-label="Paginación del álbum">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={currentPhotoPage === 1}
                      onClick={() =>
                        setCurrentPhotoPage((prev) => Math.max(1, prev - 1))
                      }
                    >
                      Página anterior
                    </button>
                    <span>
                      Página {currentPhotoPage} de {totalPhotoPages}
                    </span>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={currentPhotoPage === totalPhotoPages}
                      onClick={() =>
                        setCurrentPhotoPage((prev) =>
                          Math.min(totalPhotoPages, prev + 1)
                        )
                      }
                    >
                      Página siguiente
                    </button>
                  </nav>
                )}
              </section>
            </div>
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
              <span>Álbum</span>
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
                <p>
                  {message}{" "}
                  {isAttending && "Nos hace muchísima ilusión contar contigo."}
                </p>
                {!isAttending && (
                  <div className="farewell-video">
                    <iframe
                      src="https://www.youtube.com/embed/bl_Jy7Q7l7s"
                      title="Vídeo triste de despedida"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                )}
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

                <fieldset
                  className={`bus-group ${!isAttending ? "disabled-group" : ""}`}
                  disabled={!isAttending}
                >
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

                <label className={`field ${!isAttending ? "disabled-field" : ""}`}>
                  <span>Alergias, intolerancias o dietas especiales</span>
                  <textarea
                    name="alergias"
                    value={form.alergias}
                    onChange={handleChange}
                    disabled={!isAttending}
                    rows="4"
                    placeholder="Ej.: Dieta vegetariana, alergia a los frutos secos, intolerancia a la lactosa..."
                  />
                </label>

                <label className={`privacy-field ${!isAttending ? "disabled-field" : ""}`}>
                  <input
                    type="checkbox"
                    name="aceptaPrivacidad"
                    checked={form.aceptaPrivacidad}
                    onChange={handleChange}
                    disabled={!isAttending}
                    required={isAttending}
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
