# Tama Beauty · Gestión personal

App web ligera (HTML + CSS + JavaScript, sin dependencias) para gestionar productos y entregas de tu emprendimiento. Responsive: en móvil la tabla de productos se convierte en tarjetas.

## Estructura
```
index.html        Interfaz
css/styles.css    Estilos (paleta del logo)
js/app.js         Lógica, comentada
assets/           logo.png y favicon.png
.gitignore        Evita subir respaldos con datos reales
```

## ¿Por qué localStorage y no Flask/SQLite?
Es uso personal de una sola persona: sin servidor no hay costos, ni claves expuestas, y se aloja gratis en GitHub Pages. Los datos quedan en el navegador (perfil, productos con imágenes reducidas, entregas) y sobreviven al cerrar y volver a abrir. Limitación: ~5 MB, y cada dispositivo/navegador tiene sus propios datos → **usa el respaldo JSON** para pasarlos entre celular y computador. Si luego necesitas varios dispositivos sincronizados, ahí sí conviene FastAPI + SQLite.

## Ejecutar
- Local: `python -m http.server 8000` dentro de la carpeta y abre http://localhost:8000
- GitHub Pages: sube el repo → Settings → Pages → rama `main`, carpeta `/ (root)`.

## Seguridad (importante)
- La clave se guarda como hash SHA-256 con sal, no en texto plano. Es una barrera local contra curiosos, **no** seguridad de servidor: quien tenga acceso a tu navegador puede leer los datos.
- Al ser un sitio público en GitHub Pages, el código es visible pero **tus datos no**, porque están solo en tu navegador. Nunca escribas claves ni datos reales dentro del código.
- No subas los archivos `respaldo-*.json` ni CSV (están en `.gitignore`).
- Usa un repo privado si no quieres que el código sea público.

## Respaldo
Perfil → "Descargar respaldo (JSON)" cada semana o tras muchos cambios. "Importar respaldo" restaura todo. Productos → "Exportar CSV" abre en Excel.
