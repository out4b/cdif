Introduction
------------

Common device interconnect framework (CDIF) attempts to provide an interconnect solution for Smart Home and IoT devices.

CDIF takes the assumption that gateway devices would be the central control hub for all Smart Home devices. Gateways have richer network I/O and protocol support, persistent storage, more computing resource for data processings and many other benefits. CDIF assumes itself runs on a smart home gateway, connecting to different kinds of devices, whether they are linked with Bluetooth, ZWave, ZigBee, or IP networking protocols, and provide a set of uniformed device management APIs to its clients.

To take advantage of rich set of standard-based web technology and powerful Node.js ecosystem, CDIF is written in Node.js and exports a set of clean RESTful APIs for device management purpose. The design of CDIF notices that interoperability is still a very common issue in current Smart Home and IoT industry and the fragmentations caused by different standards, wall-gardened, or non-standard solutions basically prevents this industry grow further. To address this, CDIF design tries to implement support to popular open connectivity standards such as Bluetooth LE, ZWave, ZigBee and etc. and provide a set of common access APIs for all of them.

To achieve this, CDIF design is inspired by UPnP and try to define a common device model for all kinds of IoT devices. UPnP has a well defined, hybrid device model with pluggable services oriented architecture (SOA), which made it look like a good candidate for a common IoT device model. To better working with popular web technologies, CDIF design translates the original UPnP device model in XML representation into JSON objects, and also extends it to better compat with open standards such as ONVIF etc. Open standards, such as GATT profile in Bluetooth LE and ONVIF and etc. also has this SOA based device model thus makes this translation more straightforward. Upon device and service discovery process, this JSON device model is sent to client side through RESTful interface, therefore clients such as web apps would know how to represent and operate the device in client side. By doing this, CDIF presents client side a top level device abstraction and application profile for all connected devices. For more information about this JSON based device model, please refer to spec/ folder in the source repository.

At the lower level, CDIF provides a set of uniformed APIs to group different types of devices into modules. Each module can manage 1 or more devices in same category, such as Bluetooth LE, ZWave and etc. Although in this design, vendor's non-standard, private module implementations may also be plugged-in and present to client side this JSON based device model, however to ensure interoperability between devices manufactured by different vendors, vendors' proprietary module implementation are encouraged to follow open IoT standards as much as possible.

Summary of framework API interface:
-----------------------------------

####1. discover all devices
This API is used to start discovery all devices that can be discovered by the gateway

    POST http://localhost:3049/discover
    response: 200 OK
    
####2. stop all discoveries
This API is used to stop all discovery process

    POST http://localhost:3049/stop-discover
    response: 200 OK

####3. get device list
Retrieve uuid of all discovered devices

    GET http://localhost:3049/device-list
    request body: empty
    response:
    [uuid1, uuid2]
    200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error

####4. discover a single device:
Discover the device indexed by its deviceID, this is usually useful after device reboot

    POST http://localhost:3049/device-control/<deviceID>/discover
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout
    
####5. connect to device:
Connect to a single device, optionally if a device requires auth, user / pass pair is contained in the request body

    POST http://localhost:3049/device-control/<deviceID>/connect
    (optional) request body:
    { username: <name>,
      password: <pass>
    }
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout
    response body: JWT token
    if userAuth is true then generate per-device JWT auth token used by *** routes

####6. disconnect a single device:
Disconnect a single device

    POST http://localhost:3049/device-control/<deviceID>/disconnect
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout

####7.retrieve spec of a single device:
Retrieve the spec of a single device

    GET http://localhost:3049/device-control/<deviceID>/get-spec
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout
    response body: JSON format of the device spec
    
####8. device control
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
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error, or action specific error code
    body:
    {
      <stateVar 1 name>: <value>,
      <stateVar 2 name>: <value>
    }

####9. event subscription
Subscribe to a device event

    POST http://localhost:3049/device-control/<deviceID>/event-sub
    request body:
    {
      address: <subscriber address>
      serviceId: <id>
    }
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error

####10. event unSubscription
Unsubscribe a device event

    POST http://localhost:3049/device-control/<deviceID>/event-cancel
    request body:
    {
      address: <subscriber address>
      serviceId: <id>
    }
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error

###Acknowlegement###
Many thanks to great work contributed by following repositories that made this implementation possible:
