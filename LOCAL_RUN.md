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

# Deploy contract(s)

cd onchain/
scarb build

cd ztarknet/js-scripts/
npm run declare -- \
    --sierra ../../onchain/target/dev/art_peace_MultiCanvas.contract_class.json \
    --casm ../../onchain/target/dev/art_peace_MultiCanvas.compiled_contract_class.json

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
    pub host: ContractAddress,     // 0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d
    pub name: felt252,             // Use Below Command
    pub unique_name: felt252,      // Use name ( make sure correct format )
    pub width: u128,               // World 0: 528  Else: 256
    pub height: u128,              // World 0: 396  Else: 192
    pub pixels_per_time: u32,      // 5
    pub time_between_pixels: u64,  // 5
    pub color_palette: Span<u32>,  // Length + colors : 15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6
    pub start_time: u64,           // 1763005104
    pub end_time: u64,             // 2084417924
}
name: echo -n "Canvas0" | xxd -p | sed 's/^/0x/'
uniquename: echo -n "Canvas0" | tr '[:upper:]' '[:lower:]' | xxd -p | sed 's/^/0x/'
Default colors: "FAFAFA","080808","BA2112","FF403D","FF7714","FFD115","F5FF05","199F27","00EF3F","152665","1542FF","5CFFFE","A13DFF","FF7AD7","C1D9E6"

## Create canvases

Canvas0:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617330,0x63616e76617330,528,396,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas1:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617331,0x63616e76617331,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas2:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617332,0x63616e76617332,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas3:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617333,0x63616e76617333,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas4:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617334,0x63616e76617334,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas5:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617335,0x63616e76617335,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas6:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617336,0x63616e76617336,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas7:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617337,0x63616e76617337,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas8:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617338,0x63616e76617338,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas9:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e76617339,0x63616e76617339,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas10:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e7661733130,0x63616e7661733130,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas11:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e7661733131,0x63616e7661733131,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"

Canvas12:
npm run invoke -- \
    --contract 0x6134ff80eb863e2407678435b90d9579c5cc21ce828fe5ebeb7c004046134e4 \
    --function create_canvas \
    --calldata "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d,0x43616e7661733132,0x63616e7661733132,256,192,5,5,15,0xFAFAFA,0x080808,0xBA2112,0xFF403D,0xFF7714,0xFFD115,0xF5FF05,0x199F27,0x00EF3F,0x152665,0x1542FF,0x5CFFFE,0xA13DFF,0xFF7AD7,0xC1D9E6,1763005104,2084417924"


# Start FE

cd frontend-next
setup .env:
  NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
  NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8083
  
  NEXT_PUBLIC_DEV_MODE=false
  NEXT_PUBLIC_UPLOAD_ENABLED=true
  
  NEXT_PUBLIC_BASE_WORLD_ID=0
npm run dev
