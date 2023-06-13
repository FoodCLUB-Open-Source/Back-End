# FoodCLUB Backend

## Example `.env`

```
NODE_ENV = local

IP = http://localhost
PORT = 3000
SOCKET_ADDRESS = ${IP}:${PORT}

BASE_PATH = /api/v1
BASE_URL = ${SOCKET_ADDRESS}${BASE_PATH}
```