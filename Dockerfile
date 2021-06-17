FROM node:14-alpine

# define workdir
WORKDIR /usr/src/app

# copy package file and install
COPY package*.json .
RUN npm install && npm install typescript -g

# add source code
ADD . /usr/src/app

# typescript
RUN npm run build

# start app
ENTRYPOINT ["npm", "run"]
CMD ["start"]