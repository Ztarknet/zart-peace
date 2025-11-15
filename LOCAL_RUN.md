# Start Redis
redis-server

redis-cli
DEL apibara:sink:canvas-worlds-indexer
DEL canvas

# Create PostgreSQL database
createdb art-peace-db
psql -d art-peace-db -f postgres/init.sql

dropdb art-peace-db

# Start madara node
cd /Users/brandonroberts/workspace/keep-starknet-strange/ztarknet/testing/
make start

make clean-all

# Start apibara

Local Madara Devnet:
docker run -p 7171:7171 \
  -e XDG_DATA_HOME=/data \
  -v apibara-data:/data \
  quay.io/apibara/starknet:1.5.0 \
  start \
  --rpc=http://host.docker.internal:9944/rpc \
  --name=ztarknet \
  --head-refresh-interval-ms=1000 \
  --wait-for-rpc \
  --address=0.0.0.0:7171

Ztarknet testnet:
docker run -p 7171:7171 \
  -e XDG_DATA_HOME=/data \
  -v apibara-data:/data \
  quay.io/apibara/starknet:1.7.2 \
  start \
  --rpc=https://ztarknet-madara.d.karnot.xyz/rpc \
  --name=ztarknet \
  --head-refresh-interval-ms=1000 \
  --wait-for-rpc \
  --address=0.0.0.0:7171

# Deploy contract(s)

cd onchain/
scarb build

cd ztarknet/testing/js-scripts/
npm run declare -- \
    --sierra /Users/brandonroberts/workspace/keep-starknet-strange/ztarknet/zart-peace/onchain/target/dev/art_peace_MultiCanvas.contract_class.json \
    --casm /Users/brandonroberts/workspace/keep-starknet-strange/ztarknet/zart-peace/onchain/target/dev/art_peace_MultiCanvas.compiled_contract_class.json

npm run deploy -- --class-hash <classhash> --calldata 0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d

# Start BE services

## Backend

cd backend
export POSTGRES_PASSWORD=password
go run cmd/backend/backend.go \
    -canvas-config=../configs/canvas.config.json \
    -database-config=../configs/database.config.json \
    -backend-config=../configs/backend.config.json \
    -rounds-config=../configs/rounds.config.json \
    -admin

## Websockets

cd backend
export POSTGRES_PASSWORD=password
go run cmd/web-sockets/web-sockets.go \
    -canvas-config=../configs/canvas.config.json \
    -database-config=../configs/database.config.json \
    -backend-config=../configs/backend.config.json \
    -rounds-config=../configs/rounds.config.json

## Consumer

cd backend
export POSTGRES_PASSWORD=password
go run cmd/consumer/consumer.go \
    -canvas-config=../configs/canvas.config.json \
    -database-config=../configs/database.config.json \
    -backend-config=../configs/backend.config.json \
    -rounds-config=../configs/rounds.config.json

# Setup DBs

curl http://localhost:8080/set-factory-contract-address -X POST -d "0x<your-deployed-address>"

# Start indexer

cd indexer
edit indexer.env:
  CANVAS_FACTORY_CONTRACT_ADDRESS=<YOUR_DEPLOYED_CONTRACT_ADDRESS>
  APIBARA_STREAM_URL=http://localhost:7171
  CONSUMER_TARGET_URL=http://localhost:8081/consume-indexer-msg
  PERSIST_TO_REDIS=redis://localhost:6379
  INDEXER_ID=canvas-worlds-indexer-id
apibara run worlds-script.js \
    --allow-env indexer.env \
    --sink-id canvas-worlds-indexer \
    --persist-to-redis redis://localhost:6379

# Setup contract(s)

pub struct CanvasInitParams {
    pub host: ContractAddress,     // 0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6
    pub name: felt252,             // Use Below Command
    pub unique_name: felt252,      // Use name ( make sure correct format )
    pub width: u128,               // World 0: 528  Else: 256
    pub height: u128,              // World 0: 396  Else: 192
    pub pixels_per_time: u32,      // 5
    pub time_between_pixels: u64,  // 5
    pub color_palette: Span<u32>,  // Length + colors : 15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6
    pub start_time: u64,           // 1763005104
    pub end_time: u64,             // 2084417924
}
name: echo -n "Canvas0" | xxd -p | sed 's/^/0x/'
uniquename: echo -n "Canvas0" | tr '[:upper:]' '[:lower:]' | xxd -p | sed 's/^/0x/'
Default colors: "080808","FAFAFA","BA2112","FF403D","FF7714","FFD115","F5FF05","199F27","00EF3F","152665","1542FF","5CFFFE","A13DFF","FF7AD7","C1D9E6"

## Create canvases

zart/peace: zart-peace
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x7a6172742f7065616365,0x7a6172742d7065616365,528,396,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Privacy SZN: privacy-szn
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x5072697661637920535a4e,0x707269766163792d737a6e,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

ZEC Maxi: zec-maxi
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x5a4543204d617869,0x7a65632d6d617869,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Ztarknet Brother: ztarknet-brother
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x5a7461726b6e65742042726f74686572,0x7a7461726b6e65742d62726f74686572,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

ZK Corner: zk-corner
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x5a4b20436f726e6572,0x7a6b2d636f726e6572,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Schizodio: schizodio
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x536368697a6f64696f,0x736368697a6f64696f,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Zypherpunks: zypherpunks
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x5a797068657270756e6b73,0x7a797068657270756e6b73,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Hackerz: hackerz
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x4861636b65727a,0x6861636b65727a,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Memez: memez
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x4d656d657a,0x6d656d657a,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

BTC Corner: btc-corner
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x42544320436f726e6572,0x6274632d636f726e6572,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

ZTARKNEAR: ztarknear
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x5a5441524b4e454152,0x7a7461726b6e656172,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Just Shield It: just-shield-it
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x4a75737420536869656c64204974,0x6a7573742d736869656c642d6974,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

DeFi Zone: defi-zone
npm run invoke -- \
    --contract 0x55ec4d807783d022257dbe19c68a63e9384decca03bbe2c0c0dfb2fcea8becd \
    --function create_canvas \
    --calldata "0x58b5937b637279a5094f3d40ad5ff55d24d3f66e0ef9de6cfaccf1d2a87abc6,0x44654669205a6f6e65,0x646566692d7a6f6e65,256,192,5,5,15,0x080808,0xFAFAFA,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"


# Start FE

cd frontend-next
setup .env:
  NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
  NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8083
  
  NEXT_PUBLIC_DEV_MODE=false
  NEXT_PUBLIC_UPLOAD_ENABLED=true
  
  NEXT_PUBLIC_BASE_WORLD_ID=0
npm run dev
