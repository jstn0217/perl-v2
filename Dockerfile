FROM node:22-alpine

WORKDIR /app

COPY perl-api/package*.json ./perl-api/
COPY perl-rfid-frontend/package*.json ./perl-rfid-frontend/

RUN cd perl-api && npm install
RUN cd perl-rfid-frontend && npm install

COPY . .

RUN chown -R node:node /app

USER node

EXPOSE 4000 5173

CMD ["sh", "./scripts/docker-start.sh"]
