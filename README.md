Updated information
-------------------

An [API management service](https://apemesh.com) is being created with CDIF technology with the goals of easier, automatic API integration and orchestrations. The copyright and development of this framework is now owned by LingZhang Software Ltd., Shanghai, PRC. [Our site](https://apemesh.com) contains more information about this technology, including Chinese documentations.

In the future this open-source repo would be primarily used for the evaluation and testing by the users of our API management service. We'll continously update it, to maintain the conformance of the device specs, REST APIs, and driver interfaces with our official service.

Due to limited resources, we'll no longer maintain the IoT part of this project for now. If you have a requirement to integrate this technology into your project or product, please contact us on our site.


Common device interconnect framework
------------------------------------

Common device interconnect framework (CDIF) is a web based connectivity framework. Its goal is to create a common description language in JSON format for all kinds of web services and IoT devices, and enable RPC communications in JSON texts to these entities over CDIF's RESTful interface. The common description language and RPC endpoint created by CDIF is equivalent to WSDL / SOAP but much lighter for use by the rich set of JS based web applications. CDIF brings SOA governance to REST APIs, and new scenarios such as REST API flow applications, IoT device rules engine, or a mashup of both, would be easier to be built on top of CDIF.

The common description language created by CDIF is inspired by UPnP with integral support of JSON schema definition to complex type API arguments. It creates a SOA style description language in JSON format. CDIF's common description language organizes entities such as web services, and IoT smart devices, into abstracted entity called device. Each device would have a JSON document to describe their basic information, full capabilities and API interfaces. Following SOA design style, this JSON document contains definition to a list of interchangeable services, and each of the services contains a list of abstract API definitions and their contracts. With this design, this JSON based description language may also be suitable for describing the interface of micro-service style architectures.

CDIF would collect device information from the device driver modules which are managed by it, and take care the processes of device / service discovery, registration, management, and etc. Client applications of CDIF may retrieve this description language from CDIF's RESTful interface, analyze it to create client side model or UI forms. Then API calls made to web service or IoT smart devices, which are managed by CDIF, can be done through CDIF's RESTful interface in pure JSON text messages. With event subscription support, client may also receive event updates from smart device or web services from CDIF, and being able to creates bi-directional data channel for CDIF's client applications. For more information about this JSON based common description language, please refer to spec/ folder in the source repository.

At the lower level, CDIF provides a set of uniformed device abstraction interface, and group different types of devices into device driver modules. Each module can manage one or more devices in same category, such as Bluetooth LE, ZWave, UPnP and etc. This design hides implementation details, such as different RESTful service design style (e.g. different HTTP methods with payloads in query strings, forms, ajax and etc), and IoT protocol details from the client side, so client applications may see uniform representations for all smart device or web services which are managed by CDIF.

With this design, CDIF separates web service or IoT device's external interface from its native implementation, and vendor's non-standard, proprietary implementations may also be integrated into CDIF framework as modules, and present to client side this common description language. With the RPC support over CDIF's REST interface, client application doesn't have to integrate any specific language SDK in order to access arbitrary IoT devices or web services. However, to avoid the risk of unmanaged I/O which could be exposed by arbitrary implementations, proprietary implementation may need to implement their device modules as sub-modules to the standard protocol modules such as ```cdif-ble-manager```, and left all I/O being managed by it.


Demo
----
A [demo app](https://github.com/out4b/react-schema-form) which is forked from [react-schema-form](https://github.com/networknt/react-schema-form) project shows an example of connect to a running CDIF instance, grab the common description language CDIF created for its managed REST services, auto-generate JSON schema based input forms on app UI, and invoke CDIF's REST API interface to return the API call data from it.


CDIF's common description language in summary
---------------------------------------------
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

In original UPnP's definitions, once device discovery is done, the returned device model would present services as URLs, and it requires additional service discovery step to resolve the full service models. Unlike this, CDIF's common description language tries to put all service models together inside device model object to present the full capabilities of a device. And the service discovery process for each protocol, if exists, is assumed to be conducted by the underlying stack and can be startedfrom CDIF's ```connect``` framework API interface. This design hopes to simplify client code, and also to be better compatible with protocols, or vendor's proprietary implementations which have no service discovery concept. In addition, elements such as services, arguments, state variables in CDIF's common description language are indexed by their keys for easier addressing.

Due to the design of underlying network protocols such as Z-Wave, it could take hours for the device to report its full capabilities. In this case, framework would progressively update device models to reflect any new capabilities reported from the network. To uncover these new device capabilities, client may need to refresh device's model by invoking CDIF's ```get-spec``` RESTful API interface at different times. please refer to [cdif-openzwave](https://github.com/out4b/cdif-openzwave) for more information on this.

Features
--------
This framework now provides basic support to below connectivity protocols or web service APIs:
* [Bluetooth Low Energy](https://github.com/out4b/cdif-ble-manager)
* [ONVIF Profile S camera](https://github.com/out4b/cdif-onvif-manager)
* [Z-Wave](https://github.com/out4b/cdif-openzwave)
* [OAuth based web service APIs](https://github.com/out4b/cdif-oauth-manager)
* [PayPal Payment and payouts APIs](https://github.com/out4b/cdif-paypal)

We added web service supported to CDIF because we believe the future of smart home should seamlessly integrate smart hardware with various kinds of web services to create much more powerful and useful scenarios with the rules engines and data analytics technologies built with CDIF.


How to run
----------
```sh
    cd cdif
    npm install
    npm start
```


Summary of framework API interface:
-----------------------------------

##### Discover all devices
Start discovery process for all modules

    POST http://server_host_name:3049/discover
    response: 200 OK

##### Stop all discoveries
Stop all discovery processes

    POST http://server_host_name:3049/stop-discover
    response: 200 OK

##### Get device list
Retrieve uuid of all discovered devices. To improve security, this API won't expose the services provided by the discovered devices. The full description would be available from get-spec interface after client successfully connect to the device, which may need to provide valid JWT token if this device requires authentication.

    GET http://server_host_name:3049/device-list
    request body: empty
    response:
    {
      device-uuid1: {...}, device-uuid2: {...}
    }
    response: 200 OK

##### Connect to device:
Connect to a single device. Optionally if a device requires auth (userAuth flag set to true in device description), user / pass pair needs to be contained in the request body in JSON format. And in this case, a JWT token would be returned in the response body indexed by ```device_access_token```. Client would need to provide this token in request body for subsequent device access.

    POST http://server_host_name:3049/device-control/<deviceID>/connect
    (optional) request body:
    {
      "username": <name>,
      "password": <pass>
    }
    response: 200 OK / 500 Internal error
    (optional) response body:
    {
      "device_access_token": <token>
    }

In order to handle OAuth authentication flow, a url redirect object may be returned from connect API call in following format:

``` {"url_redirect":{"href":"https://api.example.com","method":"GET"}} ```

Client of CDIF may need to follow this URL to complete the OAuth authentication flow

##### Disconnect device:
Disconnect a single device, only successful if device is connected

    POST http://server_host_name:3049/device-control/<deviceID>/disconnect
    (optional) request body:
    {
      "device_access_token": <token>
    }
    response: 200 OK / 500 Internal error

##### Get spec of a single device:
Retrieve the spec of a single device, only successful if device is connected

    GET http://server_host_name:3049/device-control/<deviceID>/get-spec
    (optional) request body:
    {
      "device_access_token": <token>
    }
    response: 200 OK / 500 Internal error
    response body: JSON format of the device spec

##### Get current state of a service:
Get current state of a service, only successful if device is connected
Client may use this call to initialize or refresh its device model without calling into device modules

    GET http://server_host_name:3049/device-control/<deviceID>/get-state
    (optional) request body:
    {
      "serviceID": <id>,
      (optional)
      "device_access_token": <token>
    }
    response: 200 OK / 500 Internal error
    response body: JSON format containing the current state data in the service object

##### Device control
Invoke a device control action, only successful if device is connected

    POST http://server_host_name:3049/device-control/<deviceID>/invoke-action
    request boy:
    {
      serviceID: <id>,
      actionName: <name>,
      argumentList: {
        <input arg name>: <value>,
        <output arg name>: <value>
      (optional)
      "device_access_token": <token>
    }
    response: 200 OK / 500 internal error
    response body:
    {
      <output arg1 name>: <value>,
      <output arg2 name>: <value>
    }
Argument names must conform to the device spec that sent to client

##### Errors
For now the above framework API interface would uniformly return 500 internal error if any error occurs. The error information is contained in response body with below JSON format:
{"topic": error class, "message": error message, "fault": faultObject}

The optional fault object in the error information is set by device driver code to carry back detail information about the error itself.

Examples
--------

To discover, connect, and read sensor value from TI SensorTag CC2650:
```
curl -H "Content-Type: application/json" -X POST http://localhost:3049/discover
curl -H "Content-Type: application/json" -X GET http://localhost:3049/device-list
curl -H "Content-Type: application/json" -X POST http://localhost:3049/stop-discover
curl -H "Content-Type: application/json" -X POST http://localhost:3049/device-control/a540d490-c3ab-4a46-98a9-c4a0f074f4d7/connect
curl -H "Content-Type: application/json" -X POST -d '{"serviceID":"urn:cdif-net:serviceID:Illuminance","actionName":"getIlluminanceData","argumentList":{"illuminance":0}} ' http://localhost:3049/device-control/a540d490-c3ab-4a46-98a9-c4a0f074f4d7/invoke-action
curl -H "Content-Type: application/json" -X GET http://localhost:3049/device-control/a540d490-c3ab-4a46-98a9-c4a0f074f4d7/get-spec
```

To connect to, and issue a PTZ absoluteMove action call to ONVIF camera device:
```
curl -H "Content-Type: application/json" -X POST -d '{"username": "admin", "password": "test"}' http://localhost:3049/device-control/b7f65ae1-1897-4f52-b1b7-9d5ecd0dd71e/connect

device access token will be returned in following format:
{"device_access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNDUxMTQwODMwLCJleHAiOjE0NTIyMjA4MzB9.JuYbGpWMhAA7OBr5GtE2_7cZMzKJGDorO8SrVRuU_k8"}

curl -H "Content-Type: application/json" -X POST -d '{"serviceID":"urn:cdif-net:serviceID:ONVIFPTZService","actionName":"absoluteMove","argumentList":{"options":{"x":-1,"y":-1,"zoom":1,"speed":{"x":0.1,"y":0.1}}},"device_access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNDUwMTQ1Njg3LCJleHAiOjE0NTEyMjU2ODd9.qwPcivmv-Oa-300LIi7eMCQUr9ha5OCZeB04eM0oaUc"}' http://localhost:3049/device-control/b7f65ae1-1897-4f52-b1b7-9d5ecd0dd71e/invoke-action
```

To connect to, and get the latest Twitter user timeline from Twitter virtual device:
```
curl -H "Content-Type: application/json" -X POST http://localhost:3049/device-control/a9878d3e-4a6b-481b-b848-37c6a4c7b901/connect

(after user completed OAuth authentication flow)

curl -H "Content-Type: application/json" -X POST -d '{"serviceID":"urn:twitter-com:serviceID:Statuses","actionName":"getUserTimeline", "argumentList":{"options":{"count":1}, "userTimeline":{}}}' http://localhost:3049/device-control/a9878d3e-4a6b-481b-b848-37c6a4c7b901/invoke-action
```

To create and execute a PayPal payment:
```
curl -H "Content-Type: application/json" -X POST -d '{"serviceID": "urn:paypal-com:serviceID:payment","actionName":"createWithPayPal", "argumentList":{"config":{"mode":"sandbox","client_id":"client_id","client_secret":"client_secret"},"intent":"authorize","payer":{"payment_method":"paypal"},"redirect_urls":{"return_url":"http://return.url","cancel_url":"http://cancel.url"},"transactions":[{"item_list":{"items":[{"name":"item","sku":"item","price":"19.00","currency":"USD","quantity":1}]},"amount":{"currency":"USD","total":"19.00"},"description":"This is the payment description."}], "result":{}}}' http://localhost:3049/device-control/9d0b29bd-b25f-4632-9a1a-d62e85d3ad4f/invoke-action

(after user login to PayPal authorization page and authorized this payment, paymentID and payer_id will be carried back in query string parameters on the return URL)

curl -H "Content-Type: application/json" -X POST -d '{"serviceID": "urn:paypal-com:serviceID:payment","actionName":"execute", "argumentList":{"config":{"mode":"sandbox","client_id":"client_id","client_secret":"client_secret"},"paymentID":"paymentID", "executeArgs":{"payer_id":"payer_id", "transactions":[{"amount":{"currency":"USD","total":"19.00"}}]}, "result":{}}}' http://localhost:3049/device-control/9d0b29bd-b25f-4632-9a1a-d62e85d3ad4f/invoke-action
```

Data types and validation
-------------------------
Various kinds of protocols or IoT devices profiles would usually define their own set of data types to communicate and exchange data with devices. For example, Bluetooth LE GATT profile would define 40-bit integer type characteristics, and in ONVIF most of arguments to SOAP calls are complex types with multiple nesting level, mandatory or optional fields in each data object. Since data integrity is vital to system security, validation needs to be enforced on each device data communication, including action calls and event notifications. However, clients would still hope to have a simple enough representation to describe all different data types that could be exposed by devices.

The Original UPnP specification has defined a rich set of primitive types for its state variables, which we map to characteristics or values in other IoT protocols, and also defined keywords such as ```allowedValueRange``` / ```allowedValueList``` to aid data validations. However unfortunately, these are still not sufficient to describe the complex-typed data as defined in other standards. Therefore, to provide a complete solution for data typing and validations would be a real challenge.

Considering these facts, CDIF would take following approaches trying to offer a common solution for data typing and validations:

* Data would be considered to be either in primitive or complex types
* ```dataType``` keyword inside state variable's definition would be used to describe its type
* CDIF would follow JSON specification and only defines these primitive types: ```boolean```, ```integer```, ```number```, and ```string```
* Device modules managed by CDIF is responsible for mapping above primitive type to their native types if needed.
* CDIF's common description language would still utilize ```allowedValueRange``` / ```allowedValueList``` keywords for primitive type data, if any of these keywords are defined.
* If a device exposes any complex-typed variable, it is required to provide a root schema document object containing all schema definitions to its variables.
* For complex types variables, they uniformly takes ```object``` type. The actual ```object``` type variable data can be either a JSON ```array``` or ```object```.
* If a state variable is in ```object``` tpye, a ```schema``` keyword must be annotated to the state variable definition. And its value would be used for validation purpose.
* The value of ```schema``` keyword refer to the formal [JSON schema](http://json-schema.org/) definition to this data object. This value is a [JSON pointer](https://tools.ietf.org/html/rfc6901) refers to the variable's sub-schema definition inside device's root schema document. Authenticated clients, such as client web apps or third party web services may also retrieve the sub-schema definitions associated with this reference through CDIF's RESTful interface and do proper validations if needed. In this case, the device's root schema definitions, and variables' sub-schemas which are defined by ```schema``` keyword can be retrieved from below URL:
```
http://server_host_name:3049/device-control/<deviceID>/schema
```
* CDIF would internally dereference the schema definitions associated with this pointer, as either defined by CDIF or its submodules, and do data validations upon action calls or event notifications.

CDIF and its [cdif-onvif-manager](https://github.com/out4b/cdif-onvif-manager) implementation contains an example of providing schema definitions, and do data validations to complex-typed arguments to ONVIF camera's PTZ action calls. For example, ONVIF PTZ ```absoluteMove``` action call through CDIF's API interface defines its argument with ```object``` type, and value of its ```schema``` keyword would be ```/onvif/ptz/AbsoluteMoveArg```, which is a JSON pointer refering to the sub-schema definitions inside ONVIF device's root schema document. In this case, the fully resolved sub-schema (with no ```$ref``` keyword inside) can be retrieved from this URL:
```
http://server_host_name:3049/device-control/<deviceID>/schema/onvif/ptz/AbsoluteMoveArg
```

Upon a ```absoluteMove``` action call, CDIF would internally dereference the sub-schema associated with this pointer, and validate the input data and output result based on those sub-schema definitions.

Unlike many of other API modelling language such as WSDL or others, CDIF separates API argument's schema definitions from the its common description language. This design may have following benefits:
* Client side code doesn't need to manually dereference schema references within the API spec
* Saving network bandwidth that client do not need to retrieve the full API document in order to make RPC calls
* Device API spec stored in http cache won't be invalidated when existing API contract requires an update

Eventing
--------
CDIF implemented a simple [socket.io](socket.io) based server to provide pub / sub method of eventing service. For now CDIF chooses socket.io as the eventing interface because its pub / sub based room API simplified our design. CDIF try not to invent its own pub / sub API but try to follow standardized technologies as much as possible. If there is such requirement in the future, we may extend this interface to support more pub / sub protocols such MQTT, AMQP and etc, given we know how to appropriately apply security means to them.

Event subscriptions in CDIF are service based, which means clients have to subscribe to a specific service ID. If any of the variable state managed by the service are updated, e.g. a sensor value change, or a light bulb is switched on / off, client would receive event updates from CDIF. CDIF would cache device states upon successful action calls, thus devices doesn't have to send event data packets to be able to notify their state updates. This would improve the usage model of eventing feature, but also leads to a result that, the ```sendEvents``` property of a state variable in CDIF's common description language would have less significance, because in theory, all state variables can be evented if they can be written by any connected client. However, CDIF would still respect this property, and if it is set to false by the device drivers, clients are not able to receive any event updates from it.

Users may refer to [test/socket.html](https://github.com/out4b/cdif/blob/master/test/socket.html) for a very simple use case on CDIF's eventing interface.

Device presentation
-------------------
Some kinds of IoT devices, such as IP cameras, may have their own device presentation URL for configuration and management purpose. To support this kind of usage, CDIF implemented a reverse proxy server to help redirect HTTP traffics to this URL. By doing this, the actual device presentation URL would be hidden from external network to help improve security. If the device has a presentation URL, its device description would have "devicePresentation" flag set to true. After the device is successfully connected through CDIF's connect API, its presentation URL is mounted on CDIF's RESTful interface and can be uniformly accessed from below URL:
```
http://server_host_name:3049/device-control/<deviceID>/presentation
```

For now only ONVIF devices support this kind of usage. But this concept should be extensible to any device or manufacturer modules who want to host their own presentation page, given they implemented the internal getDeviceRootUrl() interface which returns the reverse proxy server's root URL. Please refer to [cdif-onvif-manager](https://github.com/out4b/cdif-onvif-manager) module for more information.

Notes
-----
Due to the dependencies to native bindings of the underlying network stacks, CDIF now only support node v0.10.x. Currently it is only tested on Ubuntu 14.x system. If you encountered a problem on Mac or other system, please kindly report the issue [here](https://github.com/out4b/cdif/issues).

Test
----
Open a console and run below command:
```sh
    cd cdif
    npm test
```
The above command will discover, connect all available devices, and then invoke *every* action exposed by its device description.

### Acknowlegement
Many thanks to the work contributed by following repositories that made this framework implementation possible:

* [noble-device](https://github.com/sandeepmistry/noble-device), [yeelight-blue](https://github.com/sandeepmistry/node-yeelight-blue), and [node-sensortag](https://github.com/sandeepmistry/node-sensortag)
* [onvif](https://github.com/agsh/onvif)
* [openzwave-shared](https://www.npmjs.com/package/openzwave-shared)
