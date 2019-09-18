#!/bin/sh
while true; do
	curl -H "Content-Type: application/json" -X POST -d '{"serviceID":"urn:qunar-com:serviceID:车站搜索","actionName":"车站搜索","argumentList":{"input":{"station": "漯河"}}}' http://localhost:3049/device-control/f50e8254-c766-419c-af23-80e6eed1823b/invoke-action &
	sleep 1
done

#curl -H "Content-Type: application/json" -X POST -d '{"registry":"http://121.43.107.95:5984/", "name":"cdif-qunar-train-service", "version":"0.0.5"}' http://121.43.107.95:3049/module-install
