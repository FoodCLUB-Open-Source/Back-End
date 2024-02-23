FROM node:18-alpine

WORKDIR /app

COPY package*.json .
COPY .npmrc .

# Install Doppler CLI
RUN wget -q -t3 'https://packages.doppler.com/public/cli/rsa.8004D9FF50437357.key' -O /etc/apk/keys/cli@doppler-8004D9FF50437357.rsa.pub && \
    echo 'https://packages.doppler.com/public/cli/alpine/any-version/main' | tee -a /etc/apk/repositories && \
    apk add doppler

# Set FoodCLUB Paackages token as environment variable
ARG FOODCLUB_PACKAGES_TOKEN
ENV FOODCLUB_PACKAGES_TOKEN=$FOODCLUB_PACKAGES_TOKEN
RUN echo ${FOODCLUB_PACKAGES_TOKEN}

RUN npm install

COPY . .

EXPOSE 3000

CMD ["doppler", "run", "--", "node", "src/server.js"]