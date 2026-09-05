# Base image resmi dari tim Puppeteer — sudah bawa Chromium + semua shared
# library pendukungnya (libnspr4, libnss3, dkk), jadi menghindari seluruh
# masalah "shared library not found" / crashpad_handler yang muncul kalau
# install Chromium manual di server minim seperti aaPanel/VPS kosongan.
# Pakai tag `latest` (rilis stabil resmi mereka) daripada versi pin manual.
FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

# Image ini defaultnya jalan sebagai user non-root `pptruser` (bukan root),
# jadi folder app perlu dimiliki user itu supaya Node bisa baca/tulis di
# dalamnya (mis. saat render PDF butuh tulis ke /tmp).
RUN chown -R pptruser:pptruser /app
USER pptruser

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
