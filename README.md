Common device interconnect framework (CDIF) attempts to create an interconnect solution for Smart Home and IoT devices.

CDIF takes the assumption that gateway devices would be the central control hub for all Smart Home devices. Gateways have richer I/O and network protocol support, persistent storage, more computing resource for data processings and many other benefits. The design of CDIF assumes it runs on a gateway device, connecting to different kinds of devices, whether they are Bluetooth, ZWave, ZigBee, or IP based, and provide a set of uniformed device management APIs to its clients.

To take advantage of rich set of standard-based web technology and powerful Node.js ecosystem, CDIF is written in Node.js and exports a set of clean RESTful APIs for device management purpose. The design of CDIF notices that interoperability is still a very common issue in current Smart Home and IoT industry and the fragmentations caused by different standards, wall-gardened, or non-standard solutions basically prevents this industry grow further. To address this, CDIF design tries to implement support to popular open standards such as Bluetooth LE, ZWave and etc. and provide a set of common management APIs for all of them.

To achieve this, CDIF design is inspired by UPnP and try to define a common device model for all kinds of Smart Home and IoT devices. UPnP has a well defined, hybrid device model with pluggable and interchangable services oriented architecture (SOA), which made it look like a good candidate for a common IoT device model. To better working with popular web technologies, CDIF design converts the original UPnP device model in XML representation into JSON objects, and also extends it to better compat with open standards such as ONVIF etc. Open standards, such as GATT profile in Bluetooth LE and ONVIF and etc. also has this SOA based device model thus makes this mapping more natural. Upon device and service discovery process, this JSON device model is sent to client side through RESTful interface, therefore clients such as web apps would know how to represent and operate the device in client side. By doing this, CDIF presents client side a top level device abstraction and application profile for all connected devices.

At the lower level, CDIF provides a set of uniformed internal APIs to group different types of devices into modules. Each module can manage 1 or more devices in same category, such as Bluetooth LE, ZWave and etc. Although in this design, vendor's non-standard, private module implementations may also be plugged-in and present to client side this JSON based device model, vendors may prefer follow open IoT standards as much as possible. 

Summary of the framework RESTful API interface:

*1. discover all
POST http://localhost:3049/discover
request body: {timeout: 5000ms}
response: 200 OK


*2. stop all discoveries
POST http://localhost:3049/stop-discover
request body: empty
response: 200 OK

***3. discover (refresh after reboot) a single device:
POST http://localhost:3049/device-control/<deviceID>/discover
request body: empty
response: 200 OK / 404 not found / 401 unauthrized / 408 timeout

*4. connect a single device:
POST http://localhost:3049/device-control/<deviceID>/connect
(optional) request body:
{ username: <name>,
  password: <pass>
}
response: 200 OK / 404 not found / 401 unauthrized / 408 timeout
response body: JWT token
if userAuth is true then generate per-device JWT auth token used by *** routes

***5. disconnect a single device:
POST http://localhost:3049/device-control/<deviceID>/disconnect
response: 200 OK / 404 not found / 401 unauthrized / 408 timeout

*6.retrieve spec of a single device:
GET http://localhost:3049/device-control/<deviceID>/get-spec
response: 200 OK / 404 not found / 401 unauthrized / 408 timeout
response body: JSON format of the device spec

***7. device control
POST http://localhost:3049/device-control/<deviceID>/invoke-action
request boy:
{
  serviceId: <id>,
  actionName: <name>,
  argumentList: {
    <arg1 name>: <value>,
    <arg2 name>: <value>
}
response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error, or action specific error code
body:
{
  <stateVar 1 name>: <value>,
  <stateVar 2 name>: <value>
}

***8. event subscription
POST http://localhost:3049/device-control/<deviceID>/event-sub
request body:
{
  serviceId: <id>
}
response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error

***8. event unSubscription
POST http://localhost:3049/device-control/<deviceID>/event-cancel
request body:
{
  serviceId: <id>
}
response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error

*9. get device list
retrieve uuid of all discovered devices
GET http://localhost:3049/device-list
request body: empty
response:
[uuid1, uuid2]
200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error



routes marked with * are protected by session
routes marked with *** are per-device JWT auth protected if device userAuth flag is true
