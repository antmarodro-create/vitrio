# Subir Vitrio a GitHub

El ZIP adjunto **ya contiene un repositorio git con el primer commit hecho**. No hace falta
`git init` ni `git add`: solo conectar y empujar.

- Rama: `main` · 1 commit · 102 archivos
- No incluye `.env` (tus claves) ni `node_modules` ni `.next`
- Sí incluye `drizzle/meta`, necesario para las migraciones

---

## Opción A — Con GitHub Desktop (sin terminal)

1. Descarga y descomprime el ZIP. Verás la carpeta `vitrio/` con una subcarpeta oculta `.git`.
2. Abre **GitHub Desktop** → *File → Add local repository* → elige la carpeta `vitrio`.
3. Arriba aparecerá **Publish repository**. Desmarca *Keep this code private* solo si quieres
   el repositorio público (recomendado: **privado**).
4. *Publish*. Ya está subido.

## Opción B — Con terminal

```bash
cd vitrio

# crea antes el repositorio vacío en github.com/new (sin README, sin .gitignore)
git remote add origin https://github.com/TU-USUARIO/vitrio.git
git push -u origin main
```

Si te pide identidad:

```bash
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

## Opción C — Solo con el navegador (sin git)

En github.com/new crea el repositorio vacío y luego arrastra **el contenido** de la carpeta
`vitrio` (no la carpeta) a la página del repo con *Add file → Upload files*.

Avisos: el navegador sube **máximo 100 archivos por vez** (el proyecto tiene 102, así que
tendrás que hacerlo en dos tandas) y **no conserva el historial** de git. La opción A o B es
mejor; usa esta solo si no puedes instalar nada.

---

## Después de subirlo

1. En Netlify: *Add new site → Import an existing project → GitHub* → elige el repo.
2. Netlify leerá `netlify.toml` solo: build `npm run build`, Node 22, plugin de Next.js.
3. Añade las variables de entorno (ver `NETLIFY.md` §3) y pulsa *Deploy*.
4. A partir de ahí, cada `git push` a `main` despliega automáticamente.

> **Nunca subas `.env`.** Está en `.gitignore`. Si alguna vez lo comiteas por error, rota las
> claves: las de Stripe y la contraseña de la base de datos.
