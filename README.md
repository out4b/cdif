Common device interconnect framework
------------

Common device interconnect framework (CDIF) is an attempt to provide an interconnect solution for Smart Home and IoT devices.

CDIF takes the assumption that gateway devices would be the central control hub for all Smart Home and IoT devices. Compared to the solution to directly control IoT devices with mobile devices, gateways have richer network I/O and protocol support, persistent connectivity and storage, more computing resource for data processings, and many other benefits. CDIF assumes itself runs on gateway, connecting to smart home and IoT devices, whether they are based on Bluetooth, ZWave, ZigBee, or IP networking protocols. After devices are discovered and connected, CDIF provide a simple set of common device management APIs to all authenticated clients to control these devices and receive event updates from them.

To take advantage of rich set of standard-based web technology and powerful Node.js ecosystem, CDIF is written in Node.js and exports a set of clean RESTful APIs for smart home and IoT devices. CDIF design tries to implement support to popular open connectivity standards, such as Bluetooth LE, ZWave, ONVIF, UPnP  and etc. within a common device management interface and unified device model to describe every one of them.

To achieve this, CDIF design is inspired by UPnP and try to define a common device model for different kinds of smart home and IoT devices. UPnP has a well defined, hybrid device model with interchangable services describing a device's capabilities. This made it look like a good start point for a common IoT device model. The application level of device profile of other popluar open connectivity standards, such as Bluetooth LE, ZWave, ONVIF etc. also can be mapped to this service oriented architecture. An example of mapping from Bluetooth LE GATT profile to CDIF's common device model can be found at [CDIF BLE manager module](https://github.com/out4b/cdif-ble-manager).

Upon device discovery process, this JSON based device model is sent to client side through CDIF's RESTful interface, thus clients web apps would know how to send action commands, get latest device states event update. By doing this, CDIF presents client side a top level device abstraction and application profile for all devices connected to a gateway. For more information about this JSON based device model, please refer to spec/ folder in the source repository.

At the lower level, CDIF provides a set of uniformed APIs to group different types of devices into modules. Each module can manage one or more devices in same category, such as Bluetooth LE, ZWave, UPnP and etc. Although in this design, vendor's non-standard, proprietary implementations may also be plugged-in and present to client side this JSON based device model, to ensure interoperability, proprietary implementation are encouraged to follow open IoT connectivity standards as much as possible.

##### CDIF's common device model in summary
    {
      "configId": 1,
      "specVersion": {
        "major": 1,
        "minor": 0
      },
      "device": {
        "deviceType": "urn:cdif-net:device:<deviceType>:1",
        "friendlyName": "device name",
        "manufacturer": "manufacturer name",
        "manufacturerURL": "manufacturer URL",
        "modelDescription": "device model description",
        "modelName": "device model name",
        "modelNumber": "device model number",
        "serialNumber": "device serial number",
        "UPC": "universal product code",
        "userAuth": true | false,
        "powerIndex": power consumption index,
        "devicePresentation": true | false,
        "iconList": [
          {
            "mimetype": "image/format",
            "width": "image width",
            "height": "image height",
            "depth": "color depth",
            "url": "image URL"
          }
        ],
        "serviceList": {
          "urn:cdif-net:serviceID:<serviceID>": {
            "serviceType": "urn:cdif-net:service:<serviceType>:1",
            "actionList": {
              "<actionName>": {
                "argumentList": {
                  "<argumentName>": {
                    "direction": "in  | out",
                    "retval": false | true,
                    "relatedStateVariable": "<state variable name>"
                  }
                }
              }
            },
            "serviceStateTable": {
              "<state variable name>": {
                "sendEvents": true | false,
                "dataType": "<dataType>",
                "allowedValueRange": {
                  "minimum": "",
                  "maximum": "",
                  "step": ""
                },
                "defaultValue": ""
              }
            }
          }
        },
        "deviceList": [
          "device": {
            "<embedded device list>"
          }
        ]
      }
    }
Since this model contains an abstract action call interface with arbitrary arguments definition, it would be flexible to support any kind of device API interface. By utilizing this common device model, CDIF design hopes to provide a common API interface for IoT devices.

How to run
----------
```sh
    cd cdif
    npm install
    npm start
```
It may require root privilege to access Bluetooth interface

Summary of framework API interface:
-----------------------------------

##### Discover all devices
Start discovery process for all modules

    POST http://gateway_host_name:3049/discover
    response: 200 OK

##### Stop all discoveries
Stop all discovery processes

    POST http://gateway_host_name:3049/stop-discover
    response: 200 OK

##### Get device list
Retrieve uuid of all discovered devices. To improve security, this API won't expose the services provided by the discovered devices. The full description would be available from get-spec interface after client successfully connect to the device, which may need to provide valid JWT token if this device requires authentication.

    GET http://gateway_host_name:3049/device-list
    request body: empty
    response:
    [device-uuid1: {...}, device-uuid2: {...}]
    response: 200 OK

##### Connect to device:
Connect to a single device. Optionally if a device requires auth (userAuth flag set to true in device description), user / pass pair needs to be contained in the request body in JSON format. And in this case, a JWT token would be returned in the response body. Client would need to provide this token in request body for subsequent device access.

    POST http://gateway_host_name:3049/device-control/<deviceID>/connect
    (optional) request body:
    { username: <name>,
      password: <pass>
    }
    response: 200 OK / 401 unauthrized

##### Disconnect device:
Disconnect a single device, only successful if device is connected

    POST http://gateway_host_name:3049/device-control/<deviceID>/disconnect
    response: 200 OK / 404 not found / 401 unauthrized

##### Get spec of a single device:
Retrieve the spec of a single device, only successful if device is connected

    GET http://gateway_host_name:3049/device-control/<deviceID>/get-spec
    response: 200 OK / 404 not found / 401 unauthrized
    response body: JSON format of the device spec

##### Device control
Invoke a device control action, only successful if device is connected

    POST http://gateway_host_name:3049/device-control/<deviceID>/invoke-action
    request boy:
    {
      serviceID: <id>,
      actionName: <name>,
      argumentList: {
        <input arg name>: <value>,
        <output arg name>: <value>
    }
    response: 200 OK / 404 not found / 401 unauthrized / 408 timeout / 500 internal error
    response body:
    {
      <output arg1 name>: <value>,
      <output arg2 name>: <value>
    }
    Argument names must conform to the device spec that sent to client


Eventing
--------
CDIF implemented a simple [socket.io](socket.io) based server and supports subscribe to and receive event updates from devices. The subscription is service based which means clients have to subscribe to a specific service ID. If any of the variable state managed by the service are updated, e.g. a sensor value change, or a light bulb is switched on / off, client would receive event updates from CDIF. Please refer to test/socket.html for a very simple use case on this.

Device presentation
-------------------
Some kinds of IoT devices, such as IP cameras, may have their own device presentation URL for configuration and management purpose. To support this kind of usage, CDIF implemented a reverse proxy server to help redirect HTTP traffics to this URL. By doing this, the actual device presentation URL would be hidden from external network to help improve security. If the device has a presentation URL, its device model spec would have "devicePresentation" flag set to true. And in this case, the device's presentation page can be accessed from below URL:

    http://gateway_host_name:3049/device-control/<deviceID>/presentation/

For now only ONVIF devices support this kind of usage. Please refer to [cdif-onvif-manager](https://github.com/out4b/cdif-onvif-manager) module for more information.

Notes
-----
Due to the dependencies to native bindings of the underlying network stacks, CDIF now only support node v0.10.x. Currently it is only tested on Ubuntu 14.x system. If you encountered a problem on Mac or other system, please kindly report the issue [here](https://github.com/out4b/cdif/issues).

### Acknowlegement
Many thanks to the work contributed by following repositories that made this framework implementation possible:

* [noble-device](https://github.com/sandeepmistry/noble-device), [yeelight-blue](https://github.com/sandeepmistry/node-yeelight-blue), and [node-sensortag](https://github.com/sandeepmistry/node-sensortag)
* [onvif](https://github.com/agsh/onvif)
