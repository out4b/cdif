Common device interconnect framework
------------

Common device interconnect framework (CDIF) is an attempt to provide an interconnect solution for Smart Home and IoT devices.

CDIF takes the assumption that gateway devices would be the central control hub for all Smart Home and IoT devices. Compared to the solution to directly control IoT devices with mobile devices, gateways have richer network I/O and protocol support, persistent connectivity and storage support, more computing resource for data processings and many other benefits. CDIF assumes itself runs on gateway, connecting to smart home and IoT devices, whether they are based on Bluetooth, ZWave, ZigBee, or IP networking protocols. After devices are discovered and connected, CDIF provide a simple set of common device management APIs to all authenticated clients to control these devices and receive event updates from them.

To take advantage of rich set of standard-based web technology and powerful Node.js ecosystem, CDIF is written in Node.js and exports a set of clean RESTful APIs for smart home and IoT devices. The design of CDIF notices that interoperability is still a very common issue in current Smart Home and IoT industry and the fragmentations caused by different standards, wall-gardened, or non-standard solutions prevents this industry grow further. To help address this, CDIF design tries to implement support to popular open connectivity standards (such as Bluetooth LE, ZWave, ONVIF, UPnP  and etc.) within a common device management interface and unified device model to describe each of them.

To achieve this, CDIF design is inspired by UPnP and try to define a common device model for different kinds of smart home and IoT devices. UPnP has a well defined, hybrid device model with interchangable services describing a device's capabilities. This made it look like a good start point for a common IoT device model. The application level of device profile of other popluar open connectivity standards, such as Bluetooth LE, ZWave, ONVIF etc also can be well mapped to this service oriented architecture. To better working with web technologies, CDIF translates the original UPnP device model in XML representation into JSON objects, and also extends it to better compat with the current state-of-art technologies.

Upon device discovery process, this JSON based device model is sent to client side through CDIF's RESTful interface, thus clients web apps would know how to send action commands, get latest device states. By doing this, CDIF presents client side a top level device abstraction and application profile for all connected devices. For more information about this JSON based device model, please refer to spec/ folder in the source repository.

At the lower level, CDIF provides a set of uniformed APIs to group different types of devices into modules. Each module can manage one or more devices in same category, such as Bluetooth LE, ZWave, UPnP and etc. Although in this design, vendor's non-standard, proprietary implementations may also be plugged-in and present to client side this JSON based device model, to ensure interoperability, proprietary implementation are encouraged to follow open IoT connectivity standards as much as possible.

How to run
----------
    cd cdif
    npm install
    NODE_PATH=./lib node ./framework.js

It may require root privilege to access Bluetooth interface

Summary of framework API interface:
-----------------------------------

##### Discover all devices
This API is used to start the discovery process for all modules

    POST http://localhost:3049/discover
    response: 200 OK

##### Stop all discoveries
This API is used to stop all discovery process

    POST http://localhost:3049/stop-discover
    response: 200 OK

##### Get device list
Retrieve uuid of all discovered devices

    GET http://localhost:3049/device-list
    request body: empty
    response:
    [device-uuid1, device-uuid2]
    200 OK

##### Connect to device:
Connect to a single device, optionally if a device requires auth, user / pass pair is contained in the request body in JSON format

    POST http://localhost:3049/device-control/<deviceID>/connect
    (optional) request body:
    { username: <name>,
      password: <pass>
    }
    response: 200 OK / 404 not found / 401 unauthrized

##### Disconnect device:
Disconnect a single device

    POST http://localhost:3049/device-control/<deviceID>/disconnect
    response: 200 OK / 404 not found / 401 unauthrized

##### Get spec of a single device:
Retrieve the spec of a single device

    GET http://localhost:3049/device-control/<deviceID>/get-spec
    response: 200 OK / 404 not found / 401 unauthrized
    response body: JSON format of the device spec

##### Device control
Invoke a device control action

    POST http://localhost:3049/device-control/<deviceID>/invoke-action
    request boy:
    {
      serviceId: <id>,
      actionName: <name>,
      argumentList: {
        <arg1 name>: <value>,
        <arg2 name>: <value>
    }
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error
    response body:
    {
      <arg1 name>: <value>,
      <arg2 name>: <value>
    }
    Argument names must conform to the device spec that sent to client

##### Eventing
CDIF implemented a simple socket.io based server and supports subscribe and receive device event updates from devices. The subscription is service based which means clients have to subscribe to a specific service ID and if any of the variable state are updated, e.g. a sensor value change, or a light bulb is switched on / off, client would receive event updates from CDIF. Please refer to test/socket.html for a very simple use case on this.

### Acknowlegement
Many thanks to great work contributed by following repositories that made this framework implementation possible:

* Sandeep Mistry's [noble-device](https://github.com/sandeepmistry/noble-device), [yeelight-blue](https://github.com/sandeepmistry/node-yeelight-blue), and [sensortag](https://github.com/sandeepmistry/node-sensortag)
