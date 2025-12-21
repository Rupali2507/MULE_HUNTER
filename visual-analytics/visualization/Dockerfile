FROM node:18-alpine AS build
WORKDIR /app

# Use ./ because package.json is in the same folder as this Dockerfile
COPY package*.json ./
RUN npm install

COPY . .
# No need to change WORKDIR if you are already in the right place
RUN npm run build

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy from the 'dist' folder that was just created in /app
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]